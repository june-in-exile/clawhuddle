import { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { v4 as uuid } from 'uuid';
import { requireRole } from '../../middleware/auth.js';
import { getDb } from '../../db/index.js';
import { OAUTH_PROVIDERS } from '@clawhuddle/shared';

// In-memory store for pending OAuth flows
const pendingFlows = new Map<string, {
  verifier: string;
  provider: string;
  orgId: string;
  redirectUri: string;
  createdAt: number;
}>();

// Cleanup expired flows every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, flow] of pendingFlows) {
    if (now - flow.createdAt > 10 * 60 * 1000) pendingFlows.delete(id);
  }
}, 5 * 60 * 1000);

function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function encodeKey(key: string): string {
  return Buffer.from(key).toString('base64');
}

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '...' + key.slice(-4);
}

/** Refresh an expired OAuth token. Returns new access token or null on failure. */
export async function refreshOAuthToken(orgId: string, provider: string): Promise<string | null> {
  const db = getDb();
  const row = db.prepare(
    'SELECT id, refresh_token FROM api_keys WHERE provider = ? AND is_company_default = 1 AND org_id = ? AND source = ? AND refresh_token IS NOT NULL'
  ).get(provider, orgId, 'oauth') as { id: string; refresh_token: string } | undefined;

  if (!row) return null;

  const oauthConfig = OAUTH_PROVIDERS[provider];
  if (!oauthConfig) return null;

  const refreshToken = Buffer.from(row.refresh_token, 'base64').toString('utf-8');

  try {
    const res = await fetch(oauthConfig.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: oauthConfig.clientId,
      }),
    });

    if (!res.ok) return null;

    const data = await res.json() as { access_token: string; refresh_token?: string; expires_in?: number };
    const expiresAt = data.expires_in ? Math.floor(Date.now() / 1000) + data.expires_in : null;

    db.prepare(
      'UPDATE api_keys SET key_encrypted = ?, refresh_token = ?, token_expires_at = ? WHERE id = ?'
    ).run(
      encodeKey(data.access_token),
      data.refresh_token ? encodeKey(data.refresh_token) : row.refresh_token,
      expiresAt,
      row.id,
    );

    return data.access_token;
  } catch {
    return null;
  }
}

export async function orgOAuthRoutes(app: FastifyInstance) {
  // Start OAuth flow — returns authorize URL
  app.post<{ Body: { provider: string; redirectBase: string } }>(
    '/api/orgs/:orgId/oauth/authorize',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { provider, redirectBase } = request.body;
      if (!provider || !redirectBase) {
        return reply.status(400).send({ error: 'validation', message: 'provider and redirectBase are required' });
      }

      const oauthConfig = OAUTH_PROVIDERS[provider];
      if (!oauthConfig) {
        return reply.status(400).send({ error: 'validation', message: `OAuth not supported for provider: ${provider}` });
      }

      const { verifier, challenge } = generatePKCE();
      const flowId = crypto.randomBytes(16).toString('hex');
      const redirectUri = `${redirectBase.replace(/\/$/, '')}/auth/callback/${provider}`;

      pendingFlows.set(flowId, {
        verifier,
        provider,
        orgId: request.orgId!,
        redirectUri,
        createdAt: Date.now(),
      });

      const params = new URLSearchParams({
        client_id: oauthConfig.clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state: flowId,
      });
      if (oauthConfig.scopes) {
        params.set('scope', oauthConfig.scopes);
      }

      const authorizeUrl = `${oauthConfig.authorizeUrl}?${params.toString()}`;

      return { data: { flowId, authorizeUrl } };
    }
  );

  // Complete OAuth flow — exchange code for tokens
  app.post<{ Body: { flowId: string; code: string } }>(
    '/api/orgs/:orgId/oauth/callback',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { flowId, code } = request.body;
      if (!flowId || !code) {
        return reply.status(400).send({ error: 'validation', message: 'flowId and code are required' });
      }

      const flow = pendingFlows.get(flowId);
      if (!flow) {
        return reply.status(400).send({ error: 'expired', message: 'OAuth flow expired or not found. Please try again.' });
      }
      if (flow.orgId !== request.orgId) {
        return reply.status(403).send({ error: 'forbidden', message: 'Flow does not belong to this org' });
      }
      if (Date.now() - flow.createdAt > 10 * 60 * 1000) {
        pendingFlows.delete(flowId);
        return reply.status(400).send({ error: 'expired', message: 'OAuth flow expired. Please try again.' });
      }

      const oauthConfig = OAUTH_PROVIDERS[flow.provider];
      pendingFlows.delete(flowId);

      // Exchange code for tokens
      let tokenData: { access_token: string; refresh_token?: string; expires_in?: number };
      try {
        const tokenRes = await fetch(oauthConfig.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            client_id: oauthConfig.clientId,
            redirect_uri: flow.redirectUri,
            code_verifier: flow.verifier,
          }),
        });

        if (!tokenRes.ok) {
          const err = await tokenRes.text();
          app.log.error(`OAuth token exchange failed: ${err}`);
          return reply.status(502).send({ error: 'oauth_failed', message: 'Failed to exchange authorization code' });
        }

        tokenData = await tokenRes.json() as typeof tokenData;
      } catch (err) {
        app.log.error(`OAuth token exchange error: ${err}`);
        return reply.status(502).send({ error: 'oauth_failed', message: 'Failed to exchange authorization code' });
      }

      // Store the access token as an API key
      const db = getDb();
      const orgId = request.orgId!;
      const expiresAt = tokenData.expires_in
        ? Math.floor(Date.now() / 1000) + tokenData.expires_in
        : null;

      // Remove old default for this provider
      db.prepare('DELETE FROM api_keys WHERE provider = ? AND is_company_default = 1 AND org_id = ?')
        .run(flow.provider, orgId);

      const id = uuid();
      db.prepare(
        'INSERT INTO api_keys (id, provider, key_encrypted, is_company_default, org_id, source, refresh_token, token_expires_at) VALUES (?, ?, ?, 1, ?, ?, ?, ?)'
      ).run(
        id,
        flow.provider,
        encodeKey(tokenData.access_token),
        orgId,
        'oauth',
        tokenData.refresh_token ? encodeKey(tokenData.refresh_token) : null,
        expiresAt,
      );

      return reply.status(201).send({
        data: {
          id,
          provider: flow.provider,
          key_masked: maskKey(tokenData.access_token),
          source: 'oauth',
        },
      });
    }
  );
}
