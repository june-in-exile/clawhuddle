import { FastifyInstance } from 'fastify';
import { getDb } from '../../db/index.js';
import { v4 as uuid } from 'uuid';
import type { CreateUserRequest, UpdateUserRequest, User } from '@clawteam/shared';

export async function adminUserRoutes(app: FastifyInstance) {
  // List all users
  app.get('/api/admin/users', async (request, reply) => {
    const db = getDb();
    const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
    return { data: users };
  });

  // Create user
  app.post<{ Body: CreateUserRequest }>('/api/admin/users', async (request, reply) => {
    const { email, name, role } = request.body;
    if (!email) {
      return reply.status(400).send({ error: 'validation', message: 'email is required' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return reply.status(409).send({ error: 'conflict', message: 'User already exists' });
    }

    const id = uuid();
    db.prepare(
      'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)'
    ).run(id, email, name || null, role || 'member');

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return reply.status(201).send({ data: user });
  });

  // Update user
  app.patch<{ Params: { id: string }; Body: UpdateUserRequest }>(
    '/api/admin/users/:id',
    async (request, reply) => {
      const { id } = request.params;
      const { status, role } = request.body;

      const db = getDb();
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
      if (!user) {
        return reply.status(404).send({ error: 'not_found', message: 'User not found' });
      }

      const updates: string[] = [];
      const values: any[] = [];

      if (status !== undefined) {
        updates.push('status = ?');
        values.push(status);
      }
      if (role !== undefined) {
        updates.push('role = ?');
        values.push(role);
      }

      if (updates.length > 0) {
        values.push(id);
        db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      }

      const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      return { data: updated };
    }
  );

  // Delete (disable) user
  app.delete<{ Params: { id: string } }>(
    '/api/admin/users/:id',
    async (request, reply) => {
      const { id } = request.params;
      const db = getDb();
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      if (!user) {
        return reply.status(404).send({ error: 'not_found', message: 'User not found' });
      }

      db.prepare("UPDATE users SET status = 'disabled' WHERE id = ?").run(id);
      return { data: { id, status: 'disabled' } };
    }
  );
}
