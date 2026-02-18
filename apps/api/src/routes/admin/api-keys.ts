import { FastifyInstance } from 'fastify';
import { getDb } from '../../db/index.js';
import { v4 as uuid } from 'uuid';
import type { SetApiKeyRequest } from '@clawteam/shared';

// MVP: simple obfuscation. TODO: replace with proper encryption
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

export async function adminApiKeyRoutes(app: FastifyInstance) {
  // List API keys (masked)
  app.get('/api/admin/api-keys', async () => {
    const db = getDb();
    const keys = db.prepare('SELECT * FROM api_keys ORDER BY created_at DESC').all() as any[];
    return {
      data: keys.map((k) => ({
        ...k,
        key_masked: maskKey(decodeKey(k.key_encrypted)),
        key_encrypted: undefined,
      })),
    };
  });

  // Set API key (upsert company default for provider)
  app.post<{ Body: SetApiKeyRequest }>('/api/admin/api-keys', async (request, reply) => {
    const { provider, key } = request.body;
    if (!provider || !key) {
      return reply.status(400).send({ error: 'validation', message: 'provider and key are required' });
    }

    const db = getDb();
    // Remove old default for this provider
    db.prepare('DELETE FROM api_keys WHERE provider = ? AND is_company_default = 1').run(provider);

    const id = uuid();
    db.prepare(
      'INSERT INTO api_keys (id, provider, key_encrypted, is_company_default) VALUES (?, ?, ?, 1)'
    ).run(id, provider, encodeKey(key));

    return reply.status(201).send({
      data: { id, provider, key_masked: maskKey(key), is_company_default: true },
    });
  });

  // Delete API key
  app.delete<{ Params: { id: string } }>('/api/admin/api-keys/:id', async (request, reply) => {
    const { id } = request.params;
    const db = getDb();
    db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
    return { data: { id, deleted: true } };
  });
}

// Helper used by proxy/chat service
export function getCompanyApiKey(provider: string): string | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT key_encrypted FROM api_keys WHERE provider = ? AND is_company_default = 1'
  ).get(provider) as { key_encrypted: string } | undefined;
  return row ? decodeKey(row.key_encrypted) : null;
}
