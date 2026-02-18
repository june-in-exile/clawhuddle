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
