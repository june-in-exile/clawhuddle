import { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import { v4 as uuid } from 'uuid';

export async function authRoutes(app: FastifyInstance) {
  // Called by NextAuth on login to sync user
  app.post<{ Body: { email: string; name?: string } }>(
    '/api/auth/login',
    async (request, reply) => {
      const { email, name } = request.body;
      if (!email) {
        return reply.status(400).send({ error: 'validation', message: 'email is required' });
      }

      const db = getDb();
      let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

      if (!user) {
        // Auto-create user on first login
        const id = uuid();
        const isFirstUser = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
        const role = isFirstUser.count === 0 ? 'admin' : 'member';

        db.prepare(
          'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)'
        ).run(id, email, name || null, role);

        user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      } else {
        // Update last login
        db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
        if (name && !user.name) {
          db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, user.id);
        }
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      }

      if (user.status === 'disabled') {
        return reply.status(403).send({ error: 'forbidden', message: 'Account is disabled' });
      }

      return { data: user };
    }
  );

  // Get current user info
  app.get('/api/auth/me', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    if (!userId) {
      return reply.status(401).send({ error: 'unauthorized', message: 'Not authenticated' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return reply.status(404).send({ error: 'not_found', message: 'User not found' });
    }

    return { data: user };
  });
}
