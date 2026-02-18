import { FastifyInstance } from 'fastify';
import { getDb } from '../../db/index.js';
import { v4 as uuid } from 'uuid';
import type { CreateSkillRequest, UpdateSkillRequest, Skill } from '@clawteam/shared';

export async function adminSkillRoutes(app: FastifyInstance) {
  // List all skills
  app.get('/api/admin/skills', async () => {
    const db = getDb();
    const skills = db.prepare('SELECT * FROM skills ORDER BY created_at DESC').all();
    return { data: skills };
  });

  // Create skill
  app.post<{ Body: CreateSkillRequest }>('/api/admin/skills', async (request, reply) => {
    const { name, description, type, path } = request.body;
    if (!name || !path) {
      return reply.status(400).send({ error: 'validation', message: 'name and path are required' });
    }

    const db = getDb();
    const id = uuid();
    db.prepare(
      'INSERT INTO skills (id, name, description, type, path) VALUES (?, ?, ?, ?, ?)'
    ).run(id, name, description || null, type || 'optional', path);

    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
    return reply.status(201).send({ data: skill });
  });

  // Update skill
  app.patch<{ Params: { id: string }; Body: UpdateSkillRequest }>(
    '/api/admin/skills/:id',
    async (request, reply) => {
      const { id } = request.params;
      const { type, enabled } = request.body;

      const db = getDb();
      const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id) as Skill | undefined;
      if (!skill) {
        return reply.status(404).send({ error: 'not_found', message: 'Skill not found' });
      }

      const updates: string[] = [];
      const values: any[] = [];

      if (type !== undefined) { updates.push('type = ?'); values.push(type); }
      if (enabled !== undefined) { updates.push('enabled = ?'); values.push(enabled ? 1 : 0); }

      if (updates.length > 0) {
        values.push(id);
        db.prepare(`UPDATE skills SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      }

      const updated = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
      return { data: updated };
    }
  );

  // Delete skill
  app.delete<{ Params: { id: string } }>('/api/admin/skills/:id', async (request, reply) => {
    const { id } = request.params;
    const db = getDb();
    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
    if (!skill) {
      return reply.status(404).send({ error: 'not_found', message: 'Skill not found' });
    }

    db.prepare('DELETE FROM user_skills WHERE skill_id = ?').run(id);
    db.prepare('DELETE FROM skills WHERE id = ?').run(id);
    return { data: { id, deleted: true } };
  });
}
