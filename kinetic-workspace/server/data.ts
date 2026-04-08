import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import db from './db.js';

const router = Router();

// ── 인증 미들웨어 ──────────────────────────────────────────────────────────────
function requireAuth(req: Request, res: Response, next: Function) {
  const token = req.cookies?.kinetic_token;
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });
  const session = db.prepare(`
    SELECT u.id, u.name, u.email, u.role
    FROM sessions s JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).get(token) as any;
  if (!session) return res.status(401).json({ error: '세션이 만료되었습니다.' });
  (req as any).user = session;
  next();
}

// ═══════════════════════════════════════════════════════════
// PROJECTS
// ═══════════════════════════════════════════════════════════

// GET /api/data/projects  (Admin: 전체 / Member: 접근권 있는 프로젝트만)
router.get('/projects', requireAuth, (req, res) => {
  const me = (req as any).user;
  const rows = me.role === 'Admin'
    ? db.prepare('SELECT * FROM projects ORDER BY created_at ASC').all() as any[]
    : db.prepare(`
        SELECT p.* FROM projects p
        INNER JOIN project_access pa ON pa.project_id = p.id
        WHERE pa.user_id = ?
        ORDER BY p.created_at ASC
      `).all(me.id) as any[];

  const members = db.prepare('SELECT * FROM project_members').all() as any[];

  const projects = rows.map((p) => ({
    id: p.id,
    initial: p.initial,
    name: p.name,
    phase: p.phase,
    progress: p.progress,
    color: p.color,
    description: p.description,
    members: members.filter((m) => m.project_id === p.id).map((m) => ({
      id: m.id, name: m.name, initial: m.initial, role: m.role, color: m.color, userId: m.user_id ?? null,
    })),
  }));

  res.json({ projects });
});

// POST /api/data/projects
router.post('/projects', requireAuth, (req, res) => {
  const me = (req as any).user;
  const { name, phase, progress, color, description, initial } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: '프로젝트 이름이 필요합니다.' });

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO projects (id, initial, name, phase, progress, color, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, initial ?? name.charAt(0).toUpperCase(), name.trim(), phase ?? '', progress ?? 0, color ?? 'from-primary to-primary-dim', description ?? null);

  // 기본 칸반 컬럼 생성
  const insertCol = db.prepare('INSERT INTO kanban_columns (id, project_id, title, color, position) VALUES (?, ?, ?, ?, ?)');
  insertCol.run(`${id}-todo`,   id, '할 일',   'primary',   0);
  insertCol.run(`${id}-inprog`, id, '진행 중', 'secondary', 1);
  insertCol.run(`${id}-done`,   id, '완료',    'tertiary',  2);

  // 생성자에게 프로젝트 접근권 부여
  db.prepare('INSERT OR IGNORE INTO project_access (project_id, user_id) VALUES (?, ?)').run(id, me.id);
  // Admin이면 모든 Admin 자동 접근
  db.exec(`INSERT OR IGNORE INTO project_access (project_id, user_id) SELECT '${id}', u.id FROM users u WHERE u.role='Admin'`);

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
  res.json({ project: { ...project, members: [] } });
});

// PATCH /api/data/projects/:id
router.patch('/projects/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { name, phase, progress, color, description, initial } = req.body ?? {};
  db.prepare(`
    UPDATE projects SET
      name = COALESCE(?, name),
      phase = COALESCE(?, phase),
      progress = COALESCE(?, progress),
      color = COALESCE(?, color),
      description = COALESCE(?, description),
      initial = COALESCE(?, initial)
    WHERE id = ?
  `).run(name ?? null, phase ?? null, progress ?? null, color ?? null, description ?? null, initial ?? null, id);
  res.json({ ok: true });
});

// DELETE /api/data/projects/:id
router.delete('/projects/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/data/projects/:id/members
router.post('/projects/:id/members', requireAuth, (req, res) => {
  const { name, initial, role, color, userId } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: '이름이 필요합니다.' });
  const memberId = crypto.randomUUID();
  db.prepare('INSERT INTO project_members (id, project_id, name, initial, role, color, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(memberId, req.params.id, name.trim(), initial ?? name.charAt(0).toUpperCase(), role ?? 'Member', color ?? 'primary', userId ?? null);
  // 실제 유저면 접근권 자동 부여
  if (userId) {
    db.prepare('INSERT OR IGNORE INTO project_access (project_id, user_id) VALUES (?, ?)').run(req.params.id, userId);
  }
  res.json({ ok: true, id: memberId });
});

// POST /api/data/projects/:id/access  (특정 유저에게 접근권만 부여)
router.post('/projects/:id/access', requireAuth, (req, res) => {
  const { userId } = req.body ?? {};
  if (!userId) return res.status(400).json({ error: 'userId 필요' });
  db.prepare('INSERT OR IGNORE INTO project_access (project_id, user_id) VALUES (?, ?)').run(req.params.id, userId);
  res.json({ ok: true });
});

// DELETE /api/data/projects/:id/access/:userId
router.delete('/projects/:id/access/:userId', requireAuth, (req, res) => {
  db.prepare('DELETE FROM project_access WHERE project_id = ? AND user_id = ?').run(req.params.id, req.params.userId);
  res.json({ ok: true });
});

// DELETE /api/data/projects/:id/members/:memberId
router.delete('/projects/:id/members/:memberId', requireAuth, (req, res) => {
  db.prepare('DELETE FROM project_members WHERE id = ? AND project_id = ?').run(req.params.memberId, req.params.id);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════
// KANBAN (personal = 'personal', project = projectId)
// ═══════════════════════════════════════════════════════════

function buildKanban(projectId: string) {
  const cols = db.prepare('SELECT * FROM kanban_columns WHERE project_id = ? ORDER BY position ASC').all(projectId) as any[];
  const tasks = db.prepare(`
    SELECT t.* FROM kanban_tasks t
    JOIN kanban_columns c ON t.column_id = c.id
    WHERE c.project_id = ?
    ORDER BY t.position ASC
  `).all(projectId) as any[];

  return cols.map((c) => ({
    id: c.id,
    title: c.title,
    color: c.color,
    tasks: tasks.filter((t) => t.column_id === c.id).map((t) => ({
      id: t.id,
      tag: t.tag,
      title: t.title,
      desc: t.description ?? undefined,
      date: t.due_date ?? undefined,
      color: t.color,
      priority: t.priority ?? undefined,
      attachments: t.attachments || undefined,
      comments: t.comments || undefined,
      progress: t.progress || undefined,
      isUrgent: !!t.is_urgent,
      isCompleted: !!t.is_completed,
    })),
  }));
}

// GET /api/data/kanban/:projectId  (personal 또는 project uuid)
router.get('/kanban/:projectId', requireAuth, (req, res) => {
  res.json({ kanban: buildKanban(req.params.projectId) });
});

// POST /api/data/kanban/:projectId/columns
router.post('/kanban/:projectId/columns', requireAuth, (req, res) => {
  const { title, color } = req.body ?? {};
  if (!title?.trim()) return res.status(400).json({ error: '컬럼 제목이 필요합니다.' });
  const maxPos = (db.prepare("SELECT MAX(position) as m FROM kanban_columns WHERE project_id = ?").get(req.params.projectId) as any)?.m ?? -1;
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO kanban_columns (id, project_id, title, color, position) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.params.projectId, title.trim(), color ?? 'primary', maxPos + 1);
  res.json({ id });
});

// DELETE /api/data/kanban/:projectId/columns/:colId
router.delete('/kanban/:projectId/columns/:colId', requireAuth, (req, res) => {
  db.prepare('DELETE FROM kanban_columns WHERE id = ? AND project_id = ?').run(req.params.colId, req.params.projectId);
  res.json({ ok: true });
});

// POST /api/data/kanban/:projectId/columns/:colId/tasks
router.post('/kanban/:projectId/columns/:colId/tasks', requireAuth, (req, res) => {
  const { tag, title, desc, date, color, priority, isUrgent } = req.body ?? {};
  if (!title?.trim()) return res.status(400).json({ error: '태스크 제목이 필요합니다.' });
  const maxPos = (db.prepare("SELECT MAX(position) as m FROM kanban_tasks WHERE column_id = ?").get(req.params.colId) as any)?.m ?? -1;
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO kanban_tasks (id, column_id, tag, title, description, due_date, color, priority, is_urgent, position)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.colId, tag ?? '', title.trim(), desc ?? null, date ?? null, color ?? 'primary', priority ?? null, isUrgent ? 1 : 0, maxPos + 1);
  res.json({ id });
});

// PATCH /api/data/kanban/:projectId/tasks/:taskId
router.patch('/kanban/:projectId/tasks/:taskId', requireAuth, (req, res) => {
  const { title, desc, date, color, priority, tag, isUrgent, isCompleted, progress, attachments, comments } = req.body ?? {};
  db.prepare(`
    UPDATE kanban_tasks SET
      title        = COALESCE(?, title),
      description  = COALESCE(?, description),
      due_date     = COALESCE(?, due_date),
      color        = COALESCE(?, color),
      priority     = COALESCE(?, priority),
      tag          = COALESCE(?, tag),
      is_urgent    = COALESCE(?, is_urgent),
      is_completed = COALESCE(?, is_completed),
      progress     = COALESCE(?, progress),
      attachments  = COALESCE(?, attachments),
      comments     = COALESCE(?, comments)
    WHERE id = ?
  `).run(
    title ?? null, desc ?? null, date ?? null, color ?? null, priority ?? null, tag ?? null,
    isUrgent !== undefined ? (isUrgent ? 1 : 0) : null,
    isCompleted !== undefined ? (isCompleted ? 1 : 0) : null,
    progress ?? null, attachments ?? null, comments ?? null,
    req.params.taskId,
  );
  res.json({ ok: true });
});

// PATCH /api/data/kanban/:projectId/tasks/:taskId/move  (컬럼 이동)
router.patch('/kanban/:projectId/tasks/:taskId/move', requireAuth, (req, res) => {
  const { colId } = req.body ?? {};
  if (!colId) return res.status(400).json({ error: 'colId 필요' });
  const maxPos = (db.prepare("SELECT MAX(position) as m FROM kanban_tasks WHERE column_id = ?").get(colId) as any)?.m ?? -1;
  db.prepare('UPDATE kanban_tasks SET column_id = ?, position = ? WHERE id = ?')
    .run(colId, maxPos + 1, req.params.taskId);
  res.json({ ok: true });
});

// DELETE /api/data/kanban/:projectId/tasks/:taskId
router.delete('/kanban/:projectId/tasks/:taskId', requireAuth, (req, res) => {
  db.prepare('DELETE FROM kanban_tasks WHERE id = ?').run(req.params.taskId);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════
// FILES
// ═══════════════════════════════════════════════════════════

// GET /api/data/files
router.get('/files', requireAuth, (req, res) => {
  const { storageId } = req.query as { storageId?: string };
  let rows: any[];
  if (storageId) {
    rows = db.prepare('SELECT * FROM files WHERE storage_id = ? ORDER BY created_at DESC').all(storageId) as any[];
  } else {
    rows = db.prepare('SELECT * FROM files ORDER BY created_at DESC').all() as any[];
  }
  const files = rows.map((f) => ({
    id: f.id, name: f.name, type: f.type, size: f.size,
    date: f.date, color: f.color, iconType: f.icon_type,
    image: f.image ?? undefined, subtitle: f.subtitle ?? undefined,
    storageId: f.storage_id ?? undefined,
  }));
  res.json({ files });
});

// POST /api/data/files
router.post('/files', requireAuth, (req, res) => {
  const { name, type, size, date, color, iconType, image, subtitle, storageId } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: '파일 이름이 필요합니다.' });
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO files (id, name, type, size, date, color, icon_type, image, subtitle, storage_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name.trim(), type ?? 'File', size ?? '0 KB', date ?? new Date().toLocaleDateString('ko-KR'), color ?? 'primary', iconType ?? 'file', image ?? null, subtitle ?? null, storageId ?? null);
  res.json({ id });
});

// PATCH /api/data/files/:id  (rename)
router.patch('/files/:id', requireAuth, (req, res) => {
  const { name } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: '이름이 필요합니다.' });
  db.prepare('UPDATE files SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
  res.json({ ok: true });
});

// DELETE /api/data/files/:id
router.delete('/files/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM files WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// GET /api/data/storage/download?filePath=...  — 로컬 파일 다운로드
router.get('/storage/download', requireAuth, (req, res) => {
  const filePath = req.query.filePath as string;
  if (!filePath?.trim()) return res.status(400).json({ error: '경로가 필요합니다.' });
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    const fileName = path.basename(filePath);
    const stat = fs.statSync(filePath);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.setHeader('Content-Type', 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  } catch {
    res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
  }
});

// ── 스토리지 연결 목록 (글로벌 공유) ────────────────────────────────────────
// GET /api/data/storage/connections — 전체 사용자 공통 읽기
router.get('/storage/connections', requireAuth, (req, res) => {
  const row = db.prepare('SELECT value FROM global_settings WHERE key = ?').get('storage_connections') as any;
  if (row) {
    try { return res.json({ value: JSON.parse(row.value) }); } catch { return res.json({ value: [] }); }
  }
  // global_settings에 없으면 user_settings에서 마이그레이션 (이전 버전 데이터 호환)
  const allUserRows = db.prepare(`SELECT value FROM user_settings WHERE key = 'storage_connections'`).all() as any[];
  if (allUserRows.length > 0) {
    const merged: any[] = [];
    for (const r of allUserRows) {
      try {
        const list = JSON.parse(r.value);
        if (Array.isArray(list)) list.forEach((c: any) => { if (!merged.find((x: any) => x.id === c.id)) merged.push(c); });
      } catch {}
    }
    if (merged.length > 0) {
      db.prepare('INSERT INTO global_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
        .run('storage_connections', JSON.stringify(merged));
      return res.json({ value: merged });
    }
  }
  return res.json({ value: [] });
});

// PUT /api/data/storage/connections
//   - 관리자: 전체 목록 교체
//   - 일반 사용자: 본인 ownerId 항목만 추가/수정/삭제 (다른 사람 항목은 보존)
router.put('/storage/connections', requireAuth, (req, res) => {
  const userId  = (req as any).user.id;
  const isAdmin = (req as any).user.role === 'Admin';
  const { value: newList } = req.body ?? {};
  if (!Array.isArray(newList)) return res.status(400).json({ error: 'value 배열 필요' });

  if (isAdmin) {
    db.prepare('INSERT INTO global_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      .run('storage_connections', JSON.stringify(newList));
    return res.json({ ok: true });
  }

  // 일반 사용자: 기존 목록에서 타인 항목은 그대로, 본인 항목만 교체
  const existing: any[] = (() => {
    const r = db.prepare('SELECT value FROM global_settings WHERE key = ?').get('storage_connections') as any;
    if (!r) return [];
    try { return JSON.parse(r.value); } catch { return []; }
  })();
  const others  = existing.filter((c: any) => c.ownerId && c.ownerId !== userId);
  const myItems = newList.filter((c: any) => !c.ownerId || c.ownerId === userId);
  const merged  = [...others, ...myItems];
  db.prepare('INSERT INTO global_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run('storage_connections', JSON.stringify(merged));
  res.json({ ok: true });
});

// GET /api/data/storage/scan?dirPath=D:\영상파일  — 로컬 디렉토리 스캔
router.get('/storage/scan', requireAuth, (req, res) => {
  const dirPath = req.query.dirPath as string;
  if (!dirPath?.trim()) return res.status(400).json({ error: '경로가 필요합니다.' });

  try {
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) return res.status(400).json({ error: '디렉토리가 아닙니다.' });

    // 드라이브 실제 사용량 (Node 19+)
    let diskTotal = 0, diskUsed = 0;
    try {
      const dstat = (fs as any).statfsSync(dirPath);
      diskTotal = dstat.blocks * dstat.bsize;
      diskUsed  = (dstat.blocks - dstat.bfree) * dstat.bsize;
    } catch { /* statfs 미지원 시 무시 */ }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    const extMap: Record<string, { iconType: string; type: string }> = {
      mp4: { iconType: 'film', type: 'MP4' }, mov: { iconType: 'film', type: 'MOV' },
      avi: { iconType: 'film', type: 'AVI' }, mkv: { iconType: 'film', type: 'MKV' },
      wmv: { iconType: 'film', type: 'WMV' }, webm: { iconType: 'film', type: 'WEBM' },
      mp3: { iconType: 'file', type: 'MP3' }, wav: { iconType: 'file', type: 'WAV' },
      aac: { iconType: 'file', type: 'AAC' }, flac: { iconType: 'file', type: 'FLAC' },
      jpg: { iconType: 'image', type: 'JPG' }, jpeg: { iconType: 'image', type: 'JPEG' },
      png: { iconType: 'image', type: 'PNG' }, gif: { iconType: 'image', type: 'GIF' },
      webp: { iconType: 'image', type: 'WEBP' }, psd: { iconType: 'image', type: 'PSD' },
      pdf: { iconType: 'file', type: 'PDF' }, docx: { iconType: 'file', type: 'DOCX' },
      doc: { iconType: 'file', type: 'DOC' }, xlsx: { iconType: 'file', type: 'XLSX' },
      pptx: { iconType: 'file', type: 'PPTX' }, txt: { iconType: 'file', type: 'TXT' },
      zip: { iconType: 'archive', type: 'ZIP' }, rar: { iconType: 'archive', type: 'RAR' },
      '7z': { iconType: 'archive', type: '7Z' }, tar: { iconType: 'archive', type: 'TAR' },
    };

    function fmtSize(bytes: number): string {
      if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
      if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
      if (bytes >= 1024)     return `${(bytes / 1024).toFixed(0)} KB`;
      return `${bytes} B`;
    }

    function fmtDate(d: Date): string {
      return d.toISOString().split('T')[0];
    }

    const files = entries.map((entry) => {
      const fullPath = path.join(dirPath, entry.name);
      let fileStat: fs.Stats | null = null;
      try { fileStat = fs.statSync(fullPath); } catch {}

      if (entry.isDirectory()) {
        let childCount = 0;
        try { childCount = fs.readdirSync(fullPath).length; } catch {}
        return {
          id: `scan-${crypto.createHash('md5').update(fullPath).digest('hex')}`,
          name: entry.name, type: 'Folder',
          size: `${childCount} 개`,
          sizeBytes: 0,
          date: fmtDate(fileStat?.mtime ?? new Date()),
          iconType: 'folder', color: 'primary',
          isDir: true,
          fullPath,
        };
      }

      const ext = entry.name.split('.').pop()?.toLowerCase() ?? '';
      const meta = extMap[ext] ?? { iconType: 'file', type: ext.toUpperCase() || 'File' };
      const sz = fileStat?.size ?? 0;
      return {
        id: `scan-${crypto.createHash('md5').update(fullPath).digest('hex')}`,
        name: entry.name,
        type: meta.type,
        size: fmtSize(sz),
        sizeBytes: sz,
        date: fmtDate(fileStat?.mtime ?? new Date()),
        iconType: meta.iconType,
        color: meta.iconType === 'film' ? 'secondary' : meta.iconType === 'image' ? 'tertiary' : 'primary',
        isDir: false,
        fullPath,
      };
    });

    // 폴더 먼저, 그 다음 파일 (이름순)
    files.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name, 'ko');
    });

    res.json({ files, dirPath, diskTotal, diskUsed });
  } catch (err: any) {
    res.status(400).json({ error: `경로를 읽을 수 없습니다: ${err.message}` });
  }
});

// ═══════════════════════════════════════════════════════════
// TEAMS
// ═══════════════════════════════════════════════════════════

// GET /api/data/teams
router.get('/teams', requireAuth, (_req, res) => {
  const teams = db.prepare('SELECT * FROM teams ORDER BY created_at ASC').all() as any[];
  const members = db.prepare(`
    SELECT tm.team_id, tm.role, u.id, u.name, u.email, u.role as user_role
    FROM team_members tm JOIN users u ON tm.user_id = u.id
  `).all() as any[];
  res.json({
    teams: teams.map((t) => ({
      id: t.id, name: t.name, color: t.color, description: t.description,
      members: members.filter((m) => m.team_id === t.id).map((m) => ({
        id: m.id, name: m.name, email: m.email, role: m.role, userRole: m.user_role,
      })),
    })),
  });
});

// POST /api/data/teams  (Admin only)
router.post('/teams', requireAuth, (req, res) => {
  if ((req as any).user.role !== 'Admin') return res.status(403).json({ error: '관리자만 팀을 생성할 수 있습니다.' });
  const { name, color, description } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: '팀 이름이 필요합니다.' });
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO teams (id, name, color, description) VALUES (?, ?, ?, ?)').run(id, name.trim(), color ?? 'primary', description ?? null);
  res.json({ id, name: name.trim(), color: color ?? 'primary', description: description ?? null, members: [] });
});

// DELETE /api/data/teams/:id  (Admin only)
router.delete('/teams/:id', requireAuth, (req, res) => {
  if ((req as any).user.role !== 'Admin') return res.status(403).json({ error: '관리자만 팀을 삭제할 수 있습니다.' });
  db.prepare('DELETE FROM teams WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/data/teams/:id/members  (Admin only)
router.post('/teams/:id/members', requireAuth, (req, res) => {
  if ((req as any).user.role !== 'Admin') return res.status(403).json({ error: '권한 없음' });
  const { userId, role } = req.body ?? {};
  if (!userId) return res.status(400).json({ error: 'userId 필요' });
  db.prepare('INSERT OR IGNORE INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)').run(req.params.id, userId, role ?? 'member');
  res.json({ ok: true });
});

// DELETE /api/data/teams/:id/members/:userId  (Admin only)
router.delete('/teams/:id/members/:userId', requireAuth, (req, res) => {
  if ((req as any).user.role !== 'Admin') return res.status(403).json({ error: '권한 없음' });
  db.prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?').run(req.params.id, req.params.userId);
  res.json({ ok: true });
});

// GET /api/data/teams/my-stats  — 내가 속한 팀 + 팀원별 스프린트 달성률
router.get('/teams/my-stats', requireAuth, (req, res) => {
  const me = (req as any).user;

  function getUserSprintRate(userId: string): number {
    // 해당 유저의 sprint_tasks 기준 달성률 — user_id로 개인별 구분 가능
    const total = (db.prepare(
      'SELECT COUNT(*) as c FROM sprint_tasks WHERE user_id = ?'
    ).get(userId) as any)?.c ?? 0;
    const done = (db.prepare(
      'SELECT COUNT(*) as c FROM sprint_tasks WHERE user_id = ? AND checked = 1'
    ).get(userId) as any)?.c ?? 0;
    return total === 0 ? 0 : Math.round((done / total) * 100);
  }

  const myTeams = db.prepare(`
    SELECT t.* FROM teams t
    JOIN team_members tm ON tm.team_id = t.id
    WHERE tm.user_id = ?
  `).all(me.id) as any[];

  const result = myTeams.map((team: any) => {
    const members = db.prepare(`
      SELECT u.id, u.name FROM team_members tm JOIN users u ON tm.user_id = u.id WHERE tm.team_id = ?
    `).all(team.id) as any[];

    return {
      id: team.id, name: team.name, color: team.color,
      members: members.map((m: any) => ({
        id: m.id, name: m.name, rate: getUserSprintRate(m.id), isMe: m.id === me.id,
      })),
    };
  });

  const myRate = getUserSprintRate(me.id);
  res.json({ teams: result, myRate, myName: me.name });
});

// ═══════════════════════════════════════════════════════════
// SPRINT TASKS (대시보드 체크리스트 — 유저별)
// ═══════════════════════════════════════════════════════════

// GET /api/data/sprint-tasks
router.get('/sprint-tasks', requireAuth, (req, res) => {
  const userId = (req as any).user.id;
  const rows = db.prepare('SELECT * FROM sprint_tasks WHERE user_id = ? ORDER BY position ASC').all(userId) as any[];
  // 처음 접속 시 기본 데이터 시딩
  if (rows.length === 0) {
    const insert = db.prepare('INSERT INTO sprint_tasks (id, user_id, label, checked, position) VALUES (?, ?, ?, ?, ?)');
    const defaults = [
      { id: crypto.randomUUID(), label: '다크 모드 팔레트 개선', checked: 0, position: 0 },
      { id: crypto.randomUUID(), label: 'Aether 클라이언트 싱크', checked: 0, position: 1 },
      { id: crypto.randomUUID(), label: '팀 진행 현황 업데이트', checked: 1, position: 2 },
    ];
    defaults.forEach(d => insert.run(d.id, userId, d.label, d.checked, d.position));
    return res.json({ tasks: defaults.map(d => ({ id: d.id, label: d.label, checked: !!d.checked })) });
  }
  res.json({ tasks: rows.map(r => ({ id: r.id, label: r.label, checked: !!r.checked })) });
});

// POST /api/data/sprint-tasks
router.post('/sprint-tasks', requireAuth, (req, res) => {
  const userId = (req as any).user.id;
  const { label } = req.body ?? {};
  if (!label?.trim()) return res.status(400).json({ error: '내용이 필요합니다.' });
  const maxPos = (db.prepare('SELECT MAX(position) as m FROM sprint_tasks WHERE user_id = ?').get(userId) as any)?.m ?? -1;
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO sprint_tasks (id, user_id, label, checked, position) VALUES (?, ?, ?, 0, ?)')
    .run(id, userId, label.trim(), maxPos + 1);
  res.json({ id });
});

// PATCH /api/data/sprint-tasks/:id
router.patch('/sprint-tasks/:id', requireAuth, (req, res) => {
  const userId = (req as any).user.id;
  const { checked, label } = req.body ?? {};
  db.prepare(`
    UPDATE sprint_tasks SET
      checked = COALESCE(?, checked),
      label   = COALESCE(?, label)
    WHERE id = ? AND user_id = ?
  `).run(checked !== undefined ? (checked ? 1 : 0) : null, label ?? null, req.params.id, userId);
  res.json({ ok: true });
});

// DELETE /api/data/sprint-tasks/:id
router.delete('/sprint-tasks/:id', requireAuth, (req, res) => {
  const userId = (req as any).user.id;
  db.prepare('DELETE FROM sprint_tasks WHERE id = ? AND user_id = ?').run(req.params.id, userId);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════
// USER SETTINGS (알림·외관 등 유저별 설정)
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// GLOBAL SETTINGS (권한·시스템 설정 — admin only)
// ═══════════════════════════════════════════════════════════

// GET /api/data/global-settings/:key
router.get('/global-settings/:key', requireAuth, (req, res) => {
  const row = db.prepare('SELECT value FROM global_settings WHERE key = ?').get(req.params.key) as any;
  if (!row) return res.json({ value: null });
  try { res.json({ value: JSON.parse(row.value) }); } catch { res.json({ value: row.value }); }
});

// PUT /api/data/global-settings/:key  (admin only)
router.put('/global-settings/:key', requireAuth, (req, res) => {
  if ((req as any).user.role !== 'Admin') return res.status(403).json({ error: '권한이 없습니다.' });
  const { value } = req.body ?? {};
  if (value === undefined) return res.status(400).json({ error: 'value 필요' });
  db.prepare('INSERT INTO global_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(req.params.key, JSON.stringify(value));
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════
// USER SETTINGS (알림·외관 등 유저별 설정)
// ═══════════════════════════════════════════════════════════

// GET /api/data/settings/:key
router.get('/settings/:key', requireAuth, (req, res) => {
  const userId = (req as any).user.id;
  const row = db.prepare('SELECT value FROM user_settings WHERE user_id = ? AND key = ?').get(userId, req.params.key) as any;
  if (!row) return res.json({ value: null });
  try { res.json({ value: JSON.parse(row.value) }); } catch { res.json({ value: row.value }); }
});

// PUT /api/data/settings/:key
router.put('/settings/:key', requireAuth, (req, res) => {
  const userId = (req as any).user.id;
  const { value } = req.body ?? {};
  if (value === undefined) return res.status(400).json({ error: 'value 필요' });
  db.prepare('INSERT INTO user_settings (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value')
    .run(userId, req.params.key, JSON.stringify(value));
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════
// CALENDAR EVENTS (유저별)
// ═══════════════════════════════════════════════════════════

// GET /api/data/calendar-events — 내 이벤트 + sharing='all' 인 타인 이벤트
router.get('/calendar-events', requireAuth, (req, res) => {
  const userId = (req as any).user.id;
  const events = db.prepare(`
    SELECT * FROM calendar_events
    WHERE user_id = ? OR sharing = 'all'
    ORDER BY date ASC, time ASC
  `).all(userId);
  res.json({ events });
});

// POST /api/data/calendar-events
router.post('/calendar-events', requireAuth, (req, res) => {
  const userId = (req as any).user.id;
  const { id, title, date, time, color, tag, sharing } = req.body ?? {};
  if (!title?.trim() || !date) return res.status(400).json({ error: 'title, date 필요' });
  const evId = id ?? crypto.randomUUID();
  const sharingVal = sharing === 'all' ? 'all' : 'personal';
  db.prepare('INSERT OR REPLACE INTO calendar_events (id, user_id, title, date, time, color, tag, sharing) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(evId, userId, title.trim(), date, time ?? null, color ?? 'primary', tag ?? null, sharingVal);
  res.json({ event: { id: evId, user_id: userId, title: title.trim(), date, time: time ?? null, color: color ?? 'primary', tag: tag ?? null, sharing: sharingVal } });
});

// PATCH /api/data/calendar-events/:id
router.patch('/calendar-events/:id', requireAuth, (req, res) => {
  const userId = (req as any).user.id;
  const { title, date, time, color, tag, sharing } = req.body ?? {};
  db.prepare(`
    UPDATE calendar_events SET
      title   = COALESCE(?, title),
      date    = COALESCE(?, date),
      time    = COALESCE(?, time),
      color   = COALESCE(?, color),
      tag     = COALESCE(?, tag),
      sharing = COALESCE(?, sharing)
    WHERE id = ? AND user_id = ?
  `).run(
    title ?? null, date ?? null, time ?? null, color ?? null, tag ?? null,
    sharing !== undefined ? (sharing === 'all' ? 'all' : 'personal') : null,
    req.params.id, userId,
  );
  res.json({ ok: true });
});

// DELETE /api/data/calendar-events/:id
router.delete('/calendar-events/:id', requireAuth, (req, res) => {
  const userId = (req as any).user.id;
  db.prepare('DELETE FROM calendar_events WHERE id = ? AND user_id = ?').run(req.params.id, userId);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════
// WEEKLY GOALS (유저별)
// ═══════════════════════════════════════════════════════════

// GET /api/data/weekly-goals
router.get('/weekly-goals', requireAuth, (req, res) => {
  const userId = (req as any).user.id;
  const goals = db.prepare('SELECT * FROM weekly_goals WHERE user_id = ? ORDER BY position ASC').all(userId);
  res.json({ goals });
});

// POST /api/data/weekly-goals
router.post('/weekly-goals', requireAuth, (req, res) => {
  const userId = (req as any).user.id;
  const { text, color } = req.body ?? {};
  if (!text?.trim()) return res.status(400).json({ error: 'text 필요' });
  const id = crypto.randomUUID();
  const pos = (db.prepare('SELECT COUNT(*) as c FROM weekly_goals WHERE user_id = ?').get(userId) as any).c;
  db.prepare('INSERT INTO weekly_goals (id, user_id, text, done, color, position) VALUES (?, ?, ?, 0, ?, ?)')
    .run(id, userId, text.trim(), color ?? 'primary', pos);
  res.json({ goal: { id, user_id: userId, text: text.trim(), done: 0, color: color ?? 'primary', position: pos } });
});

// PATCH /api/data/weekly-goals/:id
router.patch('/weekly-goals/:id', requireAuth, (req, res) => {
  const userId = (req as any).user.id;
  const { done, text, color } = req.body ?? {};
  if (done !== undefined) db.prepare('UPDATE weekly_goals SET done = ? WHERE id = ? AND user_id = ?').run(done ? 1 : 0, req.params.id, userId);
  if (text !== undefined) db.prepare('UPDATE weekly_goals SET text = ? WHERE id = ? AND user_id = ?').run(text, req.params.id, userId);
  if (color !== undefined) db.prepare('UPDATE weekly_goals SET color = ? WHERE id = ? AND user_id = ?').run(color, req.params.id, userId);
  res.json({ ok: true });
});

// DELETE /api/data/weekly-goals/:id
router.delete('/weekly-goals/:id', requireAuth, (req, res) => {
  const userId = (req as any).user.id;
  db.prepare('DELETE FROM weekly_goals WHERE id = ? AND user_id = ?').run(req.params.id, userId);
  res.json({ ok: true });
});

export default router;
