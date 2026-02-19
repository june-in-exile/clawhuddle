import { FastifyInstance } from 'fastify';
import { getDb } from '../../db/index.js';
import { v4 as uuid } from 'uuid';
import { requireRole } from '../../middleware/auth.js';
import type { SetApiKeyRequest } from '@clawhuddle/shared';

// Simple base64 encode/decode for MVP (same as original)
function encodeKey(key: string): string {
  return Buffer.from(key).toString('base64');
}

function decodeKey(encoded: string): string {
  return Buffer.from(encoded, 'base64').toString('utf-8');
}

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '...' + key.slice(-4);
}

export async function orgApiKeyRoutes(app: FastifyInstance) {
  // List API keys (admin+ only)
  app.get(
    '/api/orgs/:orgId/api-keys',
    { preHandler: requireRole('owner', 'admin') },
    async (request) => {
      const db = getDb();
      const keys = db.prepare(
        'SELECT * FROM api_keys WHERE org_id = ? ORDER BY created_at DESC'
      ).all(request.orgId!) as any[];

      return {
        data: keys.map((k) => ({
          ...k,
          key_masked: maskKey(decodeKey(k.key_encrypted)),
          key_encrypted: undefined,
        })),
      };
    }
  );

  // Set API key (upsert org default for provider)
  app.post<{ Body: SetApiKeyRequest }>(
    '/api/orgs/:orgId/api-keys',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { provider, key } = request.body;
      if (!provider || !key) {
        return reply.status(400).send({ error: 'validation', message: 'provider and key are required' });
      }

      const db = getDb();
      // Remove old default for this provider in this org
      db.prepare('DELETE FROM api_keys WHERE provider = ? AND is_company_default = 1 AND org_id = ?').run(provider, request.orgId!);

      const id = uuid();
      db.prepare(
        'INSERT INTO api_keys (id, provider, key_encrypted, is_company_default, org_id) VALUES (?, ?, ?, 1, ?)'
      ).run(id, provider, encodeKey(key), request.orgId!);

      return reply.status(201).send({
        data: { id, provider, key_masked: maskKey(key), is_company_default: true },
      });
    }
  );

  // Delete API key
  app.delete<{ Params: { orgId: string; id: string } }>(
    '/api/orgs/:orgId/api-keys/:id',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { id } = request.params;
      const db = getDb();
      db.prepare('DELETE FROM api_keys WHERE id = ? AND org_id = ?').run(id, request.orgId!);
      return { data: { id, deleted: true } };
    }
  );
}

// Helper used by gateway service — gets org-scoped API key
export function getOrgApiKey(orgId: string, provider: string): string | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT key_encrypted FROM api_keys WHERE provider = ? AND is_company_default = 1 AND org_id = ?'
  ).get(provider, orgId) as { key_encrypted: string } | undefined;
  return row ? decodeKey(row.key_encrypted) : null;
}
