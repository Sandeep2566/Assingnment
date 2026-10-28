import jwt from 'jsonwebtoken';

const secret = () => process.env.JWT_SECRET || 'development-only-secret-change-me';
export const signToken = (user) => jwt.sign({ sub: user.id, role: user.role, name: user.name }, secret(), { expiresIn: '8h' });
export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  try { req.user = jwt.verify(token, secret()); next(); }
  catch { res.status(401).json({ error: 'Please log in to continue.' }); }
}
export const allow = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'You do not have access to this action.' });
