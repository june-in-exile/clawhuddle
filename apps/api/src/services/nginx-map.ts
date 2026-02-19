import fs from 'node:fs';
import path from 'node:path';
import Docker from 'dockerode';
import { getDb } from '../db/index.js';

const docker = new Docker();

const NGINX_CONTAINER = process.env.NGINX_CONTAINER_NAME || 'clawhuddle-nginx';
const GATEWAY_HOST = process.env.GATEWAY_HOST || '127.0.0.1';

function getMapFilePath(): string {
  const dataDir = process.env.DATA_DIR || path.resolve('./data');
  return path.join(dataDir, 'nginx', 'gateway-map.conf');
}

export function ensureNginxMapFile(): void {
  const mapFile = getMapFilePath();
  const dir = path.dirname(mapFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(mapFile)) {
    fs.writeFileSync(mapFile, '# gateway subdomain -> upstream map\n');
  }
}

export async function regenerateNginxMap(): Promise<void> {
  const db = getDb();
  const rows = db.prepare(
    'SELECT gateway_subdomain, gateway_port FROM org_members WHERE gateway_subdomain IS NOT NULL AND gateway_port IS NOT NULL'
  ).all() as { gateway_subdomain: string; gateway_port: number }[];

  const lines = rows.map(
    (r) => `${r.gateway_subdomain} ${GATEWAY_HOST}:${r.gateway_port};`
  );

  const content = `# Auto-generated gateway subdomain map\n${lines.join('\n')}\n`;
  const mapFile = getMapFilePath();
  const dir = path.dirname(mapFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(mapFile, content);

  // Send SIGHUP to nginx to reload config
  try {
    const container = docker.getContainer(NGINX_CONTAINER);
    await container.kill({ signal: 'SIGHUP' });
  } catch {
    // nginx container may not be running (local dev)
    console.warn('Could not signal nginx container for reload');
  }
}
