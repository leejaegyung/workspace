import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import db from './db.js';
import { broadcastToUsers } from './wsHub.js';

const router = Router();

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

// ── GET /api/chat/channels ── 내가 속한 채널만 반환 ───────────────────────────
// DM: 상대방 이름을 name으로 반환
router.get('/channels', (req: Request, res: Response) => {
  const me = getSessionUser(req);
  if (!me) return res.status(401).json({ error: 'No session' });

  // 공개 채널에 자동 가입 (신규 유저 or 채널 생긴 후 가입)
  db.exec(`
    INSERT OR IGNORE INTO channel_members (channel_id, user_id)
    SELECT c.id, '${me.id}'
    FROM chat_channels c
    WHERE c.type = 'channel'
  `);

  const channels = db.prepare(`
    SELECT
      c.id,
      c.type,
      c.created_at,
      CASE
        WHEN c.type = 'dm' THEN (
          SELECT u.name
          FROM channel_members cm2
          JOIN users u ON cm2.user_id = u.id
          WHERE cm2.channel_id = c.id AND cm2.user_id != ?
          LIMIT 1
        )
        ELSE c.name
      END AS name
    FROM chat_channels c
    INNER JOIN channel_members cm ON c.id = cm.channel_id
    WHERE cm.user_id = ?
    ORDER BY c.type ASC, name ASC
  `).all(me.id, me.id) as any[];

  return res.json({ channels });
});

// ── POST /api/chat/channels ── 채널 생성 (생성자 자동 추가) ─────────────────
router.post('/channels', (req: Request, res: Response) => {
  const me = getSessionUser(req);
  if (!me) return res.status(401).json({ error: 'No session' });

  const { name, type = 'channel', id: customId } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });

  const id = customId ?? crypto.randomUUID();
  try {
    db.prepare('INSERT INTO chat_channels (id, name, type) VALUES (?, ?, ?)').run(id, name.trim(), type);
    // 생성자 자동 추가
    db.prepare('INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)').run(id, me.id);
    return res.json({ channel: { id, name: name.trim(), type } });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      const existing = db.prepare('SELECT * FROM chat_channels WHERE id = ? OR name = ?').get(id, name.trim()) as any;
      if (existing) {
        db.prepare('INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)').run(existing.id, me.id);
      }
      return res.json({ channel: existing });
    }
    throw e;
  }
});

// ── POST /api/chat/channels/dm ── DM 채널 생성 (양방향 안정적 ID) ────────────
router.post('/channels/dm', (req: Request, res: Response) => {
  const me = getSessionUser(req);
  if (!me) return res.status(401).json({ error: 'No session' });

  const { targetUserId } = req.body ?? {};
  if (!targetUserId) return res.status(400).json({ error: 'targetUserId required' });

  const target = db.prepare('SELECT id, name FROM users WHERE id = ?').get(targetUserId) as any;
  if (!target) return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });

  // 두 유저 간 DM 채널 ID: 항상 동일한 값
  const dmId = `dm-${[me.id, targetUserId].sort().join('-')}`;

  db.prepare('INSERT OR IGNORE INTO chat_channels (id, name, type) VALUES (?, ?, ?)').run(dmId, dmId, 'dm');
  db.prepare('INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)').run(dmId, me.id);
  db.prepare('INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)').run(dmId, targetUserId);

  // 상대방에게 새 DM 채널 즉시 알림 (자신의 이름으로)
  broadcastToUsers([targetUserId], { type: 'channel_created', channel: { id: dmId, name: me.name, type: 'dm' } });

  return res.json({ channel: { id: dmId, name: target.name, type: 'dm' } });
});

// ── DELETE /api/chat/channels/:id ── 채널 삭제 (Admin만) ────────────────────
router.delete('/channels/:id', (req: Request, res: Response) => {
  const me = getSessionUser(req);
  if (!me) return res.status(401).json({ error: 'No session' });
  if (me.role !== 'Admin') return res.status(403).json({ error: '관리자만 채널을 삭제할 수 있습니다.' });

  db.prepare('DELETE FROM chat_channels WHERE id = ?').run(req.params.id);
  return res.json({ ok: true });
});

// ── GET /api/chat/channels/:id/members ── 채널 멤버 목록 ─────────────────────
router.get('/channels/:id/members', (req: Request, res: Response) => {
  const me = getSessionUser(req);
  if (!me) return res.status(401).json({ error: 'No session' });

  const members = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, cm.joined_at
    FROM channel_members cm
    JOIN users u ON cm.user_id = u.id
    WHERE cm.channel_id = ?
    ORDER BY cm.joined_at ASC
  `).all(req.params.id);

  return res.json({ members });
});

// ── POST /api/chat/channels/:id/members ── 멤버 추가 ────────────────────────
router.post('/channels/:id/members', (req: Request, res: Response) => {
  const me = getSessionUser(req);
  if (!me) return res.status(401).json({ error: 'No session' });

  const { userId } = req.body ?? {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const channel = db.prepare('SELECT id FROM chat_channels WHERE id = ?').get(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  db.prepare('INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)').run(req.params.id, userId);
  return res.json({ ok: true });
});

// ── DELETE /api/chat/channels/:id/members/me ── 내 멤버십 제거 (나가기) ──────
router.delete('/channels/:id/members/me', (req: Request, res: Response) => {
  const me = getSessionUser(req);
  if (!me) return res.status(401).json({ error: 'No session' });
  db.prepare('DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?').run(req.params.id, me.id);
  return res.json({ ok: true });
});

// ── DELETE /api/chat/channels/:id/members/:userId ── 멤버 제거 ──────────────
router.delete('/channels/:id/members/:userId', (req: Request, res: Response) => {
  const me = getSessionUser(req);
  if (!me) return res.status(401).json({ error: 'No session' });

  // 자기 자신 제거 or Admin만 남 제거 가능
  if (req.params.userId !== me.id && me.role !== 'Admin') {
    return res.status(403).json({ error: '자신만 채널에서 나갈 수 있습니다.' });
  }

  db.prepare('DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?').run(req.params.id, req.params.userId);
  return res.json({ ok: true });
});

// ── GET /api/chat/channels/:id/messages?after=ISO ───────────────────────────
router.get('/channels/:id/messages', (req: Request, res: Response) => {
  const me = getSessionUser(req);
  if (!me) return res.status(401).json({ error: 'No session' });

  const channel = db.prepare('SELECT id FROM chat_channels WHERE id = ?').get(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const { after, limit = '60' } = req.query as Record<string, string>;
  let msgs: any[];

  if (after) {
    msgs = db.prepare(
      'SELECT * FROM chat_messages WHERE channel_id = ? AND created_at > ? ORDER BY created_at ASC LIMIT 100'
    ).all(req.params.id, after);
  } else {
    msgs = db.prepare(
      'SELECT * FROM chat_messages WHERE channel_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(req.params.id, parseInt(limit));
    msgs = msgs.reverse();
  }

  return res.json({ messages: msgs });
});

// ── POST /api/chat/channels/:id/messages ────────────────────────────────────
router.post('/channels/:id/messages', (req: Request, res: Response) => {
  const me = getSessionUser(req);
  if (!me) return res.status(401).json({ error: 'No session' });

  const { content } = req.body ?? {};
  if (!content?.trim()) return res.status(400).json({ error: 'content required' });

  const channel = db.prepare('SELECT id FROM chat_channels WHERE id = ?').get(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO chat_messages (id, channel_id, user_id, user_name, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, req.params.id, me.id, me.name, content.trim(), now);

  const messageData = { id, channel_id: req.params.id, user_id: me.id, user_name: me.name, content: content.trim(), created_at: now };

  // 채널 멤버에게 WebSocket으로 즉시 전송 (발신자 제외)
  const members = db.prepare('SELECT user_id FROM channel_members WHERE channel_id = ?').all(req.params.id) as { user_id: string }[];
  broadcastToUsers(
    members.map((m) => m.user_id),
    { type: 'message', channelId: req.params.id, message: messageData },
    me.id,
  );

  return res.json({ message: messageData });
});

export default router;
