# ClawTeam MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a multi-tenant platform where company IT admins can deploy per-employee OpenClaw AI assistant instances, with a chat UI for employees and a management panel for admins.

**Architecture:** Monorepo with Next.js frontend (App Router) and Fastify backend API. Each employee gets an isolated Docker container running OpenClaw, managed via Dockerode. An API proxy sits between gateways and LLM providers (Anthropic/OpenAI) to inject company API keys and track usage. SQLite for MVP persistence, Nginx as reverse proxy.

**Tech Stack:** Next.js 16, Tailwind CSS, Auth.js v5 (next-auth@5), Fastify, SQLite (better-sqlite3), Dockerode, Docker Compose, TypeScript throughout.

---

## Phase 1: Project Scaffolding & Database

### Task 1: Initialize Monorepo

**Files:**
- Create: `package.json` (root workspace)
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `turbo.json`

**Step 1: Initialize git repo**

```bash
cd /Users/allenhsu/Documents/personal/clawteam
git init
```

**Step 2: Create root package.json with npm workspaces**

```json
{
  "name": "clawteam",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "db:migrate": "npm run migrate -w apps/api",
    "create-admin": "npm run create-admin -w apps/api"
  },
  "devDependencies": {
    "turbo": "^2.4.0",
    "typescript": "^5.7.0"
  }
}
```

**Step 3: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist"
  }
}
```

**Step 4: Create .gitignore**

```
node_modules/
dist/
.next/
.env
data/
*.sqlite
.turbo/
```

**Step 5: Create .env.example**

```env
# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=change-me-to-random-secret

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Company
ALLOWED_DOMAIN=company.com

# API Keys (for LLM proxy)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Database
DATABASE_PATH=./data/db.sqlite
```

**Step 6: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": { "cache": false, "persistent": true },
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "test": { "dependsOn": ["build"] }
  }
}
```

**Step 7: Commit**

```bash
git add -A
git commit -m "chore: initialize monorepo with npm workspaces and turbo"
```

---

### Task 2: Shared Types Package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types.ts`

**Step 1: Create packages/shared/package.json**

```json
{
  "name": "@clawteam/shared",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  }
}
```

**Step 2: Create packages/shared/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 3: Create packages/shared/src/types.ts**

All shared types derived from the data model in Tech Spec:

```typescript
// === Database Row Types ===

export interface Company {
  id: string;
  name: string;
  allowed_domain: string | null;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'member';
  status: 'active' | 'disabled';
  gateway_port: number | null;
  gateway_status: 'running' | 'stopped' | 'provisioning' | null;
  created_at: string;
  last_login: string | null;
}

export interface Skill {
  id: string;
  name: string;
  description: string | null;
  type: 'mandatory' | 'optional' | 'restricted';
  path: string;
  enabled: boolean;
  created_at: string;
}

export interface UserSkill {
  user_id: string;
  skill_id: string;
  enabled: boolean;
}

export interface ApiKey {
  id: string;
  provider: 'anthropic' | 'openai';
  key_encrypted: string;
  is_company_default: boolean;
  created_at: string;
}

export interface UsageLog {
  id: number;
  user_id: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
}

// === API Request/Response Types ===

export interface CreateUserRequest {
  email: string;
  name?: string;
  role?: 'admin' | 'member';
}

export interface UpdateUserRequest {
  status?: 'active' | 'disabled';
  role?: 'admin' | 'member';
}

export interface CreateSkillRequest {
  name: string;
  description?: string;
  type?: 'mandatory' | 'optional' | 'restricted';
  path: string;
}

export interface UpdateSkillRequest {
  type?: 'mandatory' | 'optional' | 'restricted';
  enabled?: boolean;
}

export interface SetApiKeyRequest {
  provider: 'anthropic' | 'openai';
  key: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

// === API Response wrappers ===

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
  message: string;
}
```

**Step 4: Create packages/shared/src/index.ts**

```typescript
export * from './types.js';
```

**Step 5: Commit**

```bash
git add packages/shared/
git commit -m "feat: add shared types package"
```

---

### Task 3: Fastify API Server Skeleton + Database

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/db/index.ts`
- Create: `apps/api/src/db/migrate.ts`
- Create: `apps/api/src/db/schema.sql`

**Step 1: Create apps/api/package.json**

```json
{
  "name": "@clawteam/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "migrate": "tsx src/db/migrate.ts",
    "create-admin": "tsx src/scripts/create-admin.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@clawteam/shared": "*",
    "fastify": "^5.2.0",
    "@fastify/cors": "^10.0.0",
    "@fastify/websocket": "^11.0.0",
    "better-sqlite3": "^11.8.0",
    "uuid": "^11.1.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/uuid": "^10.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

**Step 2: Create apps/api/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 3: Create apps/api/src/db/schema.sql**

Directly from Tech Spec:

```sql
CREATE TABLE IF NOT EXISTS company (
    id TEXT PRIMARY KEY DEFAULT 'default',
    name TEXT NOT NULL,
    allowed_domain TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'member',
    status TEXT NOT NULL DEFAULT 'active',
    gateway_port INTEGER,
    gateway_status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'optional',
    path TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_skills (
    user_id TEXT NOT NULL REFERENCES users(id),
    skill_id TEXT NOT NULL REFERENCES skills(id),
    enabled INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    key_encrypted TEXT NOT NULL,
    is_company_default INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT REFERENCES users(id),
    provider TEXT,
    model TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed default company
INSERT OR IGNORE INTO company (id, name, allowed_domain)
VALUES ('default', 'My Company', NULL);
```

**Step 4: Create apps/api/src/db/index.ts**

```typescript
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || './data/db.sqlite';
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}
```

**Step 5: Create apps/api/src/db/migrate.ts**

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, closeDb } from './index.js';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
const db = getDb();
db.exec(schema);
closeDb();

console.log('Database migrated successfully.');
```

**Step 6: Create apps/api/src/index.ts (minimal server)**

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import 'dotenv/config';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true, credentials: true });

app.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '0.0.0.0';

await app.listen({ port, host });
console.log(`API server running on http://${host}:${port}`);
```

**Step 7: Install dependencies and verify**

```bash
cd /Users/allenhsu/Documents/personal/clawteam
npm install
cd apps/api && npx tsx src/db/migrate.ts
```

Expected: `Database migrated successfully.`

**Step 8: Verify API server starts**

```bash
npx tsx src/index.ts &
curl http://localhost:4000/api/health
kill %1
```

Expected: `{"status":"ok","timestamp":"..."}`

**Step 9: Commit**

```bash
git add apps/api/ data/
git commit -m "feat: add Fastify API server with SQLite database"
```

---

### Task 4: API Routes — Users (Admin CRUD)

**Files:**
- Create: `apps/api/src/routes/admin/users.ts`
- Modify: `apps/api/src/index.ts` (register routes)

**Step 1: Create apps/api/src/routes/admin/users.ts**

```typescript
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
```

**Step 2: Update apps/api/src/index.ts to register routes**

Add import and register after cors:

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import 'dotenv/config';
import { adminUserRoutes } from './routes/admin/users.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true, credentials: true });

// Routes
await app.register(adminUserRoutes);

app.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '0.0.0.0';

await app.listen({ port, host });
console.log(`API server running on http://${host}:${port}`);
```

**Step 3: Test manually**

```bash
cd apps/api
npx tsx src/index.ts &
# Create user
curl -X POST http://localhost:4000/api/admin/users \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@company.com","name":"Test User"}'
# List users
curl http://localhost:4000/api/admin/users
kill %1
```

**Step 4: Commit**

```bash
git add apps/api/src/
git commit -m "feat: add admin user CRUD routes"
```

---

### Task 5: API Routes — Skills (Admin) + API Keys

**Files:**
- Create: `apps/api/src/routes/admin/skills.ts`
- Create: `apps/api/src/routes/admin/api-keys.ts`
- Modify: `apps/api/src/index.ts` (register routes)

**Step 1: Create apps/api/src/routes/admin/skills.ts**

```typescript
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
```

**Step 2: Create apps/api/src/routes/admin/api-keys.ts**

For MVP, we store API keys with simple base64 encoding (NOT production-grade encryption — noted as tech debt):

```typescript
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

// Helper used by proxy service
export function getCompanyApiKey(provider: string): string | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT key_encrypted FROM api_keys WHERE provider = ? AND is_company_default = 1'
  ).get(provider) as { key_encrypted: string } | undefined;
  return row ? decodeKey(row.key_encrypted) : null;
}
```

**Step 3: Register new routes in apps/api/src/index.ts**

Add imports and register calls:

```typescript
import { adminSkillRoutes } from './routes/admin/skills.js';
import { adminApiKeyRoutes } from './routes/admin/api-keys.js';
```

And register them after `adminUserRoutes`:

```typescript
await app.register(adminSkillRoutes);
await app.register(adminApiKeyRoutes);
```

**Step 4: Commit**

```bash
git add apps/api/src/
git commit -m "feat: add admin skills and API keys routes"
```

---

## Phase 2: Next.js Frontend + Auth

### Task 6: Scaffold Next.js App

**Files:**
- Create: `apps/web/` (via create-next-app or manual)

**Step 1: Create Next.js app**

```bash
cd /Users/allenhsu/Documents/personal/clawteam/apps
npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm
```

**Step 2: Add dependency on shared package**

Edit `apps/web/package.json` — add to dependencies:

```json
"@clawteam/shared": "*"
```

**Step 3: Run npm install from root**

```bash
cd /Users/allenhsu/Documents/personal/clawteam
npm install
```

**Step 4: Verify it starts**

```bash
cd apps/web && npm run dev &
curl -s http://localhost:3000 | head -20
kill %1
```

**Step 5: Commit**

```bash
git add apps/web/
git commit -m "feat: scaffold Next.js frontend app"
```

---

### Task 7: Auth.js v5 — Google OAuth

**Files:**
- Create: `apps/web/lib/auth.ts`
- Create: `apps/web/app/api/auth/[...nextauth]/route.ts`
- Create: `apps/web/middleware.ts`

**Step 1: Install Auth.js v5**

```bash
cd /Users/allenhsu/Documents/personal/clawteam
npm install next-auth@5 -w apps/web
```

**Step 2: Create apps/web/lib/auth.ts**

Auth.js v5 exports `handlers`, `auth`, `signIn`, `signOut` from a single config:

```typescript
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const allowedDomain = process.env.ALLOWED_DOMAIN;
      if (allowedDomain && user.email) {
        return user.email.endsWith(`@${allowedDomain}`);
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        // On first sign in, sync with API
        try {
          const res = await fetch(`${process.env.API_URL || 'http://localhost:4000'}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email, name: user.name }),
          });
          if (res.ok) {
            const data = await res.json();
            token.userId = data.data.id;
            token.role = data.data.role;
          }
        } catch (err) {
          console.error('Failed to sync user with API:', err);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
});
```

**Step 3: Create apps/web/app/api/auth/[...nextauth]/route.ts**

```typescript
import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
```

**Step 4: Create apps/web/middleware.ts**

```typescript
import { auth } from '@/lib/auth';

export default auth((req) => {
  if (!req.auth) {
    const url = req.url.replace(req.nextUrl.pathname, '/login');
    return Response.redirect(url);
  }
});

export const config = {
  matcher: ['/chat/:path*', '/admin/:path*', '/settings/:path*'],
};
```

**Step 5: Add auth login route on API side**

Create `apps/api/src/routes/auth.ts`:

```typescript
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

  // Get current user info (called from frontend)
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
```

Register in `apps/api/src/index.ts`:

```typescript
import { authRoutes } from './routes/auth.js';
// ... register it
await app.register(authRoutes);
```

**Step 6: Commit**

```bash
git add apps/web/ apps/api/src/routes/auth.ts
git commit -m "feat: add Google OAuth via NextAuth with user auto-creation"
```

---

### Task 8: Login Page UI

**Files:**
- Create: `apps/web/app/login/page.tsx`
- Modify: `apps/web/app/layout.tsx` (add session provider)
- Create: `apps/web/components/providers.tsx`

**Step 1: Create apps/web/components/providers.tsx**

```tsx
'use client';

import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

**Step 2: Update apps/web/app/layout.tsx**

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ClawTeam',
  description: 'AI assistant for your team',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

**Step 3: Create apps/web/app/login/page.tsx**

```tsx
'use client';

import { signIn } from 'next-auth/react';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-sm w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">ClawTeam</h1>
          <p className="mt-2 text-gray-600">Sign in to your AI assistant</p>
        </div>
        <button
          onClick={() => signIn('google', { callbackUrl: '/chat' })}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-gray-700 hover:bg-gray-50 transition"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
```

**Step 4: Update apps/web/app/page.tsx (root redirect)**

```tsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/chat');
}
```

**Step 5: Commit**

```bash
git add apps/web/
git commit -m "feat: add login page with Google OAuth button"
```

---

## Phase 3: Chat UI

### Task 9: Chat Page — UI Shell

**Files:**
- Create: `apps/web/app/chat/page.tsx`
- Create: `apps/web/app/chat/layout.tsx`
- Create: `apps/web/components/chat/message-list.tsx`
- Create: `apps/web/components/chat/message-input.tsx`
- Create: `apps/web/components/chat/message-bubble.tsx`
- Create: `apps/web/components/header.tsx`

**Step 1: Create apps/web/components/header.tsx**

```tsx
'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-4">
      <Link href="/chat" className="text-lg font-semibold text-gray-900">
        ClawTeam
      </Link>
      <div className="flex items-center gap-3">
        {(session?.user as any)?.role === 'admin' && (
          <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">
            Admin
          </Link>
        )}
        <Link href="/settings" className="text-sm text-gray-600 hover:text-gray-900">
          Settings
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
```

**Step 2: Create apps/web/components/chat/message-bubble.tsx**

```tsx
import type { ChatMessage } from '@clawteam/shared';

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-900'
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
```

**Step 3: Create apps/web/components/chat/message-list.tsx**

```tsx
'use client';

import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@clawteam/shared';
import { MessageBubble } from './message-bubble';

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.length === 0 && (
        <div className="flex-1 flex items-center justify-center h-full">
          <p className="text-gray-400 text-lg">Send a message to start chatting</p>
        </div>
      )}
      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
```

**Step 4: Create apps/web/components/chat/message-input.tsx**

```tsx
'use client';

import { useState, KeyboardEvent } from 'react';

interface Props {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: Props) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-gray-200 p-4 bg-white">
      <div className="flex gap-2 items-end max-w-3xl mx-auto">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          Send
        </button>
      </div>
    </div>
  );
}
```

**Step 5: Create apps/web/app/chat/layout.tsx**

```tsx
import { Header } from '@/components/header';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex flex-col">
      <Header />
      {children}
    </div>
  );
}
```

**Step 6: Create apps/web/app/chat/page.tsx**

MVP version: direct Anthropic API call from API server (no gateway container yet). This lets us get the chat working end-to-end first, then add per-user containers later.

```tsx
'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { MessageList } from '@/components/chat/message-list';
import { MessageInput } from '@/components/chat/message-input';
import type { ChatMessage } from '@clawteam/shared';

export default function ChatPage() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async (content: string) => {
    const userMessage: ChatMessage = { role: 'user', content };
    const updated = [...messages, userMessage];
    setMessages(updated);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated }),
      });

      if (!res.ok) throw new Error('Chat request failed');

      // Stream response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      setMessages([...updated, { role: 'assistant', content: '' }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          assistantContent += chunk;
          setMessages([...updated, { role: 'assistant', content: assistantContent }]);
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages([
        ...updated,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full">
      <MessageList messages={messages} />
      <MessageInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
```

**Step 7: Commit**

```bash
git add apps/web/
git commit -m "feat: add chat UI with message list, input, and streaming support"
```

---

### Task 10: Chat API Route (Next.js → Anthropic via API Server)

**Files:**
- Create: `apps/web/app/api/chat/route.ts`
- Create: `apps/api/src/routes/chat.ts`

**Step 1: Create apps/api/src/routes/chat.ts**

This route proxies chat messages to Anthropic using the company API key. Streams back the response.

```typescript
import { FastifyInstance } from 'fastify';
import { getCompanyApiKey } from './admin/api-keys.js';
import type { ChatMessage } from '@clawteam/shared';

export async function chatRoutes(app: FastifyInstance) {
  app.post<{ Body: { messages: ChatMessage[]; userId?: string } }>(
    '/api/chat',
    async (request, reply) => {
      const { messages } = request.body;
      const apiKey = getCompanyApiKey('anthropic');

      if (!apiKey) {
        return reply.status(503).send({
          error: 'no_api_key',
          message: 'No Anthropic API key configured. Ask your admin to set one up.',
        });
      }

      // Call Anthropic Messages API with streaming
      const anthropicMessages = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          stream: true,
          messages: anthropicMessages,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        app.log.error(`Anthropic error: ${err}`);
        return reply.status(502).send({ error: 'upstream', message: 'LLM request failed' });
      }

      // Stream SSE back to client as plain text chunks
      reply.raw.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  reply.raw.write(parsed.delta.text);
                }
              } catch {
                // skip non-JSON lines
              }
            }
          }
        }
      }

      reply.raw.end();
    }
  );
}
```

Register in `apps/api/src/index.ts`:

```typescript
import { chatRoutes } from './routes/chat.js';
// ...
await app.register(chatRoutes);
```

**Step 2: Create apps/web/app/api/chat/route.ts**

Next.js API route that proxies to the Fastify API server (Auth.js v5 uses `auth()`):

```typescript
import { auth } from '@/lib/auth';

const API_URL = process.env.API_URL || 'http://localhost:4000';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await request.json();

  const res = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': (session.user as any).id || '',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(err, { status: res.status });
  }

  // Forward the stream
  return new Response(res.body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
```

**Step 3: Commit**

```bash
git add apps/web/app/api/chat/ apps/api/src/routes/chat.ts apps/api/src/index.ts
git commit -m "feat: add chat API with Anthropic streaming proxy"
```

---

## Phase 4: Admin Panel

### Task 11: Admin Layout + Employee Management Page

**Files:**
- Create: `apps/web/app/admin/layout.tsx`
- Create: `apps/web/app/admin/page.tsx`
- Create: `apps/web/components/admin/sidebar.tsx`
- Create: `apps/web/components/admin/user-table.tsx`
- Create: `apps/web/lib/api.ts`

**Step 1: Create apps/web/lib/api.ts — API client helper**

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'API request failed');
  }

  return res.json();
}
```

**Step 2: Create apps/web/components/admin/sidebar.tsx**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { label: 'Employees', href: '/admin' },
  { label: 'Skills', href: '/admin/skills' },
  { label: 'API Keys', href: '/admin/api-keys' },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-52 border-r border-gray-200 bg-gray-50 p-4">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
        Admin
      </h2>
      <nav className="space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-3 py-2 rounded-lg text-sm ${
              pathname === item.href
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

**Step 3: Create apps/web/app/admin/layout.tsx**

```tsx
import { Header } from '@/components/header';
import { AdminSidebar } from '@/components/admin/sidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

**Step 4: Create apps/web/components/admin/user-table.tsx**

```tsx
'use client';

import { useState } from 'react';
import type { User } from '@clawteam/shared';
import { apiFetch } from '@/lib/api';

interface Props {
  initialUsers: User[];
}

export function UserTable({ initialUsers }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);

  const refresh = async () => {
    const res = await apiFetch<{ data: User[] }>('/api/admin/users');
    setUsers(res.data);
  };

  const addUser = async () => {
    if (!email.trim()) return;
    setAdding(true);
    try {
      await apiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setEmail('');
      await refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAdding(false);
    }
  };

  const toggleStatus = async (user: User) => {
    const newStatus = user.status === 'active' ? 'disabled' : 'active';
    await apiFetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
    });
    await refresh();
  };

  return (
    <div>
      <div className="flex gap-2 mb-6">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="employee@company.com"
          className="flex-1 max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={addUser}
          disabled={adding}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          Add Employee
        </button>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="pb-3 font-medium">Name</th>
            <th className="pb-3 font-medium">Email</th>
            <th className="pb-3 font-medium">Role</th>
            <th className="pb-3 font-medium">Status</th>
            <th className="pb-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.map((user) => (
            <tr key={user.id}>
              <td className="py-3">{user.name || '—'}</td>
              <td className="py-3 text-gray-600">{user.email}</td>
              <td className="py-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {user.role}
                </span>
              </td>
              <td className="py-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {user.status}
                </span>
              </td>
              <td className="py-3">
                <button
                  onClick={() => toggleStatus(user)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {user.status === 'active' ? 'Disable' : 'Enable'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {users.length === 0 && (
        <p className="text-center text-gray-400 py-8">No employees yet</p>
      )}
    </div>
  );
}
```

**Step 5: Create apps/web/app/admin/page.tsx**

```tsx
import { UserTable } from '@/components/admin/user-table';

const API_URL = process.env.API_URL || 'http://localhost:4000';

async function getUsers() {
  try {
    const res = await fetch(`${API_URL}/api/admin/users`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}

export default async function AdminPage() {
  const users = await getUsers();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Employees</h1>
      <UserTable initialUsers={users} />
    </div>
  );
}
```

**Step 6: Commit**

```bash
git add apps/web/
git commit -m "feat: add admin panel with employee management"
```

---

### Task 12: Admin — Skills Management Page

**Files:**
- Create: `apps/web/app/admin/skills/page.tsx`
- Create: `apps/web/components/admin/skill-table.tsx`

**Step 1: Create apps/web/components/admin/skill-table.tsx**

```tsx
'use client';

import { useState } from 'react';
import type { Skill } from '@clawteam/shared';
import { apiFetch } from '@/lib/api';

interface Props {
  initialSkills: Skill[];
}

export function SkillTable({ initialSkills }: Props) {
  const [skills, setSkills] = useState(initialSkills);
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [adding, setAdding] = useState(false);

  const refresh = async () => {
    const res = await apiFetch<{ data: Skill[] }>('/api/admin/skills');
    setSkills(res.data);
  };

  const addSkill = async () => {
    if (!name.trim() || !path.trim()) return;
    setAdding(true);
    try {
      await apiFetch('/api/admin/skills', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), path: path.trim() }),
      });
      setName('');
      setPath('');
      await refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAdding(false);
    }
  };

  const toggleEnabled = async (skill: Skill) => {
    await apiFetch(`/api/admin/skills/${skill.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: !skill.enabled }),
    });
    await refresh();
  };

  const deleteSkill = async (skill: Skill) => {
    if (!confirm(`Delete skill "${skill.name}"?`)) return;
    await apiFetch(`/api/admin/skills/${skill.id}`, { method: 'DELETE' });
    await refresh();
  };

  const typeColors: Record<string, string> = {
    mandatory: 'bg-red-100 text-red-700',
    optional: 'bg-blue-100 text-blue-700',
    restricted: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div>
      <div className="flex gap-2 mb-6">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Skill name"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="Path (e.g. web-search)"
          className="flex-1 max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={addSkill}
          disabled={adding}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          Add Skill
        </button>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="pb-3 font-medium">Name</th>
            <th className="pb-3 font-medium">Path</th>
            <th className="pb-3 font-medium">Type</th>
            <th className="pb-3 font-medium">Status</th>
            <th className="pb-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {skills.map((skill) => (
            <tr key={skill.id}>
              <td className="py-3 font-medium">{skill.name}</td>
              <td className="py-3 text-gray-600 font-mono text-xs">{skill.path}</td>
              <td className="py-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[skill.type] || ''}`}>
                  {skill.type}
                </span>
              </td>
              <td className="py-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  skill.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {skill.enabled ? 'enabled' : 'disabled'}
                </span>
              </td>
              <td className="py-3 space-x-2">
                <button onClick={() => toggleEnabled(skill)} className="text-sm text-blue-600 hover:underline">
                  {skill.enabled ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => deleteSkill(skill)} className="text-sm text-red-600 hover:underline">
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {skills.length === 0 && (
        <p className="text-center text-gray-400 py-8">No skills configured</p>
      )}
    </div>
  );
}
```

**Step 2: Create apps/web/app/admin/skills/page.tsx**

```tsx
import { SkillTable } from '@/components/admin/skill-table';

const API_URL = process.env.API_URL || 'http://localhost:4000';

async function getSkills() {
  try {
    const res = await fetch(`${API_URL}/api/admin/skills`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}

export default async function SkillsPage() {
  const skills = await getSkills();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Skills</h1>
      <SkillTable initialSkills={skills} />
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add apps/web/
git commit -m "feat: add admin skills management page"
```

---

### Task 13: Admin — API Keys Page

**Files:**
- Create: `apps/web/app/admin/api-keys/page.tsx`
- Create: `apps/web/components/admin/api-key-form.tsx`

**Step 1: Create apps/web/components/admin/api-key-form.tsx**

```tsx
'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';

interface ApiKeyDisplay {
  id: string;
  provider: string;
  key_masked: string;
  is_company_default: boolean;
}

interface Props {
  initialKeys: ApiKeyDisplay[];
}

export function ApiKeyForm({ initialKeys }: Props) {
  const [keys, setKeys] = useState(initialKeys);
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    const res = await apiFetch<{ data: ApiKeyDisplay[] }>('/api/admin/api-keys');
    setKeys(res.data);
  };

  const saveKey = async (provider: string, key: string, clearFn: (v: string) => void) => {
    if (!key.trim()) return;
    setSaving(true);
    try {
      await apiFetch('/api/admin/api-keys', {
        method: 'POST',
        body: JSON.stringify({ provider, key: key.trim() }),
      });
      clearFn('');
      await refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const currentKey = (provider: string) => keys.find((k) => k.provider === provider);

  return (
    <div className="space-y-8 max-w-lg">
      {/* Anthropic */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Anthropic</h3>
        {currentKey('anthropic') && (
          <p className="text-sm text-gray-500 mb-2">
            Current: <code className="bg-gray-100 px-1 rounded">{currentKey('anthropic')!.key_masked}</code>
          </p>
        )}
        <div className="flex gap-2">
          <input
            type="password"
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            placeholder="sk-ant-..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => saveKey('anthropic', anthropicKey, setAnthropicKey)}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>

      {/* OpenAI */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">OpenAI</h3>
        {currentKey('openai') && (
          <p className="text-sm text-gray-500 mb-2">
            Current: <code className="bg-gray-100 px-1 rounded">{currentKey('openai')!.key_masked}</code>
          </p>
        )}
        <div className="flex gap-2">
          <input
            type="password"
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder="sk-..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => saveKey('openai', openaiKey, setOpenaiKey)}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create apps/web/app/admin/api-keys/page.tsx**

```tsx
import { ApiKeyForm } from '@/components/admin/api-key-form';

const API_URL = process.env.API_URL || 'http://localhost:4000';

async function getApiKeys() {
  try {
    const res = await fetch(`${API_URL}/api/admin/api-keys`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}

export default async function ApiKeysPage() {
  const keys = await getApiKeys();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">API Keys</h1>
      <ApiKeyForm initialKeys={keys} />
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add apps/web/
git commit -m "feat: add admin API keys management page"
```

---

## Phase 5: Docker Compose + Nginx

### Task 14: Docker Setup

**Files:**
- Create: `apps/api/Dockerfile`
- Create: `apps/web/Dockerfile`
- Create: `docker-compose.yml`
- Create: `nginx/nginx.conf`

**Step 1: Create apps/api/Dockerfile**

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.json ./
COPY src ./src
RUN npm install && npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src/db/schema.sql ./dist/db/schema.sql
COPY package.json ./
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

**Step 2: Create apps/web/Dockerfile**

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

**Step 3: Create docker-compose.yml**

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - web
      - api

  web:
    build: ./apps/web
    environment:
      - NEXTAUTH_URL=http://localhost
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-dev-secret-change-me}
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - API_URL=http://api:4000
      - ALLOWED_DOMAIN=${ALLOWED_DOMAIN:-}
    depends_on:
      - api

  api:
    build: ./apps/api
    environment:
      - DATABASE_PATH=/data/db.sqlite
      - PORT=4000
    volumes:
      - ./data:/data
```

**Step 4: Create nginx/nginx.conf**

```nginx
events {
    worker_connections 1024;
}

http {
    upstream web {
        server web:3000;
    }

    upstream api {
        server api:4000;
    }

    server {
        listen 80;
        server_name localhost;

        # Frontend
        location / {
            proxy_pass http://web;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # API
        location /api/ {
            proxy_pass http://api/api/;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_read_timeout 120s;
            proxy_buffering off;
        }
    }
}
```

**Step 5: Commit**

```bash
git add docker-compose.yml nginx/ apps/api/Dockerfile apps/web/Dockerfile
git commit -m "feat: add Docker Compose setup with Nginx reverse proxy"
```

---

### Task 15: Scripts + Final Wiring

**Files:**
- Create: `apps/api/src/scripts/create-admin.ts`
- Create: `scripts/setup.sh`

**Step 1: Create apps/api/src/scripts/create-admin.ts**

```typescript
import { getDb, closeDb } from '../db/index.js';
import { v4 as uuid } from 'uuid';
import 'dotenv/config';

const email = process.argv[2];
if (!email) {
  console.error('Usage: npm run create-admin -- <email>');
  process.exit(1);
}

const db = getDb();

const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
if (existing) {
  db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(email);
  console.log(`Updated ${email} to admin.`);
} else {
  const id = uuid();
  db.prepare(
    "INSERT INTO users (id, email, role) VALUES (?, ?, 'admin')"
  ).run(id, email);
  console.log(`Created admin user: ${email} (id: ${id})`);
}

closeDb();
```

**Step 2: Create scripts/setup.sh**

```bash
#!/bin/bash
set -e

echo "=== ClawTeam Setup ==="

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Error: Node.js is required"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Error: Docker is required"; exit 1; }

# Create data directory
mkdir -p data/skills data/users

# Copy env if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env — please edit it with your credentials"
fi

# Install dependencies
npm install

# Run database migration
npm run db:migrate

echo ""
echo "=== Setup complete ==="
echo "Next steps:"
echo "  1. Edit .env with your Google OAuth credentials"
echo "  2. Run: npm run create-admin -- your@email.com"
echo "  3. Run: npm run dev"
```

**Step 3: Make setup.sh executable and commit**

```bash
chmod +x scripts/setup.sh
git add apps/api/src/scripts/ scripts/
git commit -m "feat: add setup script and create-admin command"
```

---

## Summary

| Phase | Tasks | What it delivers |
|-------|-------|-----------------|
| 1: Scaffolding | Tasks 1–5 | Monorepo, DB, all API routes |
| 2: Auth | Tasks 6–8 | Next.js app, Google OAuth, login page |
| 3: Chat | Tasks 9–10 | Chat UI with Anthropic streaming |
| 4: Admin | Tasks 11–13 | Employee, Skills, API Keys management |
| 5: Docker | Tasks 14–15 | Docker Compose, Nginx, scripts |

**Post-MVP (not in this plan):**
- Per-user Gateway Docker containers (Dockerode provisioner)
- WebSocket-based chat instead of HTTP streaming
- Settings page for employees
- Usage tracking dashboard
- Proper API key encryption (AES-256)
- Admin auth guard middleware

---

**Note on Gateway containers:** The Tech Spec describes per-user OpenClaw Docker containers. For MVP, we skip this complexity and proxy chat directly to Anthropic via the API server. This gets the product functional immediately. Gateway container provisioning is a clear Phase 2 feature once the core chat + admin flow works.
