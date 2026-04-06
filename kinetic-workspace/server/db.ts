import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'kinetic.db');

const db = new Database(DB_PATH);

// WAL 모드 (동시 읽기/쓰기 성능 향상)
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 유저 테이블
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    password    TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'Member',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// 세션 테이블
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    expires_at  TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// 채팅 채널 테이블
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_channels (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'channel',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// 채팅 메시지 테이블
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_messages (
    id          TEXT PRIMARY KEY,
    channel_id  TEXT NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
    user_name   TEXT NOT NULL,
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// 채널 멤버 테이블
db.exec(`
  CREATE TABLE IF NOT EXISTS channel_members (
    channel_id  TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    joined_at   TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (channel_id, user_id),
    FOREIGN KEY (channel_id) REFERENCES chat_channels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)    REFERENCES users(id)         ON DELETE CASCADE
  );
`);

// 기본 채널 시딩
const defaultChannels = [
  { id: 'ch-design',    name: 'design-critique',    type: 'channel' },
  { id: 'ch-devops',    name: 'dev-ops',             type: 'channel' },
  { id: 'ch-marketing', name: 'marketing-strategy',  type: 'channel' },
];
const insertCh = db.prepare('INSERT OR IGNORE INTO chat_channels (id, name, type) VALUES (?, ?, ?)');
for (const ch of defaultChannels) {
  insertCh.run(ch.id, ch.name, ch.type);
}

// 기존 채널에 기존 유저 전원 자동 추가 (마이그레이션)
db.exec(`
  INSERT OR IGNORE INTO channel_members (channel_id, user_id)
  SELECT c.id, u.id
  FROM chat_channels c
  CROSS JOIN users u
  WHERE c.type = 'channel';
`);

// ── 프로젝트 테이블 ───────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    initial     TEXT NOT NULL DEFAULT '',
    name        TEXT NOT NULL,
    phase       TEXT NOT NULL DEFAULT '',
    progress    INTEGER NOT NULL DEFAULT 0,
    color       TEXT NOT NULL DEFAULT 'from-primary to-primary-dim',
    description TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// 프로젝트 멤버 테이블
db.exec(`
  CREATE TABLE IF NOT EXISTS project_members (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    initial     TEXT NOT NULL DEFAULT '',
    role        TEXT NOT NULL DEFAULT 'Member',
    color       TEXT NOT NULL DEFAULT 'primary'
  );
`);

// 칸반 컬럼 테이블 (project_id = 'personal' → 개인 업무 보드)
db.exec(`
  CREATE TABLE IF NOT EXISTS kanban_columns (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL DEFAULT 'personal',
    title       TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT 'primary',
    position    INTEGER NOT NULL DEFAULT 0
  );
`);

// 칸반 태스크 테이블
db.exec(`
  CREATE TABLE IF NOT EXISTS kanban_tasks (
    id           TEXT PRIMARY KEY,
    column_id    TEXT NOT NULL REFERENCES kanban_columns(id) ON DELETE CASCADE,
    tag          TEXT NOT NULL DEFAULT '',
    title        TEXT NOT NULL,
    description  TEXT,
    due_date     TEXT,
    color        TEXT NOT NULL DEFAULT 'primary',
    priority     TEXT,
    attachments  INTEGER DEFAULT 0,
    comments     INTEGER DEFAULT 0,
    progress     INTEGER DEFAULT 0,
    is_urgent    INTEGER NOT NULL DEFAULT 0,
    is_completed INTEGER NOT NULL DEFAULT 0,
    position     INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// 파일/스토리지 테이블
db.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'File',
    size        TEXT NOT NULL DEFAULT '0 KB',
    date        TEXT NOT NULL DEFAULT (date('now')),
    color       TEXT DEFAULT 'primary',
    icon_type   TEXT NOT NULL DEFAULT 'file',
    image       TEXT,
    subtitle    TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// 기본 파일 시딩
const fileCount = (db.prepare('SELECT COUNT(*) as c FROM files').get() as any).c;
if (fileCount === 0) {
  const insertFile = db.prepare(`
    INSERT INTO files (id, name, type, size, date, color, icon_type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertFile.run('f1', 'Social Media Templates',  'Folder',   '12 files', '2026-04-01', 'primary',   'folder');
  insertFile.run('f2', 'Marketing_Strategy.docx', 'Document', '1.1 MB',   '2026-04-01', 'secondary', 'file');
  insertFile.run('f3', 'Raw_Video_Assets.zip',    'Archive',  '1.8 GB',   '2026-03-20', 'tertiary',  'archive');
}

// 기본 개인 칸반 컬럼 시딩
const personalColCount = (db.prepare("SELECT COUNT(*) as c FROM kanban_columns WHERE project_id = 'personal'").get() as any).c;
if (personalColCount === 0) {
  const insertCol = db.prepare('INSERT INTO kanban_columns (id, project_id, title, color, position) VALUES (?, ?, ?, ?, ?)');
  insertCol.run('pk-todo',       'personal', '할 일',   'primary',   0);
  insertCol.run('pk-inprogress', 'personal', '진행 중', 'secondary', 1);
  insertCol.run('pk-done',       'personal', '완료',    'tertiary',  2);
  // 기본 태스크 시딩
  const insertTask = db.prepare(`
    INSERT INTO kanban_tasks (id, column_id, tag, title, description, due_date, color, priority, is_urgent, position)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertTask.run('pt1', 'pk-todo', 'UI 디자인', '로그인 모달 글라스모피즘 구현', '백드롭 블러 20px 적용', '2026-04-10', 'primary', null, 0, 0);
  insertTask.run('pt2', 'pk-todo', '브랜딩', '스프린트 알파 비주얼 에셋 팩', null, '2026-04-07', 'secondary', null, 1, 1);
  insertTask.run('pt3', 'pk-inprogress', '프론트엔드', 'Tailwind 토널 레이어링 리팩토링', '1px 보더에서 배경색 전환', null, 'tertiary', '높음', 0, 0);
}

// 기본 프로젝트 시딩
const projectCount = (db.prepare('SELECT COUNT(*) as c FROM projects').get() as any).c;
if (projectCount === 0) {
  const insertProject = db.prepare(`
    INSERT INTO projects (id, initial, name, phase, progress, color, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertProject.run('proj-1', 'S', 'Solaris Mobile App', '디자인 단계', 75, 'from-primary to-primary-dim', '모바일 UX 리디자인 및 글라스모피즘 컴포넌트 라이브러리 구축');
  insertProject.run('proj-2', 'A', 'Aether CMS',         '베타 테스트', 42, 'from-secondary to-secondary-dim', '헤드리스 CMS 플랫폼 베타 출시 및 API 안정화');
  insertProject.run('proj-3', 'N', 'Nexus Branding',     '초기 탐색',  15, 'from-tertiary to-tertiary-dim',   '브랜드 아이덴티티 재정립 및 비주얼 에셋 시스템 구축');

  // 각 프로젝트 기본 칸반 컬럼
  const insertCol = db.prepare('INSERT INTO kanban_columns (id, project_id, title, color, position) VALUES (?, ?, ?, ?, ?)');
  for (const projId of ['proj-1', 'proj-2', 'proj-3']) {
    const short = projId.split('-')[1];
    insertCol.run(`${projId}-todo`,   projId, '할 일',   'primary',   0);
    insertCol.run(`${projId}-inprog`, projId, '진행 중', 'secondary', 1);
    insertCol.run(`${projId}-done`,   projId, '완료',    'tertiary',  2);
  }
}

// 팀 테이블
db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT 'primary',
    description TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// 팀 멤버 테이블 (유저 ↔ 팀 다대다)
db.exec(`
  CREATE TABLE IF NOT EXISTS team_members (
    team_id   TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role      TEXT NOT NULL DEFAULT 'member',
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (team_id, user_id)
  );
`);

// 프로젝트 접근권 테이블 (유저 ↔ 프로젝트)
db.exec(`
  CREATE TABLE IF NOT EXISTS project_access (
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    PRIMARY KEY (project_id, user_id)
  );
`);

// project_members 에 user_id 컬럼 추가 (없으면)
try { db.exec('ALTER TABLE project_members ADD COLUMN user_id TEXT'); } catch {}

// 기존 프로젝트에 Admin 유저 자동 접근권 부여 (마이그레이션)
db.exec(`
  INSERT OR IGNORE INTO project_access (project_id, user_id)
  SELECT p.id, u.id FROM projects p CROSS JOIN users u WHERE u.role = 'Admin';
`);

// 전역 설정 테이블 (권한 등 시스템 전체 설정)
db.exec(`
  CREATE TABLE IF NOT EXISTS global_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// 스프린트 태스크 테이블 (대시보드 체크리스트 — 유저별)
db.exec(`
  CREATE TABLE IF NOT EXISTS sprint_tasks (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label      TEXT NOT NULL,
    checked    INTEGER NOT NULL DEFAULT 0,
    position   INTEGER NOT NULL DEFAULT 0
  );
`);

// files 테이블에 storage_id 컬럼 추가 (연결된 스토리지별 파일 구분)
try { db.exec('ALTER TABLE files ADD COLUMN storage_id TEXT'); } catch {}
// calendar_events 에 sharing 컬럼 추가 (personal / all)
try { db.exec('ALTER TABLE calendar_events ADD COLUMN sharing TEXT NOT NULL DEFAULT "personal"'); } catch {}

// 유저 설정 테이블 (알림/외관 등 유저별 키-값)
db.exec(`
  CREATE TABLE IF NOT EXISTS user_settings (
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key      TEXT NOT NULL,
    value    TEXT NOT NULL,
    PRIMARY KEY(user_id, key)
  );
`);

// 캘린더 이벤트 테이블 (유저별)
db.exec(`
  CREATE TABLE IF NOT EXISTS calendar_events (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    date       TEXT NOT NULL,
    time       TEXT,
    color      TEXT NOT NULL DEFAULT 'primary',
    tag        TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// 주간 목표 테이블 (유저별)
db.exec(`
  CREATE TABLE IF NOT EXISTS weekly_goals (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text       TEXT NOT NULL,
    done       INTEGER NOT NULL DEFAULT 0,
    color      TEXT NOT NULL DEFAULT 'primary',
    position   INTEGER NOT NULL DEFAULT 0
  );
`);

export default db;
