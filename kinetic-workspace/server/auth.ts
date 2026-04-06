import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from './db.js';

const router = Router();

function generateToken() {
  return crypto.randomBytes(48).toString('hex');
}

function getSessionExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + 30); // 30일
  return d.toISOString();
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req: Request, res: Response) => {
  const { name, email, password } = req.body ?? {};

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return res.status(400).json({ error: '이름, 이메일, 비밀번호를 모두 입력해주세요.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
  }

  const key = email.toLowerCase().trim();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(key);
  if (existing) {
    return res.status(409).json({ error: '이미 사용 중인 이메일입니다.' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const id = crypto.randomUUID();

  db.prepare(`
    INSERT INTO users (id, name, email, password, role)
    VALUES (?, ?, ?, ?, 'Member')
  `).run(id, name.trim(), key, hashed);

  const token = generateToken();
  db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(token, id, getSessionExpiry());

  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(id) as any;

  res.cookie('kinetic_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  return res.json({ user: { ...user, createdAt: user.created_at } });
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  if (!email?.trim() || !password?.trim()) {
    return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
  }

  const key = email.toLowerCase().trim();
  const entry = db.prepare('SELECT * FROM users WHERE email = ?').get(key) as any;

  if (!entry) return res.status(401).json({ error: '등록되지 않은 이메일입니다.' });

  const match = await bcrypt.compare(password, entry.password);
  if (!match) return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });

  // 새 세션 발급 (기존 세션 유지 — 다기기 동시 접속 허용)
  const token = generateToken();
  db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(token, entry.id, getSessionExpiry());

  res.cookie('kinetic_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  return res.json({
    user: {
      id: entry.id,
      name: entry.name,
      email: entry.email,
      role: entry.role,
      createdAt: entry.created_at,
    },
  });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', (req: Request, res: Response) => {
  const token = req.cookies?.kinetic_token;
  if (!token) return res.status(401).json({ error: 'No session' });

  const session = db.prepare(`
    SELECT s.user_id, s.expires_at, u.id, u.name, u.email, u.role, u.created_at
    FROM sessions s JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `).get(token) as any;

  if (!session) return res.status(401).json({ error: 'Invalid session' });
  if (new Date(session.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return res.status(401).json({ error: 'Session expired' });
  }

  return res.json({
    user: {
      id: session.id,
      name: session.name,
      email: session.email,
      role: session.role,
      createdAt: session.created_at,
    },
  });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', (req: Request, res: Response) => {
  const token = req.cookies?.kinetic_token;
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  res.clearCookie('kinetic_token');
  return res.json({ ok: true });
});

// ── 세션 + 유저 검증 헬퍼 ─────────────────────────────────────────────────────
function getSessionUser(req: Request) {
  const token = req.cookies?.kinetic_token;
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.id, u.name, u.email, u.role
    FROM sessions s JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).get(token) as any;
  return row ?? null;
}

// ── GET /api/auth/users ── 전체 유저 목록 (로그인 필요) ──────────────────────
router.get('/users', (req: Request, res: Response) => {
  const me = getSessionUser(req);
  if (!me) return res.status(401).json({ error: 'No session' });

  const users = db.prepare(
    'SELECT id, name, email, role, created_at FROM users ORDER BY created_at ASC'
  ).all() as any[];

  return res.json({
    users: users.map((u) => ({
      id: u.id, name: u.name, email: u.email, role: u.role,
      createdAt: u.created_at, isMe: u.id === me.id,
    })),
  });
});

// ── PATCH /api/auth/users/:id/role ── 권한 변경 (Admin만) ───────────────────
router.patch('/users/:id/role', (req: Request, res: Response) => {
  const me = getSessionUser(req);
  if (!me) return res.status(401).json({ error: 'No session' });
  if (me.role !== 'Admin') return res.status(403).json({ error: '관리자만 권한을 변경할 수 있습니다.' });

  const { role } = req.body ?? {};
  if (!['Admin', 'Member'].includes(role)) {
    return res.status(400).json({ error: '유효하지 않은 권한입니다. (Admin 또는 Member)' });
  }
  if (req.params.id === me.id) {
    return res.status(400).json({ error: '자신의 권한은 변경할 수 없습니다.' });
  }

  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  return res.json({ ok: true });
});

// ── DELETE /api/auth/users/:id ── 유저 삭제 (Admin만) ───────────────────────
router.delete('/users/:id', (req: Request, res: Response) => {
  const me = getSessionUser(req);
  if (!me) return res.status(401).json({ error: 'No session' });
  if (me.role !== 'Admin') return res.status(403).json({ error: '관리자만 유저를 삭제할 수 있습니다.' });
  if (req.params.id === me.id) return res.status(400).json({ error: '자신의 계정은 삭제할 수 없습니다.' });

  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  return res.json({ ok: true });
});

// ── PATCH /api/auth/profile ── 내 프로필 수정 (이름/이메일) ─────────────────
router.patch('/profile', async (req: Request, res: Response) => {
  const me = getSessionUser(req);
  if (!me) return res.status(401).json({ error: 'No session' });

  const { name, email } = req.body ?? {};
  if (!name?.trim() && !email?.trim()) return res.status(400).json({ error: '변경할 내용이 없습니다.' });

  if (email?.trim()) {
    const key = email.toLowerCase().trim();
    const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(key, me.id);
    if (existing) return res.status(409).json({ error: '이미 사용 중인 이메일입니다.' });
    db.prepare('UPDATE users SET email = ? WHERE id = ?').run(key, me.id);
  }
  if (name?.trim()) {
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), me.id);
  }

  const updated = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(me.id) as any;
  return res.json({ user: { ...updated, createdAt: updated.created_at } });
});

// ── PATCH /api/auth/password ── 비밀번호 변경 ────────────────────────────────
router.patch('/password', async (req: Request, res: Response) => {
  const me = getSessionUser(req);
  if (!me) return res.status(401).json({ error: 'No session' });

  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' });
  if (newPassword.length < 6) return res.status(400).json({ error: '새 비밀번호는 6자 이상이어야 합니다.' });

  const user = db.prepare('SELECT password FROM users WHERE id = ?').get(me.id) as any;
  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다.' });

  const hashed = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, me.id);
  return res.json({ ok: true });
});

// ── POST /api/auth/users/:id/promote ── 첫 번째 유저 자동 Admin 승급 ─────────
// DB에 Admin이 없으면 최초 가입자를 Admin으로 만드는 유틸
router.post('/init-admin', (req: Request, res: Response) => {
  const adminCount = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'Admin'").get() as any).c;
  if (adminCount > 0) return res.json({ ok: true, message: '이미 Admin이 존재합니다.' });

  const first = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get() as any;
  if (!first) return res.status(404).json({ error: '유저가 없습니다.' });

  db.prepare("UPDATE users SET role = 'Admin' WHERE id = ?").run(first.id);
  return res.json({ ok: true, message: '최초 가입자가 Admin으로 승급되었습니다.' });
});

export default router;
