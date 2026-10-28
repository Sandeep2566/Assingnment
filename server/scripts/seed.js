import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const hash = await bcrypt.hash('Admin!2026', 12);
await pool.query(`INSERT INTO users (name, email, password_hash, address, role)
  VALUES ($1, $2, $3, $4, 'admin') ON CONFLICT (email) DO NOTHING`,
  ['StoreScore System Admin', 'admin@storescore.local', hash, 'Platform Operations, Demo City']);
await pool.end();
console.log('Seeded administrator account.');
