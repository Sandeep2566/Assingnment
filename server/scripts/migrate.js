import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
await client.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'));
await client.end();
console.log('Database schema is ready.');
