import React, { useState, useEffect } from 'react';
import { User, Mail, Shield, Bell, Palette, LogOut, Save, Camera, Users, Crown, Trash2, ChevronDown, Check, Search, Plus, X, HardDrive, Cloud, Database, Link, Unlink, UsersRound, Edit2, Globe, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { cn } from '../lib/utils';
import { applyTheme, ACCENT_PALETTES } from '../lib/theme';
import { apiFetch } from '../lib/apiFetch';

type Tab = 'profile' | 'notifications' | 'appearance' | 'security' | 'users' | 'teams' | 'permissions' | 'storage';

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Member';
  createdAt: string;
  isMe: boolean;
}

const DEFAULT_NOTIF = { mention: true, channel: true, project: false, deadline: true, activity: false };
const DEFAULT_APPEARANCE = { theme: 0, accent: 0 };

async function apiSettings(key: string) {
  try {
    const res = await apiFetch(`/api/data/settings/${key}`);
    if (!res.ok) return null;
    const { value } = await res.json();
    return value;
  } catch { return null; }
}
async function saveSettings(key: string, value: object) {
  await apiFetch(`/api/data/settings/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
}

export function Settings() {
  const { user, isAdmin, logout, updateProfile, updatePassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // 프로필
  const [profileName, setProfileName]   = useState(user?.name ?? '');
  const [profileEmail, setProfileEmail] = useState(user?.email ?? '');
  const [profileSaving, setProfileSaving] = useState(false);

  // 보안
  const [curPwd, setCurPwd]   = useState('');
  const [newPwd, setNewPwd]   = useState('');
  const [confPwd, setConfPwd] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  // 알림 (서버 DB)
  const [notif, setNotif] = useState(DEFAULT_NOTIF);
  useEffect(() => {
    apiSettings('notifications').then((v) => { if (v) setNotif(v); });
  }, []);
  function toggleNotif(key: string) {
    const updated = { ...notif, [key]: !notif[key as keyof typeof notif] };
    setNotif(updated);
    saveSettings('notifications', updated);
    toast('알림 설정이 저장되었습니다.', 'success');
  }

  // 외관 (서버 DB)
  const [appearance, setAppearance] = useState(DEFAULT_APPEARANCE);
  useEffect(() => {
    apiSettings('appearance').then((v) => {
      if (v) {
        setAppearance(v);
        applyTheme(v.theme ?? 0, v.accent ?? 0);
      }
    });
  }, []);
  function setTheme(i: number) {
    const updated = { ...appearance, theme: i };
    setAppearance(updated);
    applyTheme(i, updated.accent);
    saveSettings('appearance', updated);
    toast(i === 1 ? '화이트 테마가 적용되었습니다.' : '다크 테마가 적용되었습니다.', 'success');
  }
  function setAccent(i: number) {
    const updated = { ...appearance, accent: i };
    setAppearance(updated);
    applyTheme(updated.theme, i);
    saveSettings('appearance', updated);
    toast(`${ACCENT_PALETTES[i].label} 액센트가 적용되었습니다.`, 'success');
  }

  const handleLogout = () => { logout(); navigate('/login'); };

  async function handleProfileSave() {
    if (!profileName.trim()) { toast('이름을 입력해주세요.', 'info'); return; }
    setProfileSaving(true);
    const { success, error } = await updateProfile(profileName.trim(), profileEmail.trim());
    setProfileSaving(false);
    if (success) toast('프로필이 저장되었습니다.', 'success');
    else toast(error ?? '저장 실패', 'error');
  }

  async function handlePasswordChange() {
    if (!curPwd || !newPwd || !confPwd) { toast('모든 필드를 입력해주세요.', 'info'); return; }
    if (newPwd !== confPwd) { toast('새 비밀번호가 일치하지 않습니다.', 'info'); return; }
    if (newPwd.length < 6) { toast('비밀번호는 6자 이상이어야 합니다.', 'info'); return; }
    setPwdSaving(true);
    const { success, error } = await updatePassword(curPwd, newPwd);
    setPwdSaving(false);
    if (success) { toast('비밀번호가 변경되었습니다.', 'success'); setCurPwd(''); setNewPwd(''); setConfPwd(''); }
    else toast(error ?? '변경 실패', 'error');
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
    { id: 'profile',     label: '프로필',     icon: User },
    { id: 'notifications', label: '알림',     icon: Bell },
    { id: 'appearance',  label: '외관',       icon: Palette },
    { id: 'security',    label: '보안',       icon: Shield },
    { id: 'users',       label: '사용자 관리', icon: Users,      adminOnly: true },
    { id: 'teams',       label: '팀 관리',     icon: UsersRound, adminOnly: true },
    { id: 'permissions', label: '권한 관리',   icon: Crown,      adminOnly: true },
    { id: 'storage',     label: '스토리지 설정', icon: HardDrive },
  ];

  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-10">
        <h1 className="text-4xl font-extrabold font-headline tracking-tighter mb-2">설정</h1>
        <p className="text-on-surface-variant">계정 및 워크스페이스 환경을 관리하세요.</p>
        {isAdmin && (
          <span className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            <Crown className="w-3 h-3" /> 관리자 계정
          </span>
        )}
      </header>

      <div className="flex gap-8 items-start">
        {/* Sidebar */}
        <nav className="w-56 shrink-0 space-y-1">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left',
                activeTab === tab.id
                  ? 'bg-primary/10 text-primary border-l-2 border-secondary'
                  : 'text-on-surface-variant hover:bg-white/5 hover:text-white'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.adminOnly && (
                <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary">ADMIN</span>
              )}
            </button>
          ))}
          <div className="pt-4 mt-4 border-t border-white/5">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-error hover:bg-error/10 transition-all text-left"
            >
              <LogOut className="w-4 h-4" /> 로그아웃
            </button>
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1">

          {/* ── 프로필 ─────────────────────────────────────────── */}
          {activeTab === 'profile' && (
            <div className="bg-surface-container rounded-2xl p-8 space-y-8">
              <h2 className="font-headline font-bold text-lg mb-6">프로필 정보</h2>
              <div className="flex items-center gap-6 mb-8">
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-surface font-bold text-2xl font-headline shadow-lg shadow-primary/20">
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <button className="absolute -bottom-2 -right-2 w-7 h-7 bg-surface-container-highest rounded-full flex items-center justify-center border border-white/10 hover:bg-surface-bright transition-colors">
                    <Camera className="w-3.5 h-3.5 text-on-surface-variant" />
                  </button>
                </div>
                <div>
                  <h3 className="font-bold text-on-surface">{user?.name}</h3>
                  <p className={cn('text-sm font-semibold mt-0.5', isAdmin ? 'text-primary' : 'text-on-surface-variant')}>{user?.role}</p>
                  <p className="text-on-surface-variant/50 text-xs mt-1">가입일: {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('ko-KR') : '—'}</p>
                </div>
              </div>
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">이름</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                    <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)}
                      className="w-full bg-surface-container-highest rounded-xl py-[1.2rem] pl-11 pr-4 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-low transition-all" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">이메일</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                    <input type="email" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)}
                      className="w-full bg-surface-container-highest rounded-xl py-[1.2rem] pl-11 pr-4 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-low transition-all" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={handleProfileSave} disabled={profileSaving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-primary to-secondary text-surface shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-wait">
                  <Save className="w-4 h-4" /> {profileSaving ? '저장 중...' : '변경사항 저장'}
                </button>
              </div>
            </div>
          )}

          {/* ── 알림 ─────────────────────────────────────────────── */}
          {activeTab === 'notifications' && (
            <div className="bg-surface-container rounded-2xl p-8 space-y-6">
              <h2 className="font-headline font-bold text-lg mb-6">알림 설정</h2>
              {[
                { key: 'mention',  label: '멘션 알림',      desc: '@멘션 시 알림을 받습니다' },
                { key: 'channel',  label: '채널 메시지',    desc: '새 채널 메시지 수신 시 알림' },
                { key: 'project',  label: '프로젝트 업데이트', desc: '프로젝트 상태 변경 알림' },
                { key: 'deadline', label: '마감일 리마인더', desc: '마감 24시간 전 알림' },
                { key: 'activity', label: '팀원 활동',      desc: '팀원의 파일 업로드/수정 알림' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-4 border-b border-white/[0.04] last:border-0">
                  <div>
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="text-on-surface-variant text-xs mt-0.5">{item.desc}</p>
                  </div>
                  <Toggle enabled={notif[item.key as keyof typeof notif]} onToggle={() => toggleNotif(item.key)} />
                </div>
              ))}
            </div>
          )}

          {/* ── 외관 ─────────────────────────────────────────────── */}
          {activeTab === 'appearance' && (
            <div className="bg-surface-container rounded-2xl p-8">
              <h2 className="font-headline font-bold text-lg mb-6">외관 설정</h2>
              <div className="space-y-8">

                {/* 테마 */}
                <div>
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4">테마</p>
                  <div className="grid grid-cols-2 gap-4">
                    {/* 다크 테마 */}
                    {[
                      { label: '다크 (기본)', index: 0, preview: (
                        <div className="w-full h-20 rounded-lg overflow-hidden mb-3 flex">
                          <div className="w-1/4 bg-[#131313]" />
                          <div className="flex-1 bg-[#0e0e0e] p-2 flex flex-col gap-1.5">
                            <div className="h-2 w-3/4 rounded-full bg-[#1a1a1a]" />
                            <div className="h-2 w-1/2 rounded-full bg-[#1a1a1a]" />
                            <div className="h-2 w-2/3 rounded-full" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }} />
                          </div>
                        </div>
                      )},
                      { label: '화이트', index: 1, preview: (
                        <div className="w-full h-20 rounded-lg overflow-hidden mb-3 flex">
                          <div className="w-1/4 bg-[#efefee]" />
                          <div className="flex-1 bg-[#f5f5f4] p-2 flex flex-col gap-1.5">
                            <div className="h-2 w-3/4 rounded-full bg-[#e8e8e6]" />
                            <div className="h-2 w-1/2 rounded-full bg-[#e8e8e6]" />
                            <div className="h-2 w-2/3 rounded-full" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }} />
                          </div>
                        </div>
                      )},
                    ].map(({ label, index, preview }) => (
                      <button key={label} onClick={() => setTheme(index)}
                        className={cn('p-4 rounded-xl text-sm font-medium transition-all text-left',
                          appearance.theme === index
                            ? 'bg-primary/10 ring-1 ring-primary/40 text-primary'
                            : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-bright'
                        )}>
                        {preview}
                        <div className="flex items-center gap-1.5">
                          {appearance.theme === index && <Check className="w-3 h-3" />}
                          {label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 액센트 컬러 */}
                <div>
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4">액센트 컬러</p>
                  <div className="flex gap-3 flex-wrap">
                    {ACCENT_PALETTES.map((palette, i) => (
                      <button key={palette.label} onClick={() => setAccent(i)} title={palette.label}
                        className={cn('flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all',
                          appearance.accent === i
                            ? 'bg-surface-container-highest ring-1 ring-white/20 text-on-surface'
                            : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                        )}>
                        <span className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})` }} />
                        {palette.label}
                        {appearance.accent === i && <Check className="w-3 h-3 ml-0.5 text-primary" />}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ── 보안 ─────────────────────────────────────────────── */}
          {activeTab === 'security' && (
            <div className="bg-surface-container rounded-2xl p-8 space-y-6">
              <h2 className="font-headline font-bold text-lg mb-6">보안 설정</h2>
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">현재 비밀번호</label>
                  <input type="password" value={curPwd} onChange={(e) => setCurPwd(e.target.value)} placeholder="••••••••"
                    className="w-full bg-surface-container-highest rounded-xl py-[1.2rem] px-4 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-low transition-all placeholder:text-on-surface-variant/40" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">새 비밀번호</label>
                  <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="••••••••"
                    className="w-full bg-surface-container-highest rounded-xl py-[1.2rem] px-4 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-low transition-all placeholder:text-on-surface-variant/40" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">새 비밀번호 확인</label>
                  <input type="password" value={confPwd} onChange={(e) => setConfPwd(e.target.value)} placeholder="••••••••"
                    className={cn('w-full bg-surface-container-highest rounded-xl py-[1.2rem] px-4 text-sm border-none focus:outline-none focus:ring-2 transition-all placeholder:text-on-surface-variant/40',
                      confPwd && newPwd !== confPwd ? 'ring-2 ring-error/40 focus:ring-error/40' : 'focus:ring-primary/20 focus:bg-surface-container-low'
                    )} />
                  {confPwd && newPwd !== confPwd && (
                    <p className="text-xs text-error mt-1">비밀번호가 일치하지 않습니다.</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button onClick={handlePasswordChange} disabled={pwdSaving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-primary to-secondary text-surface shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-wait">
                  <Shield className="w-4 h-4" /> {pwdSaving ? '변경 중...' : '비밀번호 변경'}
                </button>
              </div>
            </div>
          )}

          {/* ── 사용자 관리 (Admin) ───────────────────────────────── */}
          {activeTab === 'users' && isAdmin && (
            <UserManagement currentUserId={user?.id ?? ''} toast={toast} />
          )}

          {/* ── 팀 관리 (Admin) ──────────────────────────────────── */}
          {activeTab === 'teams' && isAdmin && (
            <TeamManagement toast={toast} />
          )}

          {/* ── 권한 관리 (Admin) ─────────────────────────────────── */}
          {activeTab === 'permissions' && isAdmin && (
            <PermissionManagement currentUserId={user?.id ?? ''} toast={toast} />
          )}

          {/* ── 스토리지 설정 ──────────────────────────────── */}
          {activeTab === 'storage' && (
            <StorageSettings toast={toast} isAdmin={isAdmin} currentUserId={user?.id ?? ''} />
          )}

        </div>
      </div>
    </div>
  );
}

// ── 사용자 관리 컴포넌트 ──────────────────────────────────────────────────────
function UserManagement({ currentUserId, toast }: { currentUserId: string; toast: (msg: string, type: any) => void }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  async function loadUsers() {
    setLoading(true);
    const res = await apiFetch('/api/auth/users', {});
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleDelete(u: ManagedUser) {
    if (deleteConfirm !== u.id) { setDeleteConfirm(u.id); return; }
    const res = await apiFetch(`/api/auth/users/${u.id}`, { method: 'DELETE', credentials: 'include' });
    const data = await res.json();
    if (!res.ok) { toast(data.error, 'info'); setDeleteConfirm(null); return; }
    toast(`"${u.name}" 계정이 삭제되었습니다.`, 'info');
    setDeleteConfirm(null);
    loadUsers();
  }

  if (loading) return <div className="bg-surface-container rounded-2xl p-8 text-on-surface-variant text-sm">불러오는 중...</div>;

  const filtered = search.trim()
    ? users.filter((u) =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
      )
    : users;

  return (
    <div className="bg-surface-container rounded-2xl p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-headline font-bold text-lg">사용자 관리</h2>
          <p className="text-xs text-on-surface-variant mt-1">
            총 {users.length}명의 가입 유저{search && ` · 검색 결과 ${filtered.length}명`}
          </p>
        </div>
      </div>

      {/* 검색 */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름 또는 이메일로 검색..."
          className="w-full bg-surface-container-highest rounded-xl py-2.5 pl-10 pr-10 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-on-surface-variant/40 transition-all"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-on-surface transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="py-10 text-center text-on-surface-variant/50 text-sm">검색 결과가 없습니다.</div>
        )}
        {filtered.map((u) => (
          <div key={u.id}
            className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-all group">
            {/* Avatar */}
            <div className={cn(
              'w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-sm font-bold text-surface shrink-0',
              u.role === 'Admin' ? 'from-primary to-secondary' : 'from-secondary to-tertiary'
            )}>
              {u.name.charAt(0)}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm truncate">{u.name}</p>
                {u.isMe && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-on-surface-variant">나</span>}
                {u.role === 'Admin' && <Crown className="w-3 h-3 text-primary shrink-0" />}
              </div>
              <p className="text-xs text-on-surface-variant truncate">{u.email}</p>
            </div>
            {/* Role badge */}
            <span className={cn(
              'text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0',
              u.role === 'Admin'
                ? 'bg-primary/15 text-primary border border-primary/20'
                : 'bg-white/5 text-on-surface-variant'
            )}>
              {u.role === 'Admin' ? '관리자' : '사용자'}
            </span>
            {/* Joined date */}
            <p className="text-[11px] text-on-surface-variant/50 shrink-0 hidden lg:block">
              {new Date(u.createdAt).toLocaleDateString('ko-KR')}
            </p>
            {/* Delete */}
            {!u.isMe && (
              <button
                onClick={() => handleDelete(u)}
                onBlur={() => setTimeout(() => setDeleteConfirm(null), 200)}
                className={cn(
                  'opacity-0 group-hover:opacity-100 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0',
                  deleteConfirm === u.id
                    ? 'opacity-100 bg-error text-white'
                    : 'bg-error/10 text-error hover:bg-error/20'
                )}
              >
                <Trash2 className="w-3 h-3" />
                {deleteConfirm === u.id ? '확인' : '삭제'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 권한 관리 컴포넌트 ────────────────────────────────────────────────────────

// 시스템에서 허용하는 전체 권한 목록
const ALL_PERMISSIONS = [
  '사용자 관리 및 삭제',
  '권한 변경',
  '프로젝트 전체 관리',
  '모든 설정 접근',
  '프로젝트 참여',
  '태스크 관리',
  '채팅 및 파일 접근',
  '본인 설정 변경',
  '파일 업로드',
  '댓글 작성',
  '보고서 열람',
  '팀원 초대',
] as const;

const DEFAULT_PERMS: Record<string, string[]> = {
  Admin:  ['사용자 관리 및 삭제', '권한 변경', '프로젝트 전체 관리', '모든 설정 접근'],
  Member: ['프로젝트 참여', '태스크 관리', '채팅 및 파일 접근', '본인 설정 변경'],
};
// ─── 팀 관리 컴포넌트 ─────────────────────────────────────────────────────────
interface TeamData {
  id: string; name: string; color: string; description: string | null;
  members: { id: string; name: string; email: string; role: string; userRole: string }[];
}
interface RegUser { id: string; name: string; email: string; role: string; }

const TEAM_COLORS = [
  { label: '블루',  value: 'primary' },
  { label: '보라',  value: 'secondary' },
  { label: '핑크',  value: 'tertiary' },
  { label: '에러',  value: 'error' },
];
const colorGradient: Record<string, string> = {
  primary: 'from-primary to-primary-dim', secondary: 'from-secondary to-secondary-dim',
  tertiary: 'from-tertiary to-tertiary-dim', error: 'from-error to-error/60',
};

function TeamManagement({ toast }: { toast: (msg: string, type: any) => void }) {
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [allUsers, setAllUsers] = useState<RegUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState('primary');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [addMemberTeam, setAddMemberTeam] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [teamsRes, usersRes] = await Promise.all([
        apiFetch('/api/data/teams').then(r => r.ok ? r.json() : { teams: [] }),
        apiFetch('/api/auth/users').then(r => r.ok ? r.json() : { users: [] }),
      ]);
      setTeams(teamsRes.teams ?? []);
      setAllUsers(usersRes.users ?? []);
    } catch {
      // 에러 시에도 로딩 종료
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function handleCreateTeam() {
    if (!newTeamName.trim()) return;
    try {
      const res = await apiFetch('/api/data/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTeamName.trim(), color: newTeamColor, description: newTeamDesc.trim() || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setTeams(prev => [...prev, { ...data, members: [] }]);
        toast(`"${newTeamName.trim()}" 팀이 생성되었습니다.`, 'success');
        setCreateOpen(false); setNewTeamName(''); setNewTeamColor('primary'); setNewTeamDesc('');
      } else {
        toast(data.error ?? '팀 생성에 실패했습니다.', 'error');
      }
    } catch (e: any) {
      toast('네트워크 오류: ' + e.message, 'error');
    }
  }

  async function handleDeleteTeam(id: string, name: string) {
    await apiFetch(`/api/data/teams/${id}`, { method: 'DELETE', credentials: 'include' });
    setTeams(prev => prev.filter(t => t.id !== id));
    toast(`"${name}" 팀이 삭제되었습니다.`, 'info');
  }

  async function handleAddMember(teamId: string, userId: string) {
    await apiFetch(`/api/data/teams/${teamId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const u = allUsers.find(u => u.id === userId)!;
    setTeams(prev => prev.map(t => t.id === teamId
      ? { ...t, members: [...t.members, { id: u.id, name: u.name, email: u.email, role: 'member', userRole: u.role }] }
      : t
    ));
    toast(`${u.name}님이 팀에 추가되었습니다.`, 'success');
  }

  async function handleRemoveMember(teamId: string, userId: string, name: string) {
    await apiFetch(`/api/data/teams/${teamId}/members/${userId}`, { method: 'DELETE', credentials: 'include' });
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, members: t.members.filter(m => m.id !== userId) } : t));
    toast(`${name}님이 팀에서 제거되었습니다.`, 'info');
  }

  if (loading) return <div className="flex items-center justify-center h-32"><div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-headline font-bold text-lg">팀 관리</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">팀을 만들고 사용자를 배정하세요.</p>
        </div>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-secondary text-surface text-sm font-bold hover:opacity-90 transition-all">
          <Plus className="w-4 h-4" /> 팀 생성
        </button>
      </div>

      {/* Create modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCreateOpen(false)} />
          <div className="relative w-full max-w-md bg-surface-container rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="font-headline font-bold text-lg">새 팀 생성</h3>
              <button onClick={() => setCreateOpen(false)} className="w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center text-on-surface-variant"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">팀 이름 *</label>
              <input autoFocus value={newTeamName} onChange={e => setNewTeamName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateTeam()}
                placeholder="ex) 디자인팀" className="w-full bg-surface-container-highest rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">색상</label>
              <div className="flex gap-2">
                {TEAM_COLORS.map(c => (
                  <button key={c.value} onClick={() => setNewTeamColor(c.value)}
                    className={cn('flex-1 py-2 rounded-lg text-xs font-bold transition-all',
                      newTeamColor === c.value ? 'bg-primary/20 text-primary ring-1 ring-primary/40' : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-bright')}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">설명</label>
              <input value={newTeamDesc} onChange={e => setNewTeamDesc(e.target.value)} placeholder="팀 설명 (선택)"
                className="w-full bg-surface-container-highest rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setCreateOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-white/5 transition-all">취소</button>
              <button onClick={handleCreateTeam} disabled={!newTeamName.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-primary to-secondary text-surface hover:opacity-90 transition-all disabled:opacity-40">생성</button>
            </div>
          </div>
        </div>
      )}

      {/* Teams list */}
      {teams.length === 0 ? (
        <div className="bg-surface-container rounded-2xl p-12 text-center text-on-surface-variant/40 text-sm">
          아직 팀이 없습니다. 첫 번째 팀을 만들어보세요.
        </div>
      ) : (
        <div className="space-y-4">
          {teams.map(team => {
            const nonMembers = allUsers.filter(u => !team.members.find(m => m.id === u.id));
            const filtered = nonMembers.filter(u =>
              !memberSearch || u.name.toLowerCase().includes(memberSearch.toLowerCase()) || u.email.toLowerCase().includes(memberSearch.toLowerCase())
            );
            return (
              <div key={team.id} className="bg-surface-container rounded-2xl overflow-hidden">
                <div className={cn('h-1 w-full bg-gradient-to-r', colorGradient[team.color] ?? colorGradient.primary)} />
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-headline font-bold text-base">{team.name}</h3>
                      {team.description && <p className="text-xs text-on-surface-variant mt-0.5">{team.description}</p>}
                      <p className="text-xs text-on-surface-variant/60 mt-1">{team.members.length}명</p>
                    </div>
                    <button onClick={() => handleDeleteTeam(team.id, team.name)}
                      className="p-2 rounded-lg hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Member list */}
                  <div className="space-y-2 mb-4">
                    {team.members.map(m => (
                      <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-surface-container-high/50">
                        <div className="flex items-center gap-3">
                          <div className={cn('w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center text-[10px] font-bold text-surface', colorGradient[team.color] ?? colorGradient.primary)}>
                            {m.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-on-surface">{m.name}</p>
                            <p className="text-[11px] text-on-surface-variant">{m.email}</p>
                          </div>
                          {m.userRole === 'Admin' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary">ADMIN</span>
                          )}
                        </div>
                        <button onClick={() => handleRemoveMember(team.id, m.id, m.name)}
                          className="p-1.5 rounded-lg hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {team.members.length === 0 && (
                      <p className="text-xs text-on-surface-variant/40 text-center py-4">아직 팀원이 없습니다.</p>
                    )}
                  </div>

                  {/* Add member */}
                  {addMemberTeam === team.id ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant" />
                        <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                          autoFocus placeholder="이름 또는 이메일 검색..."
                          className="w-full bg-surface-container-highest rounded-xl py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {filtered.length === 0 ? (
                          <p className="text-xs text-on-surface-variant/40 text-center py-3">추가할 수 있는 사용자가 없습니다.</p>
                        ) : filtered.map(u => (
                          <button key={u.id} onClick={() => { handleAddMember(team.id, u.id); setMemberSearch(''); }}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 text-left transition-colors">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/50 to-secondary/50 flex items-center justify-center text-[10px] font-bold text-surface shrink-0">
                              {u.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{u.name}</p>
                              <p className="text-[11px] text-on-surface-variant">{u.email}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                      <button onClick={() => { setAddMemberTeam(null); setMemberSearch(''); }}
                        className="text-xs text-on-surface-variant hover:text-on-surface transition-colors">취소</button>
                    </div>
                  ) : (
                    <button onClick={() => setAddMemberTeam(team.id)}
                      className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-secondary transition-colors">
                      <Plus className="w-3.5 h-3.5" /> 팀원 추가
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PermissionManagement({ currentUserId, toast }: { currentUserId: string; toast: (msg: string, type: any) => void }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState<string | null>(null);
  const [rolePerms, setRolePerms] = useState<Record<string, string[]>>(DEFAULT_PERMS);
  const [addingTo, setAddingTo] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/api/data/global-settings/role_permissions')
      .then(r => r.ok ? r.json() : { value: null })
      .then(({ value }) => { if (value) setRolePerms(value); })
      .catch(() => {});
  }, []);

  async function loadUsers() {
    setLoading(true);
    const res = await apiFetch('/api/auth/users', {});
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }

  useEffect(() => { loadUsers(); }, []);

  function savePerms(updated: Record<string, string[]>) {
    setRolePerms(updated);
    apiFetch('/api/data/global-settings/role_permissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: updated }),
    }).catch(() => {});
  }

  function removePerm(role: string, perm: string) {
    const updated = { ...rolePerms, [role]: rolePerms[role].filter((p) => p !== perm) };
    savePerms(updated);
    toast(`"${perm}" 권한이 제거되었습니다.`, 'info');
  }

  function addPerm(role: string, perm: string) {
    const updated = { ...rolePerms, [role]: [...(rolePerms[role] ?? []), perm] };
    savePerms(updated);
    setAddingTo(null);
    toast(`"${perm}" 권한이 추가되었습니다.`, 'success');
  }

  async function handleRoleChange(u: ManagedUser, newRole: 'Admin' | 'Member') {
    if (newRole === u.role) return;
    setChanging(u.id);
    const res = await apiFetch(`/api/auth/users/${u.id}/role`, {
      method: 'PATCH',

      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    const data = await res.json();
    setChanging(null);
    if (!res.ok) { toast(data.error, 'info'); return; }
    toast(`"${u.name}" 권한이 ${newRole === 'Admin' ? '관리자' : '사용자'}로 변경되었습니다.`, 'success');
    loadUsers();
  }

  if (loading) return <div className="bg-surface-container rounded-2xl p-8 text-on-surface-variant text-sm">불러오는 중...</div>;

  const adminCount = users.filter((u) => u.role === 'Admin').length;

  const roleDefs = [
    { role: 'Admin',  label: '관리자', color: 'from-primary/20 to-secondary/10', border: 'border-primary/20', text: 'text-primary',      icon: Crown },
    { role: 'Member', label: '사용자', color: 'from-white/5 to-white/[0.02]',    border: 'border-white/5',   text: 'text-on-surface',   icon: User  },
  ];

  return (
    <div className="bg-surface-container rounded-2xl p-8">
      <div className="mb-6">
        <h2 className="font-headline font-bold text-lg">권한 관리</h2>
        <p className="text-xs text-on-surface-variant mt-1">팀원별 권한을 설정하세요.</p>
      </div>

      {/* 권한 설명 카드 (편집 가능) */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {roleDefs.map((r) => (
          <div key={r.role} className={cn('rounded-xl p-5 bg-gradient-to-br border', r.color, r.border)}>
            <div className={cn('flex items-center gap-2 font-bold text-sm mb-3', r.text)}>
              <r.icon className="w-4 h-4" /> {r.label}
              <span className="ml-auto text-xs font-normal text-on-surface-variant">
                {users.filter((u) => u.role === r.role).length}명
              </span>
            </div>
            <ul className="space-y-1.5 mb-3">
              {(rolePerms[r.role] ?? []).map((p) => (
                <li key={p} className="flex items-center gap-2 text-xs text-on-surface-variant group/perm">
                  <Check className="w-3 h-3 text-primary/60 shrink-0" />
                  <span className="flex-1">{p}</span>
                  <button
                    onClick={() => removePerm(r.role, p)}
                    className="opacity-0 group-hover/perm:opacity-100 text-error/60 hover:text-error transition-all shrink-0"
                    title="권한 제거"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>

            {/* 권한 추가 */}
            {(() => {
              const available = ALL_PERMISSIONS.filter((p) => !(rolePerms[r.role] ?? []).includes(p));
              return addingTo === r.role ? (
                <div className="mt-2 relative">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-on-surface-variant/50 font-medium">추가할 권한 선택</span>
                    <button onClick={() => setAddingTo(null)} className="text-on-surface-variant/40 hover:text-on-surface transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  {available.length === 0 ? (
                    <p className="text-[11px] text-on-surface-variant/40 py-1">추가 가능한 권한이 없습니다.</p>
                  ) : (
                    <div className="bg-black/30 rounded-xl border border-white/10 overflow-hidden">
                      {available.map((p) => (
                        <button
                          key={p}
                          onClick={() => addPerm(r.role, p)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-on-surface-variant hover:bg-primary/10 hover:text-primary transition-colors text-left"
                        >
                          <Plus className="w-3 h-3 shrink-0" />
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setAddingTo(r.role)}
                  disabled={ALL_PERMISSIONS.filter((p) => !(rolePerms[r.role] ?? []).includes(p)).length === 0}
                  className="flex items-center gap-1.5 text-[11px] text-on-surface-variant/50 hover:text-primary transition-colors mt-1 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3 h-3" /> 권한 추가
                </button>
              );
            })()}
          </div>
        ))}
      </div>

      {/* 유저 권한 목록 */}
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id}
            className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-all">
            <div className={cn(
              'w-9 h-9 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-bold text-surface shrink-0',
              u.role === 'Admin' ? 'from-primary to-secondary' : 'from-secondary to-tertiary'
            )}>
              {u.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm">{u.name}</p>
                {u.isMe && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-on-surface-variant">나</span>}
              </div>
              <p className="text-xs text-on-surface-variant">{u.email}</p>
            </div>

            {u.isMe ? (
              <span className="text-xs text-on-surface-variant italic">변경 불가 (본인)</span>
            ) : (
              <RoleSelector
                current={u.role}
                disabled={changing === u.id}
                onChange={(r) => handleRoleChange(u, r)}
              />
            )}
          </div>
        ))}
      </div>

      {adminCount === 0 && (
        <p className="mt-4 text-xs text-error text-center">관리자가 없습니다. 최소 1명의 관리자가 필요합니다.</p>
      )}
    </div>
  );
}

// ── Role 드롭다운 ─────────────────────────────────────────────────────────────
function RoleSelector({ current, disabled, onChange }: {
  current: 'Admin' | 'Member';
  disabled: boolean;
  onChange: (role: 'Admin' | 'Member') => void;
}) {
  const [open, setOpen] = useState(false);
  const options: { value: 'Admin' | 'Member'; label: string }[] = [
    { value: 'Admin', label: '관리자' },
    { value: 'Member', label: '사용자' },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all border',
          current === 'Admin'
            ? 'bg-primary/10 text-primary border-primary/20'
            : 'bg-white/5 text-on-surface-variant border-white/5',
          disabled ? 'opacity-50 cursor-wait' : 'hover:bg-white/10 cursor-pointer'
        )}
      >
        {current === 'Admin' ? <Crown className="w-3 h-3" /> : <User className="w-3 h-3" />}
        {current === 'Admin' ? '관리자' : '사용자'}
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-32 bg-surface-container-highest/95 backdrop-blur-xl rounded-xl border border-white/5 shadow-[0_8px_24px_rgba(0,0,0,0.5)] overflow-hidden z-50">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={cn(
                  'w-full px-3 py-2.5 text-left text-xs font-bold flex items-center gap-2 transition-colors',
                  current === opt.value ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:bg-white/5 hover:text-on-surface'
                )}
              >
                {opt.value === 'Admin' ? <Crown className="w-3 h-3" /> : <User className="w-3 h-3" />}
                {opt.label}
                {current === opt.value && <Check className="w-3 h-3 ml-auto" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      className={cn('relative w-11 h-6 rounded-full transition-all duration-300 shrink-0',
        enabled ? 'bg-gradient-to-r from-primary to-secondary shadow-lg shadow-primary/20' : 'bg-surface-container-highest'
      )}>
      <span className={cn('absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300', enabled && 'translate-x-5')} />
    </button>
  );
}

// ── 스토리지 설정 컴포넌트 ──────────────────────────────────────────────────

interface StorageConnection {
  id: string;
  type: 'google-drive' | 'nas' | 'local';
  label: string;
  config: Record<string, string>;
  connected: boolean;
  sharing: 'all' | 'private';   // 전체 공유 | 개인
  ownerId?: string;              // 등록한 사용자 ID
}

function StorageSettings({ toast, isAdmin, currentUserId }: {
  toast: (msg: string, type: any) => void;
  isAdmin: boolean;
  currentUserId: string;
}) {
  const { user } = useAuth();
  const [connections, setConnections] = useState<StorageConnection[]>([]);
  const [addType, setAddType] = useState<'google-drive' | 'nas' | 'local' | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [sharing, setSharing] = useState<'all' | 'private'>('private');
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/api/data/storage/connections')
      .then(r => r.ok ? r.json() : { value: [] })
      .then(({ value }) => { if (Array.isArray(value)) setConnections(value); })
      .catch(() => {});
  }, []);

  function saveConnections(list: StorageConnection[]) {
    setConnections(list);
    apiFetch('/api/data/storage/connections', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: list }),
    });
  }

  function handleConnect() {
    if (!addType) return;
    let label = '';
    if (addType === 'google-drive') label = 'Google Drive';
    else if (addType === 'nas') label = formData.name || 'NAS 스토리지';
    else label = formData.name || '로컬 스토리지';

    // 일반 사용자는 무조건 개인 공유
    const effectiveSharing: 'all' | 'private' = isAdmin ? sharing : 'private';

    if (editId) {
      // 수정 모드
      const updated = connections.map(c =>
        c.id === editId ? { ...c, label, config: { ...formData }, sharing: effectiveSharing } : c
      );
      saveConnections(updated);
      toast(`"${label}" 정보가 수정되었습니다.`, 'success');
    } else {
      // 신규 추가
      const id = Date.now().toString();
      const newConn: StorageConnection = {
        id, type: addType, label, config: { ...formData },
        connected: true, sharing: effectiveSharing, ownerId: user?.id,
      };
      saveConnections([...connections, newConn]);
      toast(`"${label}" 스토리지가 연결되었습니다.`, 'success');
    }
    setAddType(null);
    setFormData({});
    setSharing('private');
    setEditId(null);
  }

  function handleEdit(conn: StorageConnection) {
    setEditId(conn.id);
    setAddType(conn.type);
    setFormData({ ...conn.config });
    setSharing(conn.sharing ?? 'private');
  }

  function handleCancelForm() {
    setAddType(null);
    setFormData({});
    setSharing('private');
    setEditId(null);
  }

  function handleDisconnect(id: string) {
    const conn = connections.find(c => c.id === id);
    const updated = connections.filter(c => c.id !== id);
    saveConnections(updated);
    if (conn) toast(`"${conn.label}" 연결이 해제되었습니다.`, 'info');
  }

  const typeInfo = {
    'google-drive': { icon: Cloud, color: 'text-primary', bg: 'bg-primary/10', label: 'Google Drive' },
    nas:            { icon: Database, color: 'text-secondary', bg: 'bg-secondary/10', label: 'NAS / DAS' },
    local:          { icon: HardDrive, color: 'text-tertiary', bg: 'bg-tertiary/10', label: '로컬 경로' },
  };

  return (
    <div className="space-y-6">
      {/* Connected storages */}
      <div className="bg-surface-container rounded-2xl p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-headline font-bold text-lg">스토리지 설정</h2>
            <p className="text-xs text-on-surface-variant mt-1">클라우드 및 로컬 스토리지를 연결하여 파일을 관리하세요.</p>
          </div>
        </div>

        {connections.length === 0 && !addType && (
          <div className="py-10 flex flex-col items-center gap-3 text-on-surface-variant/50">
            <HardDrive className="w-10 h-10 opacity-30" />
            <p className="text-sm">연결된 스토리지가 없습니다.</p>
          </div>
        )}

        <div className="space-y-3 mb-6">
          {connections.map((conn) => {
            const info = typeInfo[conn.type];
            const Icon = info.icon;
            return (
              <div key={conn.id} className="flex items-center gap-4 bg-surface-container-highest rounded-xl px-5 py-4">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', info.bg)}>
                  <Icon className={cn('w-5 h-5', info.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-on-surface text-sm">{conn.label}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {conn.type === 'google-drive' && conn.config.clientId ? `Client ID: ${conn.config.clientId.slice(0, 20)}...` : ''}
                    {conn.type === 'nas' && (conn.config.path || conn.config.host) ? (conn.config.path || `${conn.config.host}:${conn.config.port || '22'}`) : ''}
                    {conn.type === 'local' && conn.config.path ? conn.config.path : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* 공유 뱃지 */}
                  {conn.sharing === 'all'
                    ? <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-primary/10 text-primary"><Globe className="w-2.5 h-2.5" />전체 공유</span>
                    : <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-surface-container-highest text-on-surface-variant"><Lock className="w-2.5 h-2.5" />개인</span>
                  }
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-tertiary/10 text-tertiary">연결됨</span>
                  {/* 수정/삭제: 관리자 전체 허용, 일반 사용자는 본인 local만 */}
                  {(isAdmin || (conn.ownerId === currentUserId && conn.type === 'local')) && (
                    <>
                      <button
                        onClick={() => handleEdit(conn)}
                        className="p-2 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all"
                        title="수정"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDisconnect(conn.id)}
                        className="p-2 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-all"
                        title="연결 해제"
                      >
                        <Unlink className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add new connection buttons */}
        {!addType && (
          <div className="grid grid-cols-3 gap-3">
            {(['google-drive', 'nas', 'local'] as const).filter(t => isAdmin || t === 'local').map((t) => {
              const info = typeInfo[t];
              const Icon = info.icon;
              return (
                <button
                  key={t}
                  onClick={() => { setAddType(t); setFormData({}); }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface-container-highest hover:bg-surface-bright transition-all group"
                >
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', info.bg)}>
                    <Icon className={cn('w-5 h-5', info.color)} />
                  </div>
                  <span className="text-xs font-bold text-on-surface-variant group-hover:text-on-surface transition-colors">{info.label}</span>
                  <span className="text-[10px] text-on-surface-variant/50">+ 연결 추가</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Connection form */}
        {addType && (
          <div className="bg-surface-container-highest rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-sm">{typeInfo[addType].label} {editId ? '수정' : '연결'}</h3>
              <button onClick={handleCancelForm} className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {addType === 'google-drive' && (
              <>
                <FormField label="Client ID" placeholder="Google OAuth 2.0 Client ID"
                  value={formData.clientId ?? ''} onChange={v => setFormData(p => ({ ...p, clientId: v }))} />
                <FormField label="Client Secret" placeholder="Client Secret" type="password"
                  value={formData.clientSecret ?? ''} onChange={v => setFormData(p => ({ ...p, clientSecret: v }))} />
                <FormField label="API Key" placeholder="Google Drive API Key"
                  value={formData.apiKey ?? ''} onChange={v => setFormData(p => ({ ...p, apiKey: v }))} />
              </>
            )}

            {addType === 'nas' && (
              <>
                <FormField label="스토리지 이름" placeholder="예: 사무실 NAS"
                  value={formData.name ?? ''} onChange={v => setFormData(p => ({ ...p, name: v }))} />
                <FormField label="마운트 경로 / UNC 경로" placeholder="예: \\\\192.168.1.100\\공유폴더 또는 Z:\\"
                  value={formData.path ?? ''} onChange={v => setFormData(p => ({ ...p, path: v }))} />
                <FormField label="호스트 / IP" placeholder="예: 192.168.1.100"
                  value={formData.host ?? ''} onChange={v => setFormData(p => ({ ...p, host: v }))} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="포트" placeholder="22 (SFTP)"
                    value={formData.port ?? ''} onChange={v => setFormData(p => ({ ...p, port: v }))} />
                  <FormField label="프로토콜" placeholder="SFTP / SMB"
                    value={formData.protocol ?? ''} onChange={v => setFormData(p => ({ ...p, protocol: v }))} />
                </div>
                <FormField label="사용자명" placeholder="username"
                  value={formData.username ?? ''} onChange={v => setFormData(p => ({ ...p, username: v }))} />
                <FormField label="비밀번호" placeholder="password" type="password"
                  value={formData.password ?? ''} onChange={v => setFormData(p => ({ ...p, password: v }))} />
              </>
            )}

            {addType === 'local' && (
              <>
                <FormField label="스토리지 이름" placeholder="예: 로컬 문서"
                  value={formData.name ?? ''} onChange={v => setFormData(p => ({ ...p, name: v }))} />
                <FormField label="경로" placeholder="예: /mnt/data 또는 D:\\Documents"
                  value={formData.path ?? ''} onChange={v => setFormData(p => ({ ...p, path: v }))} />
              </>
            )}

            {/* 공개 범위 토글 — 관리자만 */}
            {isAdmin && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">공개 범위</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSharing('private')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all',
                      sharing === 'private'
                        ? 'bg-surface-container text-on-surface ring-2 ring-primary/30'
                        : 'bg-surface-container/50 text-on-surface-variant hover:bg-surface-container'
                    )}
                  >
                    <Lock className="w-3.5 h-3.5" /> 개인 (나만 보기)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSharing('all')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all',
                      sharing === 'all'
                        ? 'bg-primary/10 text-primary ring-2 ring-primary/30'
                        : 'bg-surface-container/50 text-on-surface-variant hover:bg-surface-container'
                    )}
                  >
                    <Globe className="w-3.5 h-3.5" /> 전체 공유 (모든 팀원)
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={handleCancelForm}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-on-surface-variant bg-surface-container hover:bg-surface-bright transition-all">취소</button>
              <button onClick={handleConnect}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-primary to-secondary text-surface shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2">
                {editId ? <><Check className="w-4 h-4" /> 저장하기</> : <><Link className="w-4 h-4" /> 연결하기</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FormField({ label, placeholder, value, onChange, type = 'text' }: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-surface-container rounded-xl px-4 py-3 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-on-surface-variant/40" />
    </div>
  );
}
