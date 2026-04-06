import React, { useState, useRef, useEffect } from 'react';
import { apiFetch } from '../lib/apiFetch';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, UserPlus, ChevronRight,
  LayoutGrid, CheckCircle2, Clock, Users, Edit3, X, Check,
  Calendar, Tag, ExternalLink,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import { type ProjectMember, type KanbanTask } from '../contexts/AppContext';

const TAG_OPTIONS = ['UI 디자인', '프론트엔드', '백엔드', '브랜딩', '시스템', '리서치', '성공'];
type ColorType = 'primary' | 'secondary' | 'tertiary';

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

const ROLE_SUGGESTIONS = [
  '프로젝트 리더', 'UX 디자이너', '프론트엔드', '백엔드', 'QA 엔지니어',
  '기획', '브랜드 디자이너', '마케터', '모션 그래픽', '카피라이터',
];

const MEMBER_COLORS: ProjectMember['color'][] = ['primary', 'secondary', 'tertiary'];
const colorGrad: Record<ProjectMember['color'], string> = {
  primary: 'from-primary to-primary-dim',
  secondary: 'from-secondary to-secondary-dim',
  tertiary: 'from-tertiary to-tertiary-dim',
};
const colorText: Record<ProjectMember['color'], string> = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  tertiary: 'text-tertiary',
};
const colorBg: Record<ProjectMember['color'], string> = {
  primary: 'bg-primary/10',
  secondary: 'bg-secondary/10',
  tertiary: 'bg-tertiary/10',
};

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects, projectsLoading, projectKanban, addProjectMember, removeProjectMember, updateProject, deleteProject,
    addProjectKanbanTask, editProjectKanbanTask, deleteProjectKanbanTask, addProjectKanbanColumn, deleteProjectKanbanColumn, initProjectKanban } = useApp();
  const { toast } = useToast();

  const project = projects.find((p) => p.id === id);

  // 프로젝트 전용 칸반 초기화
  useEffect(() => {
    if (id) initProjectKanban(id);
  }, [id]);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Add member modal
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newColor, setNewColor] = useState<ProjectMember['color']>('primary');
  const [showRoleSuggestions, setShowRoleSuggestions] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [regUsers, setRegUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (addOpen) {
      apiFetch('/api/auth/users', {})
        .then(r => r.ok ? r.json() : { users: [] })
        .then(({ users }) => setRegUsers(users ?? []))
        .catch(() => {});
    }
  }, [addOpen]);

  // Edit description
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState('');
  const descRef = useRef<HTMLTextAreaElement>(null);

  // Task detail popup
  const [taskDetail, setTaskDetail] = useState<{ task: KanbanTask; colId: string } | null>(null);

  // Add task modal
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskTag, setNewTaskTag] = useState(TAG_OPTIONS[0]);
  const [newTaskColor, setNewTaskColor] = useState<ColorType>('primary');
  const [newTaskDate, setNewTaskDate] = useState('');

  useEffect(() => {
    if (addOpen) setTimeout(() => nameRef.current?.focus(), 50);
  }, [addOpen]);

  useEffect(() => {
    if (editingDesc) setTimeout(() => descRef.current?.focus(), 50);
  }, [editingDesc]);

  if (projectsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-on-surface-variant">프로젝트를 찾을 수 없습니다.</p>
        <button onClick={() => navigate('/projects')} className="text-primary font-bold hover:underline text-sm">
          프로젝트 목록으로 돌아가기
        </button>
      </div>
    );
  }

  // ── Computed ─────────────────────────────────────────────────────────────────
  const kanban = id ? (projectKanban[id] ?? []) : [];
  const allTasks = kanban.flatMap((c) => c.tasks);
  const doneTasks = kanban.find((c) => c.title === '완료')?.tasks ?? [];
  const inprogTasks = kanban.find((c) => c.title === '진행 중')?.tasks ?? [];
  const todoTasks = kanban.find((c) => c.title === '할 일')?.tasks ?? [];

  function handleAddMember() {
    const nameToUse = selectedUser?.name ?? newName.trim();
    if (!nameToUse) return;
    const initial = nameToUse.charAt(0).toUpperCase();
    addProjectMember(project.id, {
      name: nameToUse, initial, role: newRole.trim() || '팀원', color: newColor,
      // @ts-ignore — userId는 서버에서 처리
      userId: selectedUser?.id ?? undefined,
    });
    toast(`"${nameToUse}"님이 추가되었습니다.`, 'success');
    setNewName(''); setNewRole(''); setNewColor('primary');
    setSelectedUser(null); setMemberSearch('');
    setAddOpen(false);
  }

  function handleSaveDesc() {
    updateProject(project.id, { description: descValue });
    setEditingDesc(false);
    toast('프로젝트 설명이 저장되었습니다.', 'success');
  }

  async function handleAddTask() {
    if (!newTaskTitle.trim() || !id) return;
    const todoCol = kanban.find(c => c.title === '할 일');
    if (!todoCol) return;
    await addProjectKanbanTask(id, todoCol.id, {
      tag: newTaskTag, title: newTaskTitle.trim(),
      desc: newTaskDesc.trim() || undefined,
      date: newTaskDate || undefined,
      color: newTaskColor,
    });
    toast(`"${newTaskTitle.trim()}" 태스크가 추가되었습니다.`, 'success');
    setNewTaskTitle(''); setNewTaskDesc(''); setNewTaskDate('');
    setNewTaskTag(TAG_OPTIONS[0]); setNewTaskColor('primary');
    setAddTaskOpen(false);
  }

  async function handleDeleteTaskFromDetail(colId: string, taskId: string, title: string) {
    if (!id) return;
    await deleteProjectKanbanTask(id, colId, taskId);
    setTaskDetail(null);
    toast(`"${title}" 태스크가 삭제되었습니다.`, 'info');
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/projects')}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors text-on-surface-variant hover:text-on-surface"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
            <button onClick={() => navigate('/projects')} className="hover:text-primary transition-colors">프로젝트</button>
            <ChevronRight className="w-3 h-3" />
            <span className="text-on-surface font-semibold">{project.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/projects/${id}/board`)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-sm font-semibold transition-all"
          >
            <LayoutGrid className="w-4 h-4" />
            칸반 보드
          </button>
          <button
            onClick={() => {
              if (!deleteConfirm) { setDeleteConfirm(true); return; }
              deleteProject(project.id);
              toast(`"${project.name}" 프로젝트가 삭제되었습니다.`, 'info');
              navigate('/projects');
            }}
            onBlur={() => setTimeout(() => setDeleteConfirm(false), 200)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all',
              deleteConfirm
                ? 'bg-error text-white shadow-lg shadow-error/30'
                : 'bg-error/10 text-error hover:bg-error/20 border border-white/5'
            )}
          >
            <Trash2 className="w-4 h-4" />
            {deleteConfirm ? '정말 삭제할까요?' : '삭제'}
          </button>
        </div>
      </header>

      {/* ── Project Hero Card ────────────────────────────────────────────── */}
      <div className={cn('relative rounded-2xl overflow-hidden p-8 bg-gradient-to-br', project.color)}>
        {/* Overlay */}
        <div className="absolute inset-0 bg-surface/60" />
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-start gap-6">
            {/* Icon */}
            <div className={cn('w-20 h-20 rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-2xl bg-gradient-to-br shrink-0', project.color)}>
              {project.initial}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="font-headline font-black text-3xl tracking-tight mb-1">{project.name}</h1>
              <p className="text-sm text-on-surface-variant mb-4">{project.phase}</p>
              {/* Description */}
              {editingDesc ? (
                <div className="flex items-start gap-2">
                  <textarea
                    ref={descRef}
                    value={descValue}
                    onChange={(e) => setDescValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveDesc(); } if (e.key === 'Escape') setEditingDesc(false); }}
                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary/50 placeholder:text-on-surface-variant/40"
                    rows={2}
                    placeholder="프로젝트 설명을 입력하세요..."
                  />
                  <button onClick={handleSaveDesc} className="text-primary hover:text-secondary transition-colors mt-1"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setEditingDesc(false)} className="text-on-surface-variant hover:text-on-surface transition-colors mt-1"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <button
                  onClick={() => { setDescValue(project.description ?? ''); setEditingDesc(true); }}
                  className="group flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors text-left"
                >
                  <span>{project.description || '프로젝트 설명을 추가하세요...'}</span>
                  <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              )}
            </div>
            {/* Progress */}
            <div className="sm:text-right shrink-0">
              <span className="text-5xl font-black font-headline">{project.progress}%</span>
              <p className="text-xs text-on-surface-variant mt-1 font-bold uppercase tracking-widest">진행률</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-6 h-2 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', project.color)}
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Stats Row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: Users,        label: '구성원',    value: project.members.length, color: 'text-primary' },
          { icon: CheckCircle2, label: '완료 태스크', value: doneTasks.length,      color: 'text-tertiary' },
          { icon: Clock,        label: '진행 중',    value: inprogTasks.length,    color: 'text-secondary' },
          { icon: LayoutGrid,   label: '전체 태스크', value: allTasks.length,       color: 'text-on-surface-variant' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="glass-panel rounded-xl p-4 flex items-center gap-3">
            <Icon className={cn('w-5 h-5 shrink-0', color)} />
            <div>
              <p className="text-xl font-black font-headline">{value}</p>
              <p className="text-[11px] text-on-surface-variant">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Bottom Grid: Members + Tasks ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Members Section */}
        <div className="lg:col-span-7 glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-headline font-bold text-xl">구성원</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">{project.members.length}명의 팀원</p>
            </div>
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-secondary text-surface font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 hover:scale-[1.02] active:scale-95 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              구성원 추가
            </button>
          </div>

          {project.members.length === 0 ? (
            <div className="py-12 text-center text-on-surface-variant text-sm">
              아직 구성원이 없습니다. 팀원을 추가해보세요.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {project.members.map((member) => (
                <div key={member.id} className="group flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-all">
                  {/* Avatar */}
                  <div className={cn('w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-sm font-bold text-surface shrink-0', colorGrad[member.color])}>
                    {member.initial}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{member.name}</p>
                    <p className={cn('text-[11px] font-medium truncate', colorText[member.color])}>{member.role}</p>
                  </div>
                  {/* Role badge */}
                  <span className={cn('text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 hidden sm:block', colorBg[member.color], colorText[member.color])}>
                    {member.role}
                  </span>
                  {/* Delete */}
                  <button
                    onClick={() => { removeProjectMember(project.id, member.id); toast(`"${member.name}"님이 제거되었습니다.`, 'info'); }}
                    className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg hover:bg-error/10 text-on-surface-variant hover:text-error flex items-center justify-center transition-all shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kanban Tasks Preview */}
        <div className="lg:col-span-5 glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-headline font-bold text-xl">칸반 태스크</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">현재 보드 현황</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAddTaskOpen(true)}
                className="flex items-center gap-1 text-[11px] font-bold text-on-surface-variant hover:text-on-surface transition-colors bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg"
              >
                <Plus className="w-3 h-3" /> 추가
              </button>
              <button
                onClick={() => navigate(`/projects/${id}/board`)}
                className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-secondary transition-colors"
              >
                <ExternalLink className="w-3 h-3" /> 보드 열기
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {kanban.flatMap((col) => col.tasks.slice(0, 2).map((t) => (
              <TaskRow key={t.id} task={t} status={col.title}
                statusColor={col.color === 'primary' ? 'text-on-surface-variant' : col.color === 'secondary' ? 'text-secondary' : 'text-tertiary'}
                onClick={() => setTaskDetail({ task: t, colId: col.id })} />
            ))).slice(0, 5)}
            {allTasks.length === 0 && (
              <button
                onClick={() => setAddTaskOpen(true)}
                className="w-full py-8 text-center text-on-surface-variant text-sm hover:text-primary transition-colors"
              >
                + 태스크를 추가해보세요
              </button>
            )}
            {allTasks.length > 5 && (
              <button
                onClick={() => navigate(`/projects/${id}/board`)}
                className="w-full py-2 text-xs text-primary font-bold hover:underline"
              >
                + {allTasks.length - 5}개 더 보기 →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Add Member Modal ─────────────────────────────────────────────── */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAddOpen(false)} />
          <div className="relative w-full max-w-md glass-panel rounded-2xl p-6 shadow-[0_40px_80px_rgba(0,0,0,0.5)]">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-headline font-bold text-xl">구성원 추가</h3>
              <button onClick={() => setAddOpen(false)} className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Avatar preview */}
            <div className="flex justify-center mb-6">
              <div className={cn('w-16 h-16 rounded-full bg-gradient-to-br flex items-center justify-center text-2xl font-black text-surface shadow-lg', colorGrad[newColor])}>
                {(selectedUser?.name ?? newName) ? (selectedUser?.name ?? newName).charAt(0).toUpperCase() : '?'}
              </div>
            </div>

            <div className="space-y-4">
              {/* 등록 유저 검색 */}
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">등록된 사용자 검색</label>
                {selectedUser ? (
                  <div className="flex items-center gap-3 bg-primary/10 rounded-xl px-4 py-3">
                    <div className={cn('w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-bold text-surface', colorGrad[newColor])}>
                      {selectedUser.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-primary flex-1">{selectedUser.name}</span>
                    <button onClick={() => { setSelectedUser(null); setMemberSearch(''); }} className="text-on-surface-variant hover:text-error transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="이름 또는 이메일로 검색..."
                      className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-on-surface-variant/40"
                    />
                    {memberSearch && (
                      <div className="absolute top-full mt-1 left-0 right-0 bg-surface-container-highest/95 backdrop-blur-xl rounded-xl border border-white/5 shadow-lg overflow-hidden z-10 max-h-40 overflow-y-auto">
                        {regUsers
                          .filter(u =>
                            !project.members.find(m => (m as any).userId === u.id) &&
                            (u.name.toLowerCase().includes(memberSearch.toLowerCase()) || u.email.toLowerCase().includes(memberSearch.toLowerCase()))
                          )
                          .map(u => (
                            <button key={u.id}
                              onMouseDown={() => { setSelectedUser({ id: u.id, name: u.name }); setNewName(u.name); setMemberSearch(''); }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/50 to-secondary/50 flex items-center justify-center text-[10px] font-bold text-surface shrink-0">
                                {u.name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm">{u.name}</p>
                                <p className="text-[11px] text-on-surface-variant">{u.email}</p>
                              </div>
                            </button>
                          ))}
                        {regUsers.filter(u => u.name.toLowerCase().includes(memberSearch.toLowerCase()) || u.email.toLowerCase().includes(memberSearch.toLowerCase())).length === 0 && (
                          <p className="px-4 py-3 text-xs text-on-surface-variant">검색 결과 없음</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Name (직접 입력) */}
              {!selectedUser && (
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">또는 직접 입력</label>
                <input
                  ref={nameRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddMember(); if (e.key === 'Escape') setAddOpen(false); }}
                  placeholder="팀원 이름을 입력하세요"
                  className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-on-surface-variant/40"
                />
              </div>
              )}

              {/* Role */}
              <div className="relative">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">역할</label>
                <input
                  value={newRole}
                  onChange={(e) => { setNewRole(e.target.value); setShowRoleSuggestions(true); }}
                  onFocus={() => setShowRoleSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowRoleSuggestions(false), 150)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddMember(); }}
                  placeholder="예: 프론트엔드, 디자이너..."
                  className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-on-surface-variant/40"
                />
                {showRoleSuggestions && (
                  <div className="absolute top-full mt-1 left-0 right-0 bg-surface-container-highest/95 backdrop-blur-xl rounded-xl border border-white/5 shadow-[0_8px_24px_rgba(0,0,0,0.4)] overflow-hidden z-10">
                    {ROLE_SUGGESTIONS.filter((r) => !newRole || r.includes(newRole)).slice(0, 5).map((r) => (
                      <button
                        key={r}
                        onMouseDown={() => { setNewRole(r); setShowRoleSuggestions(false); }}
                        className="w-full px-4 py-2.5 text-left text-sm text-on-surface-variant hover:bg-white/5 hover:text-on-surface transition-colors"
                      >{r}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* Color */}
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3 block">아바타 색상</label>
                <div className="flex gap-3">
                  {MEMBER_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className={cn(
                        'flex-1 h-10 rounded-xl bg-gradient-to-r transition-all',
                        colorGrad[c],
                        newColor === c ? 'ring-2 ring-white/60 scale-105' : 'opacity-50 hover:opacity-80'
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setAddOpen(false)}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-semibold transition-colors"
              >취소</button>
              <button
                onClick={handleAddMember}
                disabled={!newName.trim()}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-surface font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <UserPlus className="w-3.5 h-3.5 inline mr-1.5" />
                추가하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Task Detail Popup ─────────────────────────────────────────────── */}
      {taskDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setTaskDetail(null)} />
          <div className="relative w-full max-w-md glass-panel rounded-2xl shadow-[0_40px_80px_rgba(0,0,0,0.5)] overflow-hidden">
            {/* Color bar */}
            <div className={cn('h-1 w-full bg-gradient-to-r', {
              primary: 'from-primary to-primary-dim',
              secondary: 'from-secondary to-secondary-dim',
              tertiary: 'from-tertiary to-tertiary-dim',
            }[taskDetail.task.color])} />
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex flex-wrap gap-2">
                  <span className={cn('text-[0.65rem] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border', {
                    primary: 'border-primary bg-primary/10 text-primary',
                    secondary: 'border-secondary bg-secondary/10 text-secondary',
                    tertiary: 'border-tertiary bg-tertiary/10 text-tertiary',
                  }[taskDetail.task.color])}>{taskDetail.task.tag}</span>
                  {taskDetail.task.priority && (
                    <span className="text-[0.65rem] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-white/5 text-on-surface-variant">
                      {taskDetail.task.priority}
                    </span>
                  )}
                  {taskDetail.task.isCompleted && (
                    <span className="text-[0.65rem] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-tertiary/10 text-tertiary">완료</span>
                  )}
                </div>
                <button
                  onClick={() => setTaskDetail(null)}
                  className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <h3 className={cn('font-headline font-bold text-xl mb-3 leading-snug', taskDetail.task.isCompleted && 'line-through text-on-surface-variant')}>
                {taskDetail.task.title}
              </h3>
              {taskDetail.task.desc && (
                <p className="text-sm text-on-surface-variant mb-5 leading-relaxed">{taskDetail.task.desc}</p>
              )}

              {/* Meta */}
              <div className="flex flex-wrap gap-3 mb-5">
                {taskDetail.task.date && (
                  <div className="flex items-center gap-1.5 text-xs text-on-surface-variant bg-white/[0.03] rounded-lg px-2.5 py-1.5">
                    <Calendar className="w-3.5 h-3.5" /> {taskDetail.task.date}
                  </div>
                )}
                {taskDetail.task.assignees && taskDetail.task.assignees.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-on-surface-variant bg-white/[0.03] rounded-lg px-2.5 py-1.5">
                    <Users className="w-3.5 h-3.5" /> {taskDetail.task.assignees.join(', ')}
                  </div>
                )}
              </div>

              {/* Progress */}
              {taskDetail.task.progress !== undefined && (
                <div className="mb-5">
                  <div className="flex justify-between text-[11px] text-on-surface-variant mb-1.5">
                    <span>진행률</span>
                    <span className="font-bold">{taskDetail.task.progress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full bg-gradient-to-r', {
                      primary: 'from-primary to-primary-dim',
                      secondary: 'from-secondary to-secondary-dim',
                      tertiary: 'from-tertiary to-tertiary-dim',
                    }[taskDetail.task.color])} style={{ width: `${taskDetail.task.progress}%` }} />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-white/5">
                <button
                  onClick={() => navigate(`/projects/${id}/board`)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-bold hover:bg-primary/20 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" /> 보드에서 편집
                </button>
                <button
                  onClick={() => handleDeleteTaskFromDetail(taskDetail.colId, taskDetail.task.id, taskDetail.task.title)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-error/10 text-error text-sm font-bold hover:bg-error/20 transition-colors ml-auto"
                >
                  <Trash2 className="w-4 h-4" /> 삭제
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Task Modal ───────────────────────────────────────────────── */}
      {addTaskOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAddTaskOpen(false)} />
          <div className="relative w-full max-w-md glass-panel rounded-2xl p-6 shadow-[0_40px_80px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-headline font-bold text-xl">새 태스크 추가</h3>
              <button onClick={() => setAddTaskOpen(false)} className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">태스크 이름 *</label>
                <input
                  autoFocus
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                  placeholder="ex) UI 컴포넌트 구현"
                  className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-on-surface-variant/40"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">설명</label>
                <textarea
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  rows={2}
                  placeholder="태스크 세부 내용..."
                  className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none placeholder:text-on-surface-variant/40"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">
                    <Tag className="w-3 h-3 inline mr-1" />태그
                  </label>
                  <select value={newTaskTag} onChange={(e) => setNewTaskTag(e.target.value)}
                    className="w-full bg-surface-container-highest rounded-xl px-3 py-2.5 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/20">
                    {TAG_OPTIONS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">
                    <Calendar className="w-3 h-3 inline mr-1" />마감일
                  </label>
                  <input type="date" value={newTaskDate} onChange={(e) => setNewTaskDate(e.target.value)}
                    className="w-full bg-surface-container-highest rounded-xl px-3 py-2.5 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">색상</label>
                <div className="flex gap-2">
                  {([
                    { label: '파랑', value: 'primary' as ColorType },
                    { label: '보라', value: 'secondary' as ColorType },
                    { label: '분홍', value: 'tertiary' as ColorType },
                  ]).map(c => (
                    <button key={c.value} onClick={() => setNewTaskColor(c.value)}
                      className={cn('flex-1 py-2 rounded-lg text-xs font-bold transition-all',
                        newTaskColor === c.value
                          ? { primary: 'bg-primary/20 text-primary ring-1 ring-primary/40', secondary: 'bg-secondary/20 text-secondary ring-1 ring-secondary/40', tertiary: 'bg-tertiary/20 text-tertiary ring-1 ring-tertiary/40' }[c.value]
                          : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-bright'
                      )}>{c.label}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setAddTaskOpen(false)}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-semibold transition-colors">취소</button>
              <button onClick={handleAddTask} disabled={!newTaskTitle.trim()}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-surface font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                <Plus className="w-3.5 h-3.5 inline mr-1.5" />추가하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TaskRow ─────────────────────────────────────────────────────────────────
function TaskRow({ task, status, statusColor, onClick }: {
  task: KanbanTask;
  status: string;
  statusColor: string;
  onClick?: () => void;
}) {
  const dotColor: Record<string, string> = {
    primary: 'bg-primary', secondary: 'bg-secondary', tertiary: 'bg-tertiary',
  };
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] transition-all group',
        onClick && 'cursor-pointer'
      )}
    >
      <div className={cn('w-2 h-2 rounded-full shrink-0', dotColor[task.color])} />
      <span className="text-sm flex-1 truncate">{task.title}</span>
      {task.date && <span className="text-[10px] text-on-surface-variant/60 shrink-0">{task.date}</span>}
      <span className={cn('text-[10px] font-bold shrink-0', statusColor)}>{status}</span>
    </div>
  );
}
