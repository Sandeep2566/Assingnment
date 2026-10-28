import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { allow, requireAuth, signToken } from './auth.js';
import { adminUserInput, messageFrom, storeInput, userInput } from './validation.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const data = userInput.parse(req.body); const hash = await bcrypt.hash(data.password, 12);
  const { rows } = await pool.query(`INSERT INTO users (name,email,address,password_hash) VALUES ($1,$2,$3,$4) RETURNING id,name,email,address,role`, [data.name, data.email.toLowerCase(), data.address, hash]);
  res.status(201).json({ user: rows[0], token: signToken(rows[0]) });
}));
app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body || {}; const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [String(email).toLowerCase()]);
  if (!rows[0] || !await bcrypt.compare(String(password), rows[0].password_hash)) return res.status(401).json({ error: 'Incorrect email or password.' });
  const user = rows[0]; res.json({ token: signToken(user), user: { id:user.id, name:user.name, email:user.email, address:user.address, role:user.role } });
}));
app.get('/api/auth/me', requireAuth, asyncRoute(async (req, res) => {
  const { rows } = await pool.query('SELECT id,name,email,address,role FROM users WHERE id=$1', [req.user.sub]); res.json(rows[0]);
}));
app.patch('/api/auth/password', requireAuth, asyncRoute(async (req, res) => {
  const { password } = userInput.pick({ password: true }).parse(req.body); const hash = await bcrypt.hash(password, 12);
  await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.sub]); res.status(204).end();
}));

app.get('/api/stores', requireAuth, asyncRoute(async (req, res) => {
  const search = `%${String(req.query.search || '').trim()}%`; const columns = { name: 's.name', address: 's.address', rating: '"averageRating"' };
  const sort = columns[req.query.sort] || 's.name'; const dir = String(req.query.dir).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const { rows } = await pool.query(`SELECT s.id,s.name,s.email,s.address,ROUND(AVG(r.score)::numeric,2) AS "averageRating", ${req.user.role === 'user' ? 'MAX(CASE WHEN r.user_id=$1 THEN r.score END)' : 'NULL'} AS "myRating"
    FROM stores s LEFT JOIN ratings r ON r.store_id=s.id WHERE s.name ILIKE $${req.user.role === 'user' ? 2 : 1} OR s.address ILIKE $${req.user.role === 'user' ? 2 : 1}
    GROUP BY s.id ORDER BY ${sort} ${dir}`, req.user.role === 'user' ? [req.user.sub, search] : [search]);
  res.json(rows);
}));
app.post('/api/stores', requireAuth, allow('admin'), asyncRoute(async (req, res) => {
  const data = storeInput.parse(req.body); if (data.ownerUserId) { const owner = await pool.query("SELECT id FROM users WHERE id=$1 AND role='owner'", [data.ownerUserId]); if (!owner.rowCount) return res.status(400).json({ error: 'Choose a valid store owner.' }); }
  const { rows } = await pool.query('INSERT INTO stores (name,email,address,owner_user_id) VALUES ($1,$2,$3,$4) RETURNING *', [data.name,data.email.toLowerCase(),data.address,data.ownerUserId || null]); res.status(201).json(rows[0]);
}));
app.post('/api/stores/:storeId/rating', requireAuth, allow('user'), asyncRoute(async (req, res) => {
  const score = Number(req.body?.score); if (!Number.isInteger(score) || score < 1 || score > 5) return res.status(400).json({ error: 'Rating must be an integer from 1 to 5.' });
  const { rows } = await pool.query(`INSERT INTO ratings (user_id,store_id,score) VALUES ($1,$2,$3) ON CONFLICT (user_id,store_id) DO UPDATE SET score=EXCLUDED.score,updated_at=now() RETURNING score`, [req.user.sub,req.params.storeId,score]); res.json(rows[0]);
}));

app.get('/api/admin/summary', requireAuth, allow('admin'), asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(`SELECT (SELECT count(*) FROM users) AS users,(SELECT count(*) FROM stores) AS stores,(SELECT count(*) FROM ratings) AS ratings`); res.json(rows[0]);
}));
app.get('/api/admin/users', requireAuth, allow('admin'), asyncRoute(async (req, res) => {
  const search = `%${String(req.query.search || '').trim()}%`; const allowed = { name:'name',email:'email',address:'address',role:'role' }; const sort = allowed[req.query.sort] || 'name'; const dir = String(req.query.dir).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const { rows } = await pool.query(`SELECT id,name,email,address,role FROM users WHERE name ILIKE $1 OR email ILIKE $1 OR address ILIKE $1 OR role::text ILIKE $1 ORDER BY ${sort} ${dir}`, [search]); res.json(rows);
}));
app.post('/api/admin/users', requireAuth, allow('admin'), asyncRoute(async (req, res) => {
  const data = adminUserInput.parse(req.body); const hash = await bcrypt.hash(data.password, 12); const { rows } = await pool.query('INSERT INTO users (name,email,address,password_hash,role) VALUES ($1,$2,$3,$4,$5) RETURNING id,name,email,address,role', [data.name,data.email.toLowerCase(),data.address,hash,data.role]); res.status(201).json(rows[0]);
}));
app.get('/api/admin/users/:id', requireAuth, allow('admin'), asyncRoute(async (req, res) => {
  const { rows } = await pool.query(`SELECT u.id,u.name,u.email,u.address,u.role,ROUND(AVG(r.score)::numeric,2) AS "rating" FROM users u LEFT JOIN stores s ON s.owner_user_id=u.id LEFT JOIN ratings r ON r.store_id=s.id WHERE u.id=$1 GROUP BY u.id`, [req.params.id]); if (!rows[0]) return res.status(404).json({ error:'User not found.' }); res.json(rows[0]);
}));
app.get('/api/owner/dashboard', requireAuth, allow('owner'), asyncRoute(async (req, res) => {
  const store = await pool.query(`SELECT s.id,s.name,ROUND(AVG(r.score)::numeric,2) AS "averageRating" FROM stores s LEFT JOIN ratings r ON r.store_id=s.id WHERE s.owner_user_id=$1 GROUP BY s.id`, [req.user.sub]);
  const raters = await pool.query(`SELECT u.name,u.email,r.score,r.updated_at AS "updatedAt" FROM ratings r JOIN users u ON u.id=r.user_id JOIN stores s ON s.id=r.store_id WHERE s.owner_user_id=$1 ORDER BY r.updated_at DESC`, [req.user.sub]);
  res.json({ stores:store.rows, raters:raters.rows });
}));

app.use((err, _req, res, _next) => { console.error(err); if (err.name === 'ZodError') return res.status(400).json({ error: messageFrom(err) }); if (err.code === '23505') return res.status(409).json({ error: 'That email or assignment already exists.' }); if (err.code === '23503') return res.status(404).json({ error: 'The selected record does not exist.' }); res.status(500).json({ error: 'Something went wrong.' }); });
app.listen(process.env.PORT || 3001, () => console.log('API listening on port ' + (process.env.PORT || 3001)));
