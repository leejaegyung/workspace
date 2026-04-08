import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import os from 'os';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import authRouter from './auth.js';
import chatRouter from './chat.js';
import dataRouter from './data.js';
import db from './db.js';
import { registerClient, unregisterClient } from './wsHub.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT ?? 3001);

const app = express();

app.use(express.json());
app.use(cookieParser());

// ── 요청 로그 (디버깅용) ──────────────────────────────────────────────────────
app.use((req, _res, next) => {
  if (req.path.startsWith('/api/')) {
    const cookie = req.cookies?.kinetic_token ? '✅cookie' : '❌no-cookie';
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} | from:${req.ip} | ${cookie}`);
  }
  next();
});

// ── API 라우트 ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/chat', chatRouter);
app.use('/api/data', dataRouter);
app.get('/api/health', (_, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ── 프론트엔드 정적 파일 ──────────────────────────────────────────────────────
app.use(express.static(DIST));

// SPA fallback — 모든 unknown 경로를 index.html 로
app.get('*', (_, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

// ── 전역 에러 핸들러 — 라우터에서 throw된 에러를 JSON으로 통일 반환 ──────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server] Unhandled error:', err?.message ?? err);
  res.status(500).json({ error: 'Internal server error', detail: err?.message });
});

// ── HTTP 서버 + WebSocket 서버 ─────────────────────────────────────────────────
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

wss.on('connection', (ws, req) => {
  // 쿠키에서 토큰 파싱
  const cookieHeader = req.headers.cookie ?? '';
  const token = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('kinetic_token='))
    ?.split('=')[1];

  if (!token) {
    ws.close(1008, 'Unauthorized');
    return;
  }

  // DB에서 세션 검증
  const user = db.prepare(`
    SELECT u.id, u.name
    FROM sessions s JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).get(token) as { id: string; name: string } | undefined;

  if (!user) {
    ws.close(1008, 'Unauthorized');
    return;
  }

  registerClient(user.id, ws);
  console.log(`[WS] connected: ${user.name} (${user.id})`);

  ws.on('close', () => {
    unregisterClient(ws);
    console.log(`[WS] disconnected: ${user.name}`);
  });

  ws.on('error', () => {
    unregisterClient(ws);
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i?.family === 'IPv4' && !i?.internal)
    .map((i) => i!.address);

  console.log('\n┌──────────────────────────────────────────────┐');
  console.log('│        ✅  Kinetic Workspace 실행 중          │');
  console.log('├──────────────────────────────────────────────┤');
  console.log(`│  로컬:      http://localhost:${PORT}              │`);
  ips.forEach((ip) => {
    console.log(`│  네트워크:  http://${ip}:${PORT}`.padEnd(47) + '│');
  });
  console.log('│                                              │');
  console.log('│  종료: Ctrl+C  또는  종료.bat                │');
  console.log('└──────────────────────────────────────────────┘\n');
});
