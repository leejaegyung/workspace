import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trello, MoreHorizontal, Trash2, ExternalLink, X, ArrowRight } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import { cn } from '../lib/utils';
import type { Project } from '../contexts/AppContext';

const colorGrad: Record<string, string> = {
  'from-primary to-secondary':         'from-primary to-secondary',
  'from-secondary to-tertiary':        'from-secondary to-tertiary',
  'from-tertiary to-primary':          'from-tertiary to-primary',
  'from-primary to-primary-dim':       'from-primary to-primary-dim',
  'from-secondary to-secondary-dim':   'from-secondary to-secondary-dim',
  'from-tertiary to-tertiary-dim':     'from-tertiary to-tertiary-dim',
};

const colorAccent: Record<string, string> = {
  'from-primary to-secondary':         'text-primary',
  'from-secondary to-tertiary':        'text-secondary',
  'from-tertiary to-primary':          'text-tertiary',
  'from-primary to-primary-dim':       'text-primary',
  'from-secondary to-secondary-dim':   'text-secondary',
  'from-tertiary to-tertiary-dim':     'text-tertiary',
};

const colorProgressBg: Record<string, string> = {
  'from-primary to-secondary':         'bg-primary/10',
  'from-secondary to-tertiary':        'bg-secondary/10',
  'from-tertiary to-primary':          'bg-tertiary/10',
  'from-primary to-primary-dim':       'bg-primary/10',
  'from-secondary to-secondary-dim':   'bg-secondary/10',
  'from-tertiary to-tertiary-dim':     'bg-tertiary/10',
};

const memberColorGrad: Record<string, string> = {
  primary:   'from-primary to-primary-dim',
  secondary: 'from-secondary to-secondary-dim',
  tertiary:  'from-tertiary to-tertiary-dim',
};

const COLOR_OPTIONS = [
  { label: '블루',  value: 'from-primary to-secondary' },
  { label: '퍼플',  value: 'from-secondary to-tertiary' },
  { label: '핑크',  value: 'from-tertiary to-primary' },
  { label: '블루2', value: 'from-primary to-primary-dim' },
  { label: '퍼플2', value: 'from-secondary to-secondary-dim' },
  { label: '핑크2', value: 'from-tertiary to-tertiary-dim' },
];

export function Projects() {
  const { projects, projectKanban, addProject, initProjectKanban } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName]       = useState('');
  const [newPhase, setNewPhase]     = useState('');
  const [newDesc, setNewDesc]       = useState('');
  const [newColor, setNewColor]     = useState(COLOR_OPTIONS[0].value);
  const [activeFilter, setActiveFilter] = useState<null | 'all' | 'inprog' | 'done'>(null);

  // 모든 프로젝트 칸반 초기화
  useEffect(() => {
    projects.forEach(p => initProjectKanban(p.id));
  }, [projects]); // eslint-disable-line

  // 칸반 완료 태스크 기준 진행률 계산
  function getProgress(projectId: string): number {
    const cols = projectKanban[projectId];
    if (!cols) return 0;
    const total = cols.flatMap(c => c.tasks).length;
    if (total === 0) return 0;
    const done = cols.find(c => c.title === '완료')?.tasks.length ?? 0;
    return Math.round((done / total) * 100);
  }

  const totalTasks  = Object.values(projectKanban).reduce((sum, cols) => sum + cols.reduce((s, c) => s + c.tasks.length, 0), 0);
  const doneTasks   = Object.values(projectKanban).reduce((sum, cols) => sum + (cols.find(c => c.title === '완료')?.tasks.length ?? 0), 0);
  const inProgTasks = Object.values(projectKanban).reduce((sum, cols) => sum + (cols.find(c => c.title === '진행 중')?.tasks.length ?? 0), 0);

  // 필터링된 프로젝트
  const filteredProjects = projects.filter(p => {
    if (!activeFilter || activeFilter === 'all') return true;
    const cols = projectKanban[p.id];
    if (activeFilter === 'inprog') return (cols?.find(c => c.title === '진행 중')?.tasks.length ?? 0) > 0;
    if (activeFilter === 'done')   return (cols?.find(c => c.title === '완료')?.tasks.length ?? 0) > 0;
    return true;
  });

  async function handleCreate() {
    if (!newName.trim()) return;
    await addProject({
      initial: newName.trim().charAt(0).toUpperCase(),
      name: newName.trim(),
      phase: newPhase.trim() || '초기 단계',
      progress: 0,
      color: newColor,
      members: [],
      description: newDesc.trim(),
    });
    toast(`"${newName.trim()}" 프로젝트가 생성되었습니다.`, 'success');
    setCreateOpen(false);
    setNewName(''); setNewPhase(''); setNewDesc(''); setNewColor(COLOR_OPTIONS[0].value);
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-extrabold font-headline tracking-tight text-on-surface mb-2">프로젝트</h1>
          <p className="text-on-surface-variant">진행 중인 개발 스프린트 및 협업 허브</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCreateOpen(true)}
            className="bg-gradient-to-r from-primary to-secondary text-surface font-bold px-5 py-2.5 rounded-xl hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            새 프로젝트
          </button>
        </div>
      </header>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        {([
          { label: '전체 태스크', value: totalTasks,  color: 'text-primary',   filter: null as null | 'all' | 'inprog' | 'done' },
          { label: '진행 중',     value: inProgTasks, color: 'text-secondary', filter: 'inprog' as const },
          { label: '완료',        value: doneTasks,   color: 'text-tertiary',  filter: 'done'   as const },
        ] as const).map(stat => {
          const isActive = stat.filter === null ? activeFilter === null : activeFilter === stat.filter;
          return (
            <button
              key={stat.label}
              onClick={() => setActiveFilter(prev => prev === stat.filter ? null : stat.filter)}
              className={cn(
                'bg-surface-container rounded-2xl px-6 py-5 text-left transition-all hover:bg-surface-bright active:scale-95',
                isActive && 'ring-2 ring-primary/40 bg-surface-bright',
              )}
            >
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">{stat.label}</p>
              <p className={cn('text-3xl font-extrabold font-headline', stat.color)}>{stat.value}</p>
            </button>
          );
        })}
      </div>

      {/* Project grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredProjects.map((project) => (
          <ProjectCard key={project.id} project={{ ...project, progress: getProgress(project.id) }} onClick={() => navigate(`/projects/${project.id}`)} />
        ))}
        {filteredProjects.length === 0 && projects.length > 0 && (
          <div className="col-span-3 py-16 flex flex-col items-center gap-3 text-on-surface-variant/50">
            <p className="text-sm">해당 조건의 프로젝트가 없습니다.</p>
            <button onClick={() => setActiveFilter(null)} className="text-xs font-bold text-primary hover:text-secondary transition-colors">전체 보기</button>
          </div>
        )}
        {projects.length === 0 && (
          <div className="col-span-3 py-24 flex flex-col items-center gap-4 text-on-surface-variant/50">
            <Trello className="w-12 h-12 opacity-30" />
            <p className="text-sm">프로젝트가 없습니다. 새 프로젝트를 생성해보세요.</p>
            <button onClick={() => setCreateOpen(true)}
              className="text-sm font-bold text-primary hover:text-secondary transition-colors flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> 프로젝트 만들기
            </button>
          </div>
        )}
      </div>

      {/* 프로젝트 생성 모달 */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setCreateOpen(false)}>
          <div className="bg-surface-container-highest/95 backdrop-blur-xl rounded-2xl border border-white/5 shadow-[0_24px_64px_rgba(0,0,0,0.6)] w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-headline font-bold text-lg">새 프로젝트</h2>
              <button onClick={() => setCreateOpen(false)} className="p-1.5 text-on-surface-variant hover:text-on-surface transition-colors rounded-lg hover:bg-surface-bright">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">프로젝트 이름 *</label>
                <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="예: Solaris Mobile App"
                  className="w-full bg-surface-container rounded-xl px-4 py-3 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-on-surface-variant/40" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">단계</label>
                <input value={newPhase} onChange={e => setNewPhase(e.target.value)}
                  placeholder="예: 디자인 단계, 개발 중, 베타 테스트"
                  className="w-full bg-surface-container rounded-xl px-4 py-3 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-on-surface-variant/40" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">설명</label>
                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2}
                  placeholder="프로젝트에 대한 간략한 설명"
                  className="w-full bg-surface-container rounded-xl px-4 py-3 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-on-surface-variant/40 resize-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">컬러</label>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setNewColor(opt.value)}
                      className={cn('w-8 h-8 rounded-full bg-gradient-to-br transition-all hover:scale-110', opt.value,
                        newColor === opt.value && 'ring-2 ring-white/60 ring-offset-2 ring-offset-surface-container-highest scale-110'
                      )} title={opt.label} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setCreateOpen(false)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-on-surface-variant bg-surface-container hover:bg-surface-bright transition-all">취소</button>
              <button onClick={handleCreate} disabled={!newName.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-primary to-secondary text-surface shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                생성하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const { deleteProject } = useApp();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const grad = colorGrad[project.color] ?? 'from-primary to-secondary';
  const accent = colorAccent[project.color] ?? 'text-primary';
  const progressBg = colorProgressBg[project.color] ?? 'bg-primary/10';

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirmDelete(false);
      }
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirmDelete) { setConfirmDelete(true); return; }
    deleteProject(project.id);
    toast(`"${project.name}" 프로젝트가 삭제되었습니다.`, 'info');
  }

  return (
    <article
      onClick={onClick}
      className="group bg-surface-container rounded-2xl p-6 cursor-pointer hover:bg-surface-bright transition-all relative overflow-hidden"
    >
      {/* Gradient top bar */}
      <div className={cn('absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r', grad)} />

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className={cn('w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-lg font-extrabold text-surface shadow-lg', grad)}>
            {project.initial}
          </div>
          <div>
            <h3 className="font-headline font-bold text-on-surface text-base leading-snug">{project.name}</h3>
            <p className="text-xs text-on-surface-variant">{project.phase}</p>
          </div>
        </div>

        {/* More menu */}
        <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); setConfirmDelete(false); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-surface-container-highest/95 backdrop-blur-xl rounded-xl border border-white/5 shadow-[0_8px_24px_rgba(0,0,0,0.5)] overflow-hidden z-50">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); navigate(`/projects/${project.id}`); }}
                className="w-full px-4 py-2.5 text-left text-sm text-on-surface-variant hover:bg-white/5 hover:text-on-surface transition-colors flex items-center gap-2"
              >
                <ExternalLink className="w-3.5 h-3.5" /> 상세 보기
              </button>
              <div className="h-px bg-white/5 mx-3" />
              <button
                onClick={handleDelete}
                className={cn(
                  'w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center gap-2',
                  confirmDelete
                    ? 'bg-error/20 text-error font-bold'
                    : 'text-error hover:bg-error/10'
                )}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {confirmDelete ? '정말 삭제할까요?' : '삭제'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-on-surface-variant">진행률</span>
        <span className={cn('text-sm font-extrabold font-headline', accent)}>{project.progress}%</span>
      </div>
      <div className={cn('h-1.5 w-full rounded-full mb-5', progressBg)}>
        <div
          className={cn('h-full rounded-full bg-gradient-to-r transition-all', grad)}
          style={{ width: `${project.progress}%` }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {project.members.slice(0, 4).map((m) => (
              <div
                key={m.id}
                title={m.name}
                className={cn(
                  'w-7 h-7 rounded-full bg-gradient-to-br border-2 border-surface-container flex items-center justify-center text-[9px] font-bold text-surface',
                  memberColorGrad[m.color] ?? 'from-primary to-secondary'
                )}
              >
                {m.initial}
              </div>
            ))}
            {project.members.length > 4 && (
              <div className="w-7 h-7 rounded-full bg-surface-container-highest border-2 border-surface-container flex items-center justify-center text-[9px] font-bold text-on-surface-variant">
                +{project.members.length - 4}
              </div>
            )}
          </div>
          <span className="text-xs text-on-surface-variant">{project.members.length}명</span>
        </div>

        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all bg-gradient-to-br', grad)}>
          <ArrowRight className="w-4 h-4 text-surface" />
        </div>
      </div>
    </article>
  );
}
