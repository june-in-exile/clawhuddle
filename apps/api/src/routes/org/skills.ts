import { FastifyInstance } from 'fastify';
import { getDb } from '../../db/index.js';
import { v4 as uuid } from 'uuid';
import { requireRole } from '../../middleware/auth.js';
import { scanRepoForSkills } from '../../services/skill-installer.js';
import type { CreateSkillRequest, UpdateSkillRequest, ScanRepoRequest, ImportSkillsRequest } from '@clawteam/shared';

export async function orgSkillRoutes(app: FastifyInstance) {
  // List skills for this org (admin+ only)
  app.get(
    '/api/orgs/:orgId/skills',
    { preHandler: requireRole('owner', 'admin') },
    async (request) => {
      const db = getDb();
      const skills = db.prepare(
        'SELECT * FROM skills WHERE org_id = ? ORDER BY type, name'
      ).all(request.orgId!);
      return { data: skills };
    }
  );

  // Scan git repo for skills
  app.post<{ Body: ScanRepoRequest }>(
    '/api/orgs/:orgId/skills/scan',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { git_url } = request.body;
      if (!git_url) {
        return reply.status(400).send({ error: 'validation', message: 'git_url is required' });
      }

      try {
        const results = scanRepoForSkills(git_url);
        return { data: results };
      } catch (err: any) {
        return reply.status(400).send({ error: 'scan_error', message: err.message });
      }
    }
  );

  // Import multiple skills from scanned repo
  app.post<{ Body: ImportSkillsRequest }>(
    '/api/orgs/:orgId/skills/import',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { git_url, skills: skillsToImport } = request.body;
      if (!git_url || !skillsToImport?.length) {
        return reply.status(400).send({ error: 'validation', message: 'git_url and skills are required' });
      }

      const db = getDb();
      const imported: any[] = [];

      for (const s of skillsToImport) {
        // Skip if already exists in this org
        const existing = db.prepare(
          'SELECT id FROM skills WHERE org_id = ? AND git_url = ? AND git_path = ?'
        ).get(request.orgId!, git_url, s.git_path);
        if (existing) continue;

        const id = uuid();
        db.prepare(
          `INSERT INTO skills (id, name, description, type, path, git_url, git_path, org_id)
           VALUES (?, ?, NULL, 'optional', ?, ?, ?, ?)`
        ).run(id, s.name, s.git_path, git_url, s.git_path, request.orgId!);

        const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
        imported.push(skill);
      }

      return { data: imported };
    }
  );

  // Create skill
  app.post<{ Body: CreateSkillRequest }>(
    '/api/orgs/:orgId/skills',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { name, description, type, path, git_url, git_path } = request.body;
      if (!name) {
        return reply.status(400).send({ error: 'validation', message: 'name is required' });
      }

      const db = getDb();
      const id = uuid();
      db.prepare(
        'INSERT INTO skills (id, name, description, type, path, git_url, git_path, org_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(id, name, description || null, type || 'optional', path || '', git_url || null, git_path || null, request.orgId!);

      const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
      return reply.status(201).send({ data: skill });
    }
  );

  // Update skill
  app.patch<{ Params: { orgId: string; id: string }; Body: UpdateSkillRequest }>(
    '/api/orgs/:orgId/skills/:id',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { id } = request.params;
      const { type, enabled, git_url, git_path } = request.body;

      const db = getDb();
      const skill = db.prepare('SELECT * FROM skills WHERE id = ? AND org_id = ?').get(id, request.orgId!);
      if (!skill) {
        return reply.status(404).send({ error: 'not_found', message: 'Skill not found' });
      }

      const updates: string[] = [];
      const values: any[] = [];

      if (type !== undefined) { updates.push('type = ?'); values.push(type); }
      if (enabled !== undefined) { updates.push('enabled = ?'); values.push(enabled ? 1 : 0); }
      if (git_url !== undefined) { updates.push('git_url = ?'); values.push(git_url); }
      if (git_path !== undefined) { updates.push('git_path = ?'); values.push(git_path); }

      if (updates.length > 0) {
        values.push(id);
        db.prepare(`UPDATE skills SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      }

      const updated = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
      return { data: updated };
    }
  );

  // Delete skill
  app.delete<{ Params: { orgId: string; id: string } }>(
    '/api/orgs/:orgId/skills/:id',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { id } = request.params;
      const db = getDb();

      const skill = db.prepare('SELECT * FROM skills WHERE id = ? AND org_id = ?').get(id, request.orgId!);
      if (!skill) {
        return reply.status(404).send({ error: 'not_found', message: 'Skill not found' });
      }

      db.prepare('DELETE FROM user_skills WHERE skill_id = ?').run(id);
      db.prepare('DELETE FROM skills WHERE id = ?').run(id);
      return { data: { id, deleted: true } };
    }
  );
}
