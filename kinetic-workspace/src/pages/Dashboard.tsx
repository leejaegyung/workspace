import React, { useState, useRef, useEffect } from 'react';
import { apiFetch } from '../lib/apiFetch';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, Clock, CheckCircle2, MoreHorizontal,
  Code, MessageCircle, Zap, Calendar, ChevronRight, Plus, Trash2, X,
  ChevronLeft, ChevronRight as ChevronRightIcon, Clock3, Tag, Check,
  BarChart2, Edit2, Globe, Lock,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import { Modal } from '../components/Modal';

// ─── Calendar types ────────────────────────────────────────────────────────────
interface CalEvent {
  id: string;
  title: string;
  date: string; // 'YYYY-MM-DD'
  time?: string;
  color: 'primary' | 'secondary' | 'tertiary' | 'error';
  tag?: string;
  sharing?: 'personal' | 'all';
}

const INIT_EVENTS: CalEvent[] = [
  { id: 'ce1', title: '브랜드 아이덴티티 론칭',       date: '2026-03-24', time: '09:00', color: 'error',     tag: '마감' },
  { id: 'ce2', title: 'Q4 전략 검토',                date: '2026-03-26', time: '14:00', color: 'secondary', tag: '미팅' },
  { id: 'ce3', title: '글라스모피즘 로그인 모달',      date: '2026-03-24', time: '11:00', color: 'primary',   tag: 'UI 디자인' },
  { id: 'ce4', title: '비주얼 에셋 팩 – 스프린트 알파', date: '2026-03-20', time: '',    color: 'secondary', tag: '브랜딩' },
  { id: 'ce5', title: '클라이언트 싱크 – Aether CMS', date: '2026-03-28', time: '15:00', color: 'tertiary',  tag: '싱크' },
  { id: 'ce6', title: '팀 스탠드업',                  date: '2026-03-27', time: '10:00', color: 'primary',   tag: '미팅' },
  { id: 'ce7', title: '디자인 시스템 리뷰',            date: '2026-03-31', time: '13:00', color: 'secondary', tag: '리뷰' },
];

// ─── Color options for new project ───────────────────────────────────────────
const COLOR_OPTIONS = [
  { label: 'Blue',   value: 'from-primary to-primary-dim' },
  { label: 'Violet', value: 'from-secondary to-secondary-dim' },
  { label: 'Pink',   value: 'from-tertiary to-tertiary-dim' },
];

export function Dashboard() {
  const { user } = useAuth();
  const { projects, addProject, sprintTasks, toggleSprintTask, addSprintTask, deleteSprintTask, activities, markAllRead, kanban, kanbanLoading, addKanbanTask, editKanbanTask, projectKanban, initProjectKanban } = useApp();
  const { toast } = useToast();
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  // 날씨 실시간 (Open-Meteo — 서울, 무료 API)
  const [weather, setWeather] = useState<{ temp: number; desc: string; icon: string } | null>(null);
  useEffect(() => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current=temperature_2m,weathercode&timezone=Asia/Seoul')
      .then(r => r.json())
      .then(d => {
        const temp = Math.round(d.current?.temperature_2m ?? 0);
        const code = d.current?.weathercode ?? 0;
        const getDesc = (c: number) => {
          if (c === 0) return { desc: '맑음', icon: '☀️' };
          if (c <= 2) return { desc: '대체로 맑음', icon: '🌤️' };
          if (c === 3) return { desc: '흐림', icon: '☁️' };
          if (c <= 48) return { desc: '안개', icon: '🌫️' };
          if (c <= 55) return { desc: '이슬비', icon: '🌦️' };
          if (c <= 65) return { desc: '비', icon: '🌧️' };
          if (c <= 75) return { desc: '눈', icon: '❄️' };
          if (c <= 82) return { desc: '소나기', icon: '🌩️' };
          return { desc: '뇌우', icon: '⛈️' };
        };
        setWeather({ temp, ...getDesc(code) });
      })
      .catch(() => setWeather({ temp: 18, desc: '구름 조금', icon: '🌤️' }));
  }, []);

  // 프로젝트 칸반 초기화 (대시보드용 달성률 계산)
  useEffect(() => {
    projects.forEach(p => initProjectKanban(p.id));
  }, [projects]); // eslint-disable-line

  function getProjectProgress(projectId: string): number {
    const cols = projectKanban[projectId];
    if (!cols) return 0;
    const total = cols.flatMap(c => c.tasks).length;
    if (total === 0) return 0;
    const done = cols.find(c => c.title === '완료')?.tasks.length ?? 0;
    return Math.round((done / total) * 100);
  }

  const avgProjectProgress = projects.length === 0 ? 0
    : Math.round(projects.reduce((s, p) => s + getProjectProgress(p.id), 0) / projects.length);

  // Metric modal state
  const [metricModal, setMetricModal] = useState<'tasks' | 'time' | 'deadlines' | null>(null);

  // Calendar state — 서버 DB 연동
  const [calOpen, setCalOpen] = useState(false);
  const [calEvents, setCalEvents] = useState<CalEvent[]>([]);
  useEffect(() => {
    apiFetch('/api/data/calendar-events', {})
      .then(r => r.ok ? r.json() : { events: [] })
      .then(({ events = [] }) => setCalEvents(events.map((e: any) => ({
        id: e.id, title: e.title, date: e.date, time: e.time ?? '', color: e.color, tag: e.tag ?? '', sharing: e.sharing ?? 'personal'
      }))))
      .catch(() => setCalEvents(INIT_EVENTS)); // fallback to hardcoded on error
  }, []);

  async function addCalEvent(ev: Omit<CalEvent, 'id'>) {
    const id = `ce${crypto.randomUUID()}`;
    setCalEvents(prev => [...prev, { ...ev, id }]);
    try {
      await apiFetch('/api/data/calendar-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...ev, sharing: ev.sharing ?? 'personal' }),
      });
    } catch {}
  }
  async function editCalEvent(id: string, updates: Partial<Omit<CalEvent, 'id'>>) {
    setCalEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    try {
      await apiFetch(`/api/data/calendar-events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch {}
  }
  async function deleteCalEvent(id: string) {
    setCalEvents(prev => prev.filter(e => e.id !== id));
    try {
      await apiFetch(`/api/data/calendar-events/${id}`, { method: 'DELETE' });
    } catch {}
  }

  // New Project modal state
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [projName, setProjName]   = useState('');
  const [projPhase, setProjPhase] = useState('');
  const [projColor, setProjColor] = useState(COLOR_OPTIONS[0].value);
  const [projMembers, setProjMembers] = useState('1');

  // Team stats state
  interface TeamStat { id: string; name: string; color: string; members: { id: string; name: string; rate: number; isMe: boolean }[] }
  const [teamStats, setTeamStats] = useState<TeamStat[]>([]);
  const [myTeamRate, setMyTeamRate] = useState(0);
  useEffect(() => {
    apiFetch('/api/data/teams/my-stats', {})
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) { setTeamStats(data.teams ?? []); setMyTeamRate(data.myRate ?? 0); }
      }).catch(() => {});
  }, []);

  // Weekly goals state — 서버 DB 연동
  interface WeeklyGoal { id: string; text: string; done: boolean; color: 'primary' | 'secondary' | 'tertiary' }
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoal[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  useEffect(() => {
    apiFetch('/api/data/weekly-goals', {})
      .then(r => r.ok ? r.json() : { goals: [] })
      .then(({ goals = [] }) => setWeeklyGoals(goals.map((g: any) => ({
        id: g.id, text: g.text, done: !!g.done, color: g.color as WeeklyGoal['color']
      }))))
      .catch(() => {})
      .finally(() => setGoalsLoading(false));
  }, []);

  const [addingGoal, setAddingGoal]   = useState(false);
  const [newGoalText, setNewGoalText] = useState('');
  const [newGoalColor, setNewGoalColor] = useState<WeeklyGoal['color']>('primary');
  const addGoalRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (addingGoal) addGoalRef.current?.focus(); }, [addingGoal]);

  async function handleAddGoal() {
    if (!newGoalText.trim()) { setAddingGoal(false); return; }
    try {
      const res = await apiFetch('/api/data/weekly-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newGoalText.trim(), color: newGoalColor }),
      });
      const { goal } = await res.json();
      setWeeklyGoals(prev => [...prev, { id: goal.id, text: goal.text, done: false, color: goal.color }]);
      toast('주간 목표가 추가되었습니다.', 'success');
    } catch {}
    setNewGoalText(''); setAddingGoal(false);
  }

  async function toggleGoal(id: string) {
    const goal = weeklyGoals.find(g => g.id === id);
    if (!goal) return;
    const newDone = !goal.done;
    setWeeklyGoals(prev => prev.map(g => g.id === id ? { ...g, done: newDone } : g));
    await apiFetch(`/api/data/weekly-goals/${id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: newDone }),
    }).catch(() => {});
  }

  async function deleteGoal(id: string) {
    setWeeklyGoals(prev => prev.filter(g => g.id !== id));
    await apiFetch(`/api/data/weekly-goals/${id}`, { method: 'DELETE', credentials: 'include' }).catch(() => {});
  }

  // 금일 업무 추가 상태 (kanban 기반)
  const [addingTask, setAddingTask]   = useState(false);
  const [newTaskLabel, setNewTaskLabel] = useState('');
  const newTaskRef = useRef<HTMLInputElement>(null);

  // 개인 칸반에서 할일/진행중 태스크 가져오기
  const todoCol   = kanban.find(c => c.title === '할 일');
  const inProgCol = kanban.find(c => c.title === '진행 중');
  const todayTasks = [
    ...(todoCol?.tasks ?? []),
    ...(inProgCol?.tasks ?? []),
  ];

  // Activity detail modal
  const [activityDetail, setActivityDetail] = useState<any | null>(null);

  // Activity more menu
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (addingTask) newTaskRef.current?.focus();
  }, [addingTask]);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  function handleCreateProject() {
    if (!projName.trim()) return;
    addProject({
      initial: projName.trim().charAt(0).toUpperCase(),
      name: projName.trim(),
      phase: projPhase.trim() || 'Planning',
      progress: 0,
      color: projColor,
      members: parseInt(projMembers) || 1,
    });
    toast(`"${projName.trim()}" 프로젝트가 생성되었습니다!`, 'success');
    setNewProjectOpen(false);
    setProjName(''); setProjPhase(''); setProjColor(COLOR_OPTIONS[0].value); setProjMembers('1');
  }

  async function handleAddTodayTask() {
    if (!newTaskLabel.trim()) { setAddingTask(false); return; }
    const colId = todoCol?.id;
    if (!colId) { toast('개인 업무 칸반을 불러오는 중입니다. 잠시 후 다시 시도해주세요.', 'info'); return; }
    await addKanbanTask(colId, {
      tag: '금일 업무',
      title: newTaskLabel.trim(),
      color: 'primary',
    });
    setNewTaskLabel('');
    setAddingTask(false);
    toast('금일 업무에 추가되었습니다.', 'success');
  }

  function handleMarkAllRead() {
    markAllRead();
    toast('모든 활동을 읽음 처리했습니다.', 'info');
  }

  const unreadCount = activities.filter((a) => !a.read).length;

  return (
    <div className="max-w-[1600px] mx-auto">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="mb-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest">워크스페이스</span>
            <span className="text-on-surface-variant text-sm font-medium">{today}</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tighter font-headline mb-3 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            반갑습니다, {user?.name ?? 'Guest'}.
          </h1>
          <p className="text-on-surface-variant text-lg">
            오늘 스프린트에 <span className="text-primary font-semibold">{sprintTasks.filter(t => !t.checked).length}개의 중요한 작업</span>이 있습니다.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setCalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-sm font-semibold"
          >
            <Calendar className="w-4 h-4" />
            일정
          </button>
          <button
            onClick={() => setNewProjectOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-surface font-bold shadow-lg shadow-primary/20 hover:opacity-90 hover:scale-[1.02] active:scale-95 transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            새 프로젝트
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── Left col ──────────────────────────────────────────── */}
        <div className="lg:col-span-8 grid grid-cols-1 gap-6">

          {/* Metric cards */}
          {(() => {
            const allKanbanTasks = kanban.flatMap(c => c.tasks);
            const doneKanbanTasks = kanban.find(c => c.title === '완료')?.tasks.length ?? 0;
            // 완료 기준 달성률: 완료 컬럼 태스크 / 전체 태스크
            const kanbanProgress = allKanbanTasks.length
              ? Math.round((doneKanbanTasks / allKanbanTasks.length) * 100)
              : 0;
            const today2 = new Date(); today2.setHours(0,0,0,0);
            const in7days = new Date(today2); in7days.setDate(in7days.getDate() + 7);
            const upcomingCount = calEvents.filter(e => { const d = new Date(e.date + 'T00:00'); return d >= today2 && d <= in7days; }).length;
            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <MetricCard icon={CheckCircle2} label="개인 업무 현황"  value={`${kanbanProgress}%`}            trend={`${doneKanbanTasks}/${allKanbanTasks.length} 완료`} color="primary"   onClick={() => setMetricModal('tasks')} />
                <MetricCard icon={BarChart2}    label="프로젝트 달성률" value={`${avgProjectProgress}%`}         trend={`${projects.length}개 프로젝트`} color="secondary" onClick={() => setMetricModal('time')} />
                <MetricCard icon={Calendar}     label="다가오는 마감"    value={String(upcomingCount)}           trend="7일 이내"           color="tertiary"  onClick={() => setMetricModal('deadlines')} />
              </div>
            );
          })()}

          {/* Active Projects */}
          <div className="glass-panel rounded-2xl p-8 overflow-hidden relative">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="font-headline font-bold text-xl">진행 중인 프로젝트</h2>
                <p className="text-xs text-on-surface-variant mt-1">진행 중인 개발 스프린트</p>
              </div>
              <div className="relative" ref={filterRef}>
                <button
                  onClick={() => setFilterOpen(!filterOpen)}
                  className="p-2 hover:bg-white/5 rounded-lg text-on-surface-variant transition-colors"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
                {filterOpen && (
                  <div className="absolute right-0 top-full mt-1 w-44 bg-surface-container-highest/90 backdrop-blur-xl rounded-xl border border-white/5 shadow-[0_8px_24px_rgba(0,0,0,0.4)] overflow-hidden z-50">
                    {['진행순', '이름순', '최근 수정순'].map((opt) => (
                      <button key={opt} onClick={() => { setFilterOpen(false); toast(`${opt}으로 정렬했습니다.`, 'info'); }}
                        className="w-full px-4 py-2.5 text-left text-sm text-on-surface-variant hover:bg-white/5 hover:text-on-surface transition-colors">
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-6">
              {projects.map((p) => (
                <ProjectProgress key={p.id} project={{ ...p, progress: getProjectProgress(p.id) }} />
              ))}
            </div>
          </div>

        </div>

        {/* ── Right col ─────────────────────────────────────────── */}
        <div className="lg:col-span-4 space-y-6">
          {/* Weather widget */}
          <div className="glass-panel p-6 rounded-2xl flex items-center justify-between group hover:border-primary/30 transition-all cursor-default overflow-hidden relative">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">서울 · 실시간</span>
              </div>
              {weather ? (
                <div className="flex items-baseline gap-2">
                  <h3 className="text-4xl font-black font-headline tracking-tighter">{weather.temp}°C</h3>
                  <span className="text-xs text-on-surface-variant font-medium">{weather.desc}</span>
                </div>
              ) : (
                <div className="text-2xl font-black font-headline tracking-tighter text-on-surface-variant animate-pulse">--°C</div>
              )}
            </div>
            <div className="relative z-10 flex flex-col items-center">
              <span className="text-5xl">{weather?.icon ?? '🌤️'}</span>
            </div>
          </div>

          {/* Priority Deadlines */}
          <div className="glass-panel p-6 rounded-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-headline font-bold text-lg">우선 마감일</h2>
              <button
                onClick={() => setCalOpen(true)}
                className="text-primary text-[10px] font-bold uppercase tracking-widest hover:underline"
              >캘린더</button>
            </div>
            <div className="space-y-3">
              {(() => {
                const now = new Date(); now.setHours(0, 0, 0, 0);
                const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
                const upcoming = calEvents
                  .filter((e) => new Date(e.date + 'T00:00') >= now)
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .slice(0, 3);
                function relTime(dateStr: string) {
                  const d = new Date(dateStr + 'T00:00');
                  const diff = Math.round((d.getTime() - now.getTime()) / 86400000);
                  if (diff === 0) return '오늘';
                  if (diff === 1) return '내일';
                  return `${diff}일 후`;
                }
                if (upcoming.length === 0) {
                  return <p className="text-xs text-on-surface-variant/50 py-4 text-center">예정된 마감일이 없습니다.</p>;
                }
                return upcoming.map((ev) => {
                  const d = new Date(ev.date + 'T00:00');
                  return (
                    <DeadlineItem
                      key={ev.id}
                      month={MONTHS[d.getMonth()]}
                      day={String(d.getDate())}
                      title={ev.title}
                      time={ev.time ? `${relTime(ev.date)} · ${ev.time}` : relTime(ev.date)}
                      color={ev.color}
                      onOpen={() => setCalOpen(true)}
                    />
                  );
                });
              })()}
            </div>
          </div>

          {/* 금일 업무 (kanban 할일 + 진행중 태스크) */}
          <div className="glass-panel p-6 rounded-2xl">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="font-headline font-bold text-lg">금일 업무</h2>
                <p className="text-[11px] text-on-surface-variant mt-0.5">개인 업무 · 할 일 &amp; 진행 중</p>
              </div>
              <button
                onClick={() => setAddingTask(true)}
                className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {kanbanLoading ? (
                <p className="text-xs text-on-surface-variant/50 py-4 text-center">불러오는 중...</p>
              ) : todayTasks.length === 0 && !addingTask ? (
                <p className="text-xs text-on-surface-variant/50 py-4 text-center">할 일과 진행 중인 업무가 없습니다.</p>
              ) : (
                todayTasks.map((task) => {
                  const colTitle = todoCol?.tasks.find(t => t.id === task.id) ? '할 일' : '진행 중';
                  const colId = colTitle === '할 일' ? todoCol?.id : inProgCol?.id;
                  return (
                    <div key={task.id} className="flex items-center gap-3 group">
                      <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={task.isCompleted ?? false}
                          onChange={async () => {
                            if (colId) {
                              await editKanbanTask(colId, task.id, { isCompleted: !task.isCompleted });
                              if (!task.isCompleted) toast(`"${task.title}" 완료!`, 'delight');
                            }
                          }}
                          className="w-4 h-4 rounded border-white/20 bg-transparent text-primary focus:ring-primary cursor-pointer shrink-0"
                        />
                        <div className="min-w-0">
                          <p className={cn('text-sm truncate transition-colors', task.isCompleted ? 'line-through text-on-surface-variant/50' : 'text-on-surface-variant group-hover:text-on-surface')}>
                            {task.title}
                          </p>
                          <span className="text-[10px] text-on-surface-variant/40 font-medium">{colTitle}</span>
                        </div>
                      </label>
                      {task.tag && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary shrink-0">{task.tag}</span>
                      )}
                    </div>
                  );
                })
              )}
              {addingTask && (
                <div className="flex items-center gap-2">
                  <input
                    ref={newTaskRef}
                    value={newTaskLabel}
                    onChange={(e) => setNewTaskLabel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddTodayTask(); if (e.key === 'Escape') { setAddingTask(false); setNewTaskLabel(''); } }}
                    placeholder="업무 이름 입력..."
                    className="flex-1 bg-surface-container-highest rounded-lg px-3 py-1.5 text-sm border-none focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-on-surface-variant/40"
                  />
                  <button onClick={handleAddTodayTask} className="text-primary hover:text-secondary transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setAddingTask(false); setNewTaskLabel(''); }} className="text-on-surface-variant hover:text-on-surface transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ── Bottom row: 주간 목표 + 팀 완료율 ─────────────────── */}
        <div className="lg:col-span-12 flex gap-6">
          {/* Weekly Goals */}
          {(() => {
            const doneCount  = weeklyGoals.filter(g => g.done).length;
            const totalCount = weeklyGoals.length;
            const pct        = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
            const GOAL_COLORS: WeeklyGoal['color'][] = ['primary', 'secondary', 'tertiary'];
            const dotColor: Record<WeeklyGoal['color'], string> = {
              primary: 'bg-primary', secondary: 'bg-secondary', tertiary: 'bg-tertiary',
            };
            const barColor: Record<WeeklyGoal['color'], string> = {
              primary: 'from-primary to-primary-dim', secondary: 'from-secondary to-secondary-dim', tertiary: 'from-tertiary to-tertiary-dim',
            };
            const textColor: Record<WeeklyGoal['color'], string> = {
              primary: 'text-primary', secondary: 'text-secondary', tertiary: 'text-tertiary',
            };
            return (
              <div className="glass-panel rounded-2xl p-8 flex-[2]">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-headline font-bold text-xl">주간 목표</h2>
                    <p className="text-xs text-on-surface-variant mt-1">이번 주 달성할 목표를 설정하세요</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-on-surface-variant bg-white/5 px-3 py-1.5 rounded-lg">
                      {doneCount}/{totalCount} 완료
                    </span>
                    <button
                      onClick={() => setAddingGoal(true)}
                      className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Overall progress */}
                <div className="mb-6">
                  <div className="flex justify-between text-[11px] text-on-surface-variant mb-2">
                    <span className="font-bold uppercase tracking-widest">주간 달성률</span>
                    <span className={cn('font-bold', pct >= 70 ? 'text-primary' : pct >= 40 ? 'text-secondary' : 'text-tertiary')}>{pct}%</span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Goal list */}
                <div className="space-y-3">
                  {weeklyGoals.map((goal) => (
                    <div key={goal.id} className={cn('flex items-center gap-4 p-4 rounded-xl group transition-all', goal.done ? 'bg-white/[0.02]' : 'bg-white/[0.04] hover:bg-white/[0.06]')}>
                      <div className={cn('w-1 h-8 rounded-full shrink-0 bg-gradient-to-b', barColor[goal.color])} />
                      <button
                        onClick={() => {
                          if (!goal.done) toast(`"${goal.text}" 목표 달성! 🎉`, 'delight');
                          toggleGoal(goal.id);
                        }}
                        className={cn(
                          'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all',
                          goal.done
                            ? `border-${goal.color} bg-${goal.color}/20`
                            : 'border-white/20 hover:border-white/40'
                        )}
                      >
                        {goal.done && <Check className={cn('w-3 h-3', textColor[goal.color])} />}
                      </button>
                      <span className={cn('text-sm flex-1 transition-all', goal.done ? 'line-through text-on-surface-variant/50' : 'text-on-surface')}>
                        {goal.text}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {GOAL_COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => {
                              setWeeklyGoals(prev => prev.map(g => g.id === goal.id ? { ...g, color: c } : g));
                              apiFetch(`/api/data/weekly-goals/${goal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ color: c }) }).catch(() => {});
                            }}
                            className={cn('w-3 h-3 rounded-full transition-transform hover:scale-125', dotColor[c], goal.color === c && 'ring-1 ring-white/60 scale-110')}
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => { deleteGoal(goal.id); toast('목표가 삭제되었습니다.', 'info'); }}
                        className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-error transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {addingGoal && (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.04] border border-primary/20">
                      <div className="flex items-center gap-1.5 shrink-0">
                        {(['primary','secondary','tertiary'] as WeeklyGoal['color'][]).map(c => (
                          <button
                            key={c}
                            onClick={() => setNewGoalColor(c)}
                            className={cn('w-3.5 h-3.5 rounded-full transition-all hover:scale-125', dotColor[c], newGoalColor === c && 'ring-2 ring-white/50 scale-110')}
                          />
                        ))}
                      </div>
                      <input
                        ref={addGoalRef}
                        value={newGoalText}
                        onChange={e => setNewGoalText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddGoal(); if (e.key === 'Escape') { setAddingGoal(false); setNewGoalText(''); } }}
                        placeholder="이번 주 목표를 입력하세요..."
                        className="flex-1 bg-transparent border-none text-sm focus:ring-0 outline-none placeholder:text-on-surface-variant/40"
                      />
                      <button onClick={handleAddGoal} className="text-primary hover:text-secondary transition-colors">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setAddingGoal(false); setNewGoalText(''); }} className="text-on-surface-variant hover:text-on-surface transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {weeklyGoals.length === 0 && !addingGoal && (
                    <button
                      onClick={() => setAddingGoal(true)}
                      className="w-full py-8 border-2 border-dashed border-outline-variant/15 rounded-xl text-on-surface-variant hover:text-primary hover:border-primary/30 transition-all text-sm font-medium"
                    >
                      + 첫 번째 목표를 추가하세요
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Team Completion Rate */}
          {(() => {
            // 개인 칸반 완료율 (팀이 없으면 이걸 표시)
            const allKanbanTasks = kanban.flatMap(c => c.tasks);
            const myDone  = allKanbanTasks.filter(t => t.isCompleted).length;
            const myTotal = allKanbanTasks.length || 1;
            const myKanbanRate = Math.round((myDone / myTotal) * 100);
            const myRate = teamStats.length === 0 ? myKanbanRate : myTeamRate;

            const colorGrad: Record<string, string> = {
              primary: 'from-primary to-secondary',
              secondary: 'from-secondary to-tertiary',
              tertiary: 'from-tertiary to-primary',
              error: 'from-error to-tertiary',
            };

            if (teamStats.length === 0) {
              // 소속 팀 없음 — 내 개인 완료율만
              return (
                <div className="bg-gradient-to-br from-primary/20 to-secondary/20 p-6 rounded-2xl border border-white/10 relative overflow-hidden flex-[1]">
                  <div className="flex justify-between items-center mb-5">
                    <div>
                      <h2 className="font-headline font-bold text-lg">팀 완료율</h2>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">개인 업무 달성 현황</p>
                    </div>
                    <div className="text-right">
                      <span className="text-3xl font-black font-headline">{myRate}%</span>
                      <div className="flex items-center justify-end text-xs text-primary font-bold mt-0.5">
                        <TrendingUp className="w-3 h-3 mr-1" />칸반 완료 기준
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-primary">{user?.name ?? '나'} (나)</span>
                      <span className="text-xs font-bold text-primary">{myRate}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all" style={{ width: `${myRate}%` }} />
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div className="flex-[1] space-y-4">
                {teamStats.map(team => {
                  const avg = team.members.length === 0 ? 0 : Math.round(team.members.reduce((s, m) => s + m.rate, 0) / team.members.length);
                  const grad = colorGrad[team.color] ?? colorGrad.primary;
                  return (
                    <div key={team.id} className="bg-gradient-to-br from-primary/20 to-secondary/20 p-6 rounded-2xl border border-white/10 relative overflow-hidden">
                      <div className="flex justify-between items-center mb-5">
                        <div>
                          <h2 className="font-headline font-bold text-lg">{team.name}</h2>
                          <p className="text-[11px] text-on-surface-variant mt-0.5">팀 스프린트 달성률</p>
                        </div>
                        <div className="text-right">
                          <span className="text-3xl font-black font-headline">{avg}%</span>
                          <div className="flex items-center justify-end text-xs text-primary font-bold mt-0.5">
                            <TrendingUp className="w-3 h-3 mr-1" />팀 평균
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {team.members.map(m => (
                          <div key={m.id} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={cn('w-5 h-5 rounded-full bg-gradient-to-br flex items-center justify-center text-[9px] font-bold text-surface shrink-0', grad)}>
                                  {m.name.charAt(0)}
                                </div>
                                <span className={cn('text-xs font-medium', m.isMe ? 'text-primary font-bold' : 'text-on-surface-variant')}>
                                  {m.name}{m.isMe && ' (나)'}
                                </span>
                              </div>
                              <span className={cn('text-xs font-bold', m.rate >= 80 ? 'text-primary' : m.rate >= 60 ? 'text-secondary' : 'text-tertiary')}>
                                {m.rate}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                              <div className={cn('h-full rounded-full bg-gradient-to-r transition-all', grad)} style={{ width: `${m.rate}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* ── Activity Feed ─────────────────────────────────────── */}
        <div className="lg:col-span-12 glass-panel rounded-2xl overflow-hidden">
          <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <h2 className="font-headline font-bold text-xl">시스템 활동 피드</h2>
              {unreadCount > 0 && (
                <span className="bg-secondary/20 text-secondary text-[10px] font-bold px-2 py-0.5 rounded-full">{unreadCount} 새 항목</span>
              )}
            </div>
            <button
              onClick={handleMarkAllRead}
              className="text-xs font-bold text-primary hover:text-secondary transition-colors"
            >
              모두 읽음
            </button>
          </div>
          <div className="divide-y divide-white/5">
            {activities.length === 0 ? (
              <div className="px-8 py-12 text-center text-on-surface-variant/40 text-sm">
                활동 내역이 없습니다.
              </div>
            ) : (
              activities.map((a) => (
                <ActivityRow key={a.id} activity={a} onDetail={() => setActivityDetail(a)} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Metric Modals ────────────────────────────────────── */}
      <MetricModal open={metricModal === 'tasks'}     onClose={() => setMetricModal(null)} type="tasks"     sprintTasks={sprintTasks} kanban={kanban} />
      <MetricModal open={metricModal === 'time'}      onClose={() => setMetricModal(null)} type="time"      sprintTasks={sprintTasks} kanban={kanban} projects={projects} getProjectProgress={getProjectProgress} avgProjectProgress={avgProjectProgress} />
      <MetricModal open={metricModal === 'deadlines'} onClose={() => setMetricModal(null)} type="deadlines" sprintTasks={sprintTasks} kanban={kanban} calEvents={calEvents} onOpenCalendar={() => { setMetricModal(null); setCalOpen(true); }} />

      {/* ── Activity Detail Modal ──────────────────────────────── */}
      {activityDetail && (
        <ActivityDetailModal activity={activityDetail} onClose={() => setActivityDetail(null)} />
      )}

      {/* ── Calendar Modal ────────────────────────────────────── */}
      <CalendarModal
        open={calOpen}
        onClose={() => setCalOpen(false)}
        events={calEvents}
        onAddEvent={addCalEvent}
        onEditEvent={editCalEvent}
        onDeleteEvent={deleteCalEvent}
      />

      {/* ── New Project Modal ──────────────────────────────────── */}
      <Modal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} title="새 프로젝트 생성">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">프로젝트 이름 *</label>
            <input
              autoFocus
              value={projName}
              onChange={(e) => setProjName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
              placeholder="ex) Aether Dashboard"
              className="w-full bg-surface-container-highest rounded-xl py-3 px-4 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-low transition-all placeholder:text-on-surface-variant/40"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">현재 단계</label>
            <input
              value={projPhase}
              onChange={(e) => setProjPhase(e.target.value)}
              placeholder="ex) Design Phase"
              className="w-full bg-surface-container-highest rounded-xl py-3 px-4 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-low transition-all placeholder:text-on-surface-variant/40"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">팀원 수</label>
            <input
              type="number" min="1" max="99"
              value={projMembers}
              onChange={(e) => setProjMembers(e.target.value)}
              className="w-full bg-surface-container-highest rounded-xl py-3 px-4 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-low transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">색상</label>
            <div className="flex gap-3">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setProjColor(c.value)}
                  className={cn(
                    'flex-1 py-2 rounded-xl text-xs font-bold transition-all bg-gradient-to-br',
                    c.value,
                    projColor === c.value ? 'ring-2 ring-white/40 scale-[1.03]' : 'opacity-50 hover:opacity-80'
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setNewProjectOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-white/5 transition-all">취소</button>
            <button
              onClick={handleCreateProject}
              disabled={!projName.trim()}
              className="px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-primary to-secondary text-surface shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              생성하기
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Metric Modal ─────────────────────────────────────────────────────────────

const ACTIVITY_DATA = [
  { day: '월', rate: 72, commits: 8,  reviews: 3 },
  { day: '화', rate: 85, commits: 12, reviews: 5 },
  { day: '수', rate: 68, commits: 6,  reviews: 2 },
  { day: '목', rate: 91, commits: 15, reviews: 7 },
  { day: '금', rate: 84, commits: 11, reviews: 4 },
  { day: '토', rate: 55, commits: 4,  reviews: 1 },
  { day: '일', rate: 40, commits: 2,  reviews: 0 },
];

const TIME_DATA = [
  { project: 'Solaris Mobile App', hours: 12.5, color: 'from-primary to-primary-dim',     pct: 36 },
  { project: 'Aether CMS',         hours: 9.2,  color: 'from-secondary to-secondary-dim', pct: 27 },
  { project: 'Nexus Branding',     hours: 7.0,  color: 'from-tertiary to-tertiary-dim',   pct: 20 },
  { project: '내부 도구',           hours: 3.8,  color: 'from-primary/60 to-primary-dim',  pct: 11 },
  { project: '클라이언트 지원',      hours: 1.7,  color: 'from-white/20 to-white/10',       pct:  6 },
];

const TICKET_DATA = [
  { label: 'UI 디자인',  closed: 54, open: 8,  color: 'primary' },
  { label: '프론트엔드', closed: 47, open: 5,  color: 'secondary' },
  { label: '백엔드',     closed: 38, open: 12, color: 'tertiary' },
  { label: 'QA / 테스트', closed: 31, open: 3, color: 'primary' },
  { label: '브랜딩',     closed: 18, open: 2,  color: 'tertiary' },
];

function MetricModal({ open, onClose, type, sprintTasks, kanban, calEvents, onOpenCalendar, projects, getProjectProgress, avgProjectProgress }: {
  open: boolean;
  onClose: () => void;
  type: 'tasks' | 'time' | 'deadlines';
  sprintTasks: any[];
  kanban: any[];
  calEvents?: CalEvent[];
  onOpenCalendar?: () => void;
  projects?: any[];
  getProjectProgress?: (id: string) => number;
  avgProjectProgress?: number;
}) {
  if (!open) return null;

  const titles = { tasks: '개인 업무 현황', time: '프로젝트 달성률', deadlines: '다가오는 마감' };

  // Computed values
  const allKanbanTasks = kanban.flatMap((c: any) => c.tasks);
  const pendingSprint  = sprintTasks.filter((t: any) => !t.checked);
  const doneSprint     = sprintTasks.filter((t: any) => t.checked);
  const sprintRate     = sprintTasks.length ? Math.round((doneSprint.length / sprintTasks.length) * 100) : 0;

  const today0 = new Date(); today0.setHours(0,0,0,0);
  const in7 = new Date(today0); in7.setDate(in7.getDate() + 7);
  const upcoming = (calEvents ?? []).filter(e => { const d = new Date(e.date + 'T00:00'); return d >= today0 && d <= in7; })
    .sort((a, b) => a.date.localeCompare(b.date));
  const urgentEvents = (calEvents ?? []).filter(e => e.color === 'error' && new Date(e.date + 'T00:00') >= today0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl bg-surface-container-highest/80 backdrop-blur-[20px] rounded-2xl border border-white/10 shadow-[0_24px_48px_rgba(0,0,0,0.5)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <h2 className="font-headline font-bold text-lg">{titles[type]}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-on-surface-variant hover:text-on-surface">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          {type === 'tasks' && (() => {
            const doneCol   = kanban.find((c: any) => c.title === '완료');
            const doneCnt   = doneCol?.tasks.length ?? 0;
            const totalCnt  = allKanbanTasks.length;
            const progress  = totalCnt ? Math.round((doneCnt / totalCnt) * 100) : 0;
            const todoCnt   = kanban.find((c: any) => c.title === '할 일')?.tasks.length ?? 0;
            const inProgCnt = allKanbanTasks.length - todoCnt - doneCnt;
            return (
            <div className="space-y-5">
              {/* 완료율 대형 표시 */}
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-5xl font-black font-headline text-primary">{progress}<span className="text-xl font-normal text-on-surface-variant ml-1">%</span></p>
                  <p className="text-xs text-on-surface-variant mt-1">개인 업무 완료율 (칸반 기준)</p>
                </div>
                <div className="text-xs text-on-surface-variant bg-white/5 px-3 py-1.5 rounded-lg">
                  총 <span className="text-primary font-bold">{totalCnt}개</span> 태스크
                </div>
              </div>

              {/* 완료율 바 */}
              <div className="bg-white/5 rounded-xl p-4">
                <div className="flex justify-between text-[11px] text-on-surface-variant mb-3">
                  <span className="font-bold uppercase tracking-widest">완료 진행률</span>
                  <span className="font-bold text-primary">{doneCnt} / {totalCnt}</span>
                </div>
                <div className="h-3 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>

              {/* Summary 3칸 */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: '할 일',   value: todoCnt,   color: 'text-primary' },
                  { label: '진행 중', value: inProgCnt, color: 'text-secondary' },
                  { label: '완료',    value: doneCnt,   color: 'text-tertiary' },
                ].map(s => (
                  <div key={s.label} className="bg-white/5 rounded-xl p-4 text-center">
                    <p className={cn('text-3xl font-black font-headline', s.color)}>{s.value}<span className="text-xs font-normal text-on-surface-variant ml-1">개</span></p>
                    <p className="text-[11px] text-on-surface-variant mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* 칸반 열별 비율 바 */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">컬럼별 현황</p>
                {kanban.map((col: any) => {
                  const pct = totalCnt ? Math.round((col.tasks.length / totalCnt) * 100) : 0;
                  return (
                    <div key={col.id} className="flex items-center gap-3">
                      <span className="text-sm w-16 shrink-0">{col.title}</span>
                      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', col.color === 'primary' ? 'bg-primary' : col.color === 'secondary' ? 'bg-secondary' : 'bg-tertiary')}
                          style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-bold text-on-surface-variant w-16 text-right">{col.tasks.length}개 ({pct}%)</span>
                    </div>
                  );
                })}
              </div>

              {/* 완료된 태스크 목록 */}
              {doneCol && doneCol.tasks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">완료된 태스크</p>
                  {doneCol.tasks.map((t: any) => (
                    <div key={t.id} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
                      <div className="w-2 h-2 rounded-full bg-tertiary shrink-0" />
                      <span className="text-sm flex-1 line-through text-on-surface-variant">{t.title}</span>
                      <span className="text-[10px] text-tertiary font-bold">완료</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            );
          })()}

          {type === 'time' && (
            <div className="space-y-5">
              {/* 전체 평균 달성률 */}
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-4xl font-black font-headline">{avgProjectProgress ?? 0}<span className="text-lg font-normal text-on-surface-variant ml-1">%</span></p>
                  <p className="text-xs text-on-surface-variant mt-1">전체 프로젝트 평균 달성률</p>
                </div>
                <div className="text-xs text-on-surface-variant bg-white/5 px-3 py-1.5 rounded-lg">
                  총 <span className="text-secondary font-bold">{projects?.length ?? 0}개</span> 프로젝트
                </div>
              </div>

              {/* 평균 달성률 바 */}
              <div className="bg-white/5 rounded-xl p-4">
                <div className="flex justify-between text-[11px] text-on-surface-variant mb-3">
                  <span className="font-bold uppercase tracking-widest">평균 달성률</span>
                  <span className="font-bold text-secondary">{avgProjectProgress ?? 0}%</span>
                </div>
                <div className="h-2.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-secondary to-primary" style={{ width: `${avgProjectProgress ?? 0}%` }} />
                </div>
              </div>

              {/* 프로젝트별 달성률 */}
              <div className="space-y-3">
                <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">프로젝트별 달성률</p>
                {(projects ?? []).length === 0 ? (
                  <p className="text-sm text-on-surface-variant/50 py-2">진행 중인 프로젝트가 없습니다.</p>
                ) : (projects ?? []).map((p, i) => {
                  const pct = getProjectProgress ? getProjectProgress(p.id) : 0;
                  const colors = [
                    { dot: 'from-primary to-primary-dim', bar: 'from-primary to-primary-dim' },
                    { dot: 'from-secondary to-secondary-dim', bar: 'from-secondary to-secondary-dim' },
                    { dot: 'from-tertiary to-tertiary-dim', bar: 'from-tertiary to-tertiary-dim' },
                  ];
                  const c = colors[i % colors.length];
                  return (
                    <div key={p.id} className="space-y-1.5">
                      <div className="flex items-center gap-3">
                        <div className={cn('w-2.5 h-2.5 rounded-full bg-gradient-to-br shrink-0', c.dot)} />
                        <span className="text-sm flex-1 truncate">{p.name}</span>
                        <span className="text-xs font-bold text-on-surface-variant">{pct}%</span>
                      </div>
                      <div className="ml-5 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full bg-gradient-to-r', c.bar)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {type === 'deadlines' && (
            <div className="space-y-5">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-4xl font-black font-headline">{upcoming.length}</p>
                  <p className="text-xs text-on-surface-variant mt-1">7일 이내 예정 이벤트</p>
                </div>
                {urgentEvents.length > 0 && (
                  <div className="flex items-center gap-1.5 text-error text-sm font-bold bg-error/10 px-3 py-1.5 rounded-lg">
                    <Calendar className="w-3.5 h-3.5" />긴급 {urgentEvents.length}건
                  </div>
                )}
              </div>

              {/* Upcoming list */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">이번 주 일정</p>
                {upcoming.length === 0
                  ? <p className="text-sm text-on-surface-variant/50 py-4 text-center">이번 주 예정된 일정이 없습니다.</p>
                  : upcoming.map(ev => {
                    const d = new Date(ev.date + 'T00:00');
                    const label = d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' });
                    return (
                      <div key={ev.id} className={cn('flex items-center gap-3 rounded-xl px-4 py-3 border', EVENT_COLOR[ev.color])}>
                        <div className="shrink-0 text-center w-12">
                          <p className="text-[10px] font-bold opacity-70">{label.split(' ')[0]}</p>
                          <p className="text-lg font-black font-headline leading-none">{d.getDate()}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          {ev.tag && <p className="text-[10px] font-bold opacity-60 uppercase">{ev.tag}</p>}
                          <p className="text-sm font-semibold truncate">{ev.title}</p>
                        </div>
                        {ev.time && (
                          <div className="flex items-center gap-1 opacity-70 shrink-0">
                            <Clock3 className="w-3 h-3" />
                            <span className="text-[11px]">{ev.time}</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                }
              </div>

              <button
                onClick={onOpenCalendar}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-surface text-sm font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                <Calendar className="w-4 h-4" />전체 캘린더 열기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Calendar Modal ───────────────────────────────────────────────────────────

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
const COLOR_TAG_OPTIONS: CalEvent['color'][] = ['primary','secondary','tertiary','error'];
const COLOR_TAG_LABELS: Record<CalEvent['color'], string> = { primary:'파랑', secondary:'보라', tertiary:'핑크', error:'빨강' };
const EVENT_COLOR: Record<CalEvent['color'], string> = {
  primary:   'bg-primary/20 text-primary border-primary/30',
  secondary: 'bg-secondary/20 text-secondary border-secondary/30',
  tertiary:  'bg-tertiary/20 text-tertiary border-tertiary/30',
  error:     'bg-error/20 text-error border-error/30',
};
const DOT_COLOR: Record<CalEvent['color'], string> = {
  primary:'bg-primary', secondary:'bg-secondary', tertiary:'bg-tertiary', error:'bg-error',
};

function CalendarModal({
  open, onClose, events, onAddEvent, onEditEvent, onDeleteEvent
}: {
  open: boolean;
  onClose: () => void;
  events: CalEvent[];
  onAddEvent: (ev: Omit<CalEvent,'id'>) => void;
  onEditEvent: (id: string, updates: Partial<Omit<CalEvent,'id'>>) => void;
  onDeleteEvent: (id: string) => void;
}) {
  const { toast } = useToast();
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [selDay,    setSelDay]    = useState<string | null>(null); // 'YYYY-MM-DD'

  // Add event form state
  const [addingEvent, setAddingEvent]   = useState(false);
  const [evTitle,  setEvTitle]    = useState('');
  const [evTime,   setEvTime]     = useState('');
  const [evTag,    setEvTag]      = useState('');
  const [evColor,  setEvColor]    = useState<CalEvent['color']>('primary');
  const [evSharing, setEvSharing] = useState<'personal' | 'all'>('personal');

  // Edit event state
  const [editingId, setEditingId] = useState<string | null>(null);

  // Reset add form when modal closes
  useEffect(() => {
    if (!open) { setAddingEvent(false); setSelDay(null); setEditingId(null); }
  }, [open]);

  function startEdit(ev: CalEvent) {
    setEditingId(ev.id);
    setEvTitle(ev.title);
    setEvTime(ev.time ?? '');
    setEvTag(ev.tag ?? '');
    setEvColor(ev.color);
    setEvSharing(ev.sharing ?? 'personal');
    setAddingEvent(false);
  }

  function cancelForm() {
    setAddingEvent(false);
    setEditingId(null);
    setEvTitle(''); setEvTime(''); setEvTag(''); setEvColor('primary'); setEvSharing('personal');
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y-1); setViewMonth(11); }
    else setViewMonth(m => m-1);
    setSelDay(null);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y+1); setViewMonth(0); }
    else setViewMonth(m => m+1);
    setSelDay(null);
  }
  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelDay(null);
  }

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({length: daysInMonth}, (_, i) => i+1),
  ];
  // pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  function dateKey(day: number) {
    return `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  function eventsOn(day: number) {
    return events.filter(e => e.date === dateKey(day));
  }
  const isToday = (day: number) => {
    return today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
  };

  const selEvents = selDay ? events.filter(e => e.date === selDay) : [];

  function handleAddEvent() {
    if (!evTitle.trim() || !selDay) return;
    onAddEvent({ title: evTitle.trim(), date: selDay, time: evTime, color: evColor, tag: evTag.trim() || undefined, sharing: evSharing });
    toast(`"${evTitle.trim()}" 이벤트가 추가되었습니다.`, 'success');
    cancelForm();
  }

  function handleEditEvent() {
    if (!editingId || !evTitle.trim()) return;
    onEditEvent(editingId, { title: evTitle.trim(), time: evTime, color: evColor, tag: evTag.trim() || undefined, sharing: evSharing });
    toast(`이벤트가 수정되었습니다.`, 'success');
    cancelForm();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-4xl bg-surface-container-highest/80 backdrop-blur-[20px] rounded-2xl border border-white/10 shadow-[0_24px_48px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <div className="flex items-center gap-4">
            <h2 className="font-headline font-bold text-xl">Calendar</h2>
            <button onClick={goToday} className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold transition-colors">오늘</button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-on-surface-variant hover:text-on-surface">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-headline font-bold text-base w-24 text-center">
              {viewYear}년 {MONTH_NAMES[viewMonth]}
            </span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-on-surface-variant hover:text-on-surface">
              <ChevronRightIcon className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="ml-2 p-1.5 rounded-lg hover:bg-white/10 transition-colors text-on-surface-variant hover:text-on-surface">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Calendar grid */}
          <div className="flex-1 p-4 overflow-auto">
            {/* Day-of-week header */}
            <div className="grid grid-cols-7 mb-2">
              {DAY_LABELS.map((d, i) => (
                <div key={d} className={cn('text-center text-[11px] font-bold uppercase py-2',
                  i === 0 ? 'text-error/70' : i === 6 ? 'text-primary/70' : 'text-on-surface-variant'
                )}>{d}</div>
              ))}
            </div>
            {/* Cells */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, idx) => {
                if (!day) return <div key={idx} />;
                const key = dateKey(day);
                const evs = eventsOn(day);
                const isSel = selDay === key;
                const isTod = isToday(day);
                const isSun = idx % 7 === 0;
                const isSat = idx % 7 === 6;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelDay(isSel ? null : key)}
                    className={cn(
                      'relative min-h-[72px] p-2 rounded-xl text-left transition-all',
                      'hover:bg-white/5 border border-transparent',
                      isSel && 'bg-primary/10 border-primary/30',
                      isTod && !isSel && 'border-primary/20 bg-primary/5',
                    )}
                  >
                    <span className={cn(
                      'text-xs font-bold block mb-1',
                      isTod ? 'w-5 h-5 rounded-full bg-primary text-surface flex items-center justify-center text-[10px]' : '',
                      isSun ? 'text-error/80' : isSat ? 'text-primary/80' : 'text-on-surface-variant',
                    )}>{day}</span>
                    <div className="space-y-0.5">
                      {evs.slice(0,2).map(ev => (
                        <div key={ev.id} className={cn('text-[10px] px-1.5 py-0.5 rounded truncate font-medium border', EVENT_COLOR[ev.color])}>
                          {ev.title}
                        </div>
                      ))}
                      {evs.length > 2 && (
                        <div className="text-[10px] text-on-surface-variant px-1">+{evs.length-2}개</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Side panel: selected day events */}
          <div className="w-72 border-l border-white/5 flex flex-col bg-white/[0.02]">
            {selDay ? (
              <>
                <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-on-surface-variant font-medium">
                      {new Date(selDay + 'T00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                    </p>
                    <p className="font-headline font-bold text-sm mt-0.5">{selEvents.length}개의 이벤트</p>
                  </div>
                  <button
                    onClick={() => { cancelForm(); if (!addingEvent && !editingId) setAddingEvent(true); }}
                    className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors"
                  >
                    {(addingEvent || editingId) ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Add / Edit event form */}
                {(addingEvent || editingId) && (
                  <div className="px-4 py-3 border-b border-white/5 space-y-2.5 bg-white/[0.03]">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                      {editingId ? '이벤트 수정' : '새 이벤트'}
                    </p>
                    <input
                      autoFocus
                      value={evTitle}
                      onChange={e => setEvTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') editingId ? handleEditEvent() : handleAddEvent(); if (e.key === 'Escape') cancelForm(); }}
                      placeholder="이벤트 제목"
                      className="w-full bg-surface-container rounded-lg px-3 py-2 text-xs border-none focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-on-surface-variant/40"
                    />
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Clock3 className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-on-surface-variant" />
                        <input
                          type="time"
                          value={evTime}
                          onChange={e => setEvTime(e.target.value)}
                          className="w-full bg-surface-container rounded-lg pl-6 pr-2 py-2 text-xs border-none focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                      </div>
                      <div className="relative flex-1">
                        <Tag className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-on-surface-variant" />
                        <input
                          value={evTag}
                          onChange={e => setEvTag(e.target.value)}
                          placeholder="태그"
                          className="w-full bg-surface-container rounded-lg pl-6 pr-2 py-2 text-xs border-none focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-on-surface-variant/40"
                        />
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {COLOR_TAG_OPTIONS.map(c => (
                        <button
                          key={c}
                          onClick={() => setEvColor(c)}
                          className={cn('flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all', EVENT_COLOR[c],
                            evColor === c ? 'ring-1 ring-white/30' : 'opacity-50 hover:opacity-80'
                          )}
                        >
                          {COLOR_TAG_LABELS[c]}
                        </button>
                      ))}
                    </div>
                    {/* 공유 설정 */}
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setEvSharing('personal')}
                        className={cn('flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border',
                          evSharing === 'personal' ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-white/5 border-white/10 text-on-surface-variant hover:bg-white/10'
                        )}
                      >
                        <Lock className="w-2.5 h-2.5" />개인
                      </button>
                      <button
                        onClick={() => setEvSharing('all')}
                        className={cn('flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border',
                          evSharing === 'all' ? 'bg-secondary/20 border-secondary/40 text-secondary' : 'bg-white/5 border-white/10 text-on-surface-variant hover:bg-white/10'
                        )}
                      >
                        <Globe className="w-2.5 h-2.5" />전체 공유
                      </button>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={cancelForm}
                        className="flex-1 py-2 rounded-lg bg-white/5 text-on-surface-variant text-xs font-bold hover:bg-white/10 transition-all"
                      >
                        취소
                      </button>
                      <button
                        onClick={editingId ? handleEditEvent : handleAddEvent}
                        disabled={!evTitle.trim()}
                        className="flex-1 py-2 rounded-lg bg-gradient-to-r from-primary to-secondary text-surface text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-3 h-3" />{editingId ? '저장' : '추가'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Event list */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                  {selEvents.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="w-8 h-8 text-on-surface-variant/30 mx-auto mb-2" />
                      <p className="text-xs text-on-surface-variant">이벤트 없음</p>
                      <button onClick={() => setAddingEvent(true)} className="mt-2 text-xs text-primary hover:underline">+ 추가하기</button>
                    </div>
                  ) : selEvents.map(ev => (
                    <div key={ev.id} className={cn('p-3 rounded-xl border group relative transition-all hover:brightness-110', EVENT_COLOR[ev.color])}>
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          {ev.tag && <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{ev.tag}</span>}
                          <p className="text-xs font-semibold mt-0.5">{ev.title}</p>
                          {ev.time && (
                            <div className="flex items-center gap-1 mt-1 opacity-70">
                              <Clock3 className="w-2.5 h-2.5" />
                              <span className="text-[10px]">{ev.time}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                          {ev.sharing === 'all'
                            ? <Globe className="w-2.5 h-2.5 text-secondary" title="전체 공유" />
                            : <Lock className="w-2.5 h-2.5 opacity-40" title="개인" />
                          }
                          <button
                            onClick={() => startEdit(ev)}
                            className="hover:scale-110 transition-all"
                            title="수정"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => { onDeleteEvent(ev.id); toast('이벤트가 삭제되었습니다.', 'info'); }}
                            className="hover:scale-110 transition-all"
                            title="삭제"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
                <Calendar className="w-10 h-10 text-on-surface-variant/20" />
                <p className="text-xs text-on-surface-variant text-center leading-relaxed">날짜를 클릭하면<br/>이벤트를 확인하고<br/>추가할 수 있습니다.</p>
                {/* Mini legend */}
                <div className="mt-4 w-full space-y-2">
                  <p className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-widest">이번 달 이벤트</p>
                  {events.filter(e => {
                    const [y, m] = e.date.split('-').map(Number);
                    return y === viewYear && m === viewMonth + 1;
                  }).slice(0, 4).map(ev => (
                    <div key={ev.id} className="flex items-center gap-2">
                      <div className={cn('w-2 h-2 rounded-full shrink-0', DOT_COLOR[ev.color])} />
                      <span className="text-[11px] text-on-surface-variant truncate">{ev.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, trend, color, onClick }: any) {
  const colorClasses = {
    primary:   'bg-primary/10 text-primary hover:border-primary/30',
    secondary: 'bg-secondary/10 text-secondary hover:border-secondary/30',
    tertiary:  'bg-tertiary/10 text-tertiary hover:border-tertiary/30',
  }[color as string];
  return (
    <div onClick={onClick} className={cn('glass-panel p-6 rounded-2xl group transition-all cursor-pointer active:scale-95', colorClasses)}>
      <div className="flex items-center justify-between mb-4">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', colorClasses)}>
          <Icon className="w-5 h-5" />
        </div>
        <span className={cn('text-xs font-bold px-2 py-0.5 rounded', colorClasses)}>{trend}</span>
      </div>
      <p className="text-on-surface-variant text-sm font-medium">{label}</p>
      <h3 className="text-3xl font-black font-headline mt-1 tracking-tight">{value}</h3>
    </div>
  );
}

function ProjectProgress({ project }: { project: any; key?: React.Key }) {
  const navigate = useNavigate();
  return (
    <div
      className="relative group cursor-pointer"
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-4">
          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg bg-gradient-to-br', project.color)}>
            {project.initial}
          </div>
          <div>
            <h4 className="font-bold text-base group-hover:text-primary transition-colors">{project.name}</h4>
            <p className="text-xs text-on-surface-variant">{project.phase} • {project.members.length}명</p>
          </div>
        </div>
        <span className="text-sm font-mono text-primary font-bold">{project.progress}%</span>
      </div>
      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
        <div className={cn('h-full bg-gradient-to-r rounded-full shadow-[0_0_12px_rgba(151,169,255,0.4)]', project.color)} style={{ width: `${project.progress}%` }} />
      </div>
    </div>
  );
}

function DeadlineItem({ month, day, title, time, color, onOpen }: any) {
  const colorMap: Record<string, string> = {
    error: 'bg-error/10 text-error',
    secondary: 'bg-secondary/10 text-secondary',
    primary: 'bg-primary/10 text-primary',
    tertiary: 'bg-tertiary/10 text-tertiary',
  };
  const colorClasses = colorMap[color as string] ?? colorMap.primary;
  const textColor: Record<string, string> = {
    error: 'text-error', secondary: 'text-secondary', primary: 'text-primary', tertiary: 'text-tertiary',
  };
  return (
    <div
      onClick={onOpen}
      className="flex items-center gap-4 bg-white/5 px-4 py-3 rounded-xl border border-white/5 group hover:bg-white/10 transition-all cursor-pointer"
    >
      <div className={cn('w-10 h-10 rounded-lg flex flex-col items-center justify-center leading-none shrink-0', colorClasses)}>
        <span className="text-[10px] font-bold">{month}</span>
        <span className="text-lg font-black">{day}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate">{title}</p>
        <p className={cn('text-[11px] font-medium', textColor[color] ?? 'text-on-surface-variant')}>{time}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-on-surface-variant group-hover:translate-x-1 transition-transform shrink-0" />
    </div>
  );
}

function TaskItem({ task, onToggle, onDelete }: { task: any; onToggle: () => void; onDelete: () => void; key?: React.Key }) {
  return (
    <div className="flex items-center gap-4 group">
      <label className="flex items-center gap-4 cursor-pointer flex-1">
        <input
          checked={task.checked}
          onChange={onToggle}
          className={cn('w-5 h-5 rounded border-white/10 bg-transparent text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer', task.checked && 'bg-primary')}
          type="checkbox"
        />
        <span className={cn('text-sm transition-colors', task.checked ? 'line-through text-outline-variant italic' : 'text-on-surface-variant group-hover:text-on-surface')}>
          {task.label}
        </span>
      </label>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-error transition-all"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function ActivityRow({ activity, onDetail }: { activity: any; onDetail?: () => void; key?: React.Key }) {
  const colorClasses: Record<string, string> = {
    primary:   'text-primary bg-primary/10',
    secondary: 'text-secondary bg-secondary/10',
    tertiary:  'text-tertiary bg-tertiary/10',
  };
  const iconMap: Record<string, React.ElementType> = { primary: MessageCircle, secondary: Code, tertiary: Zap };
  const Icon = iconMap[activity.color] || Zap;

  return (
    <div
      onClick={onDetail}
      className={cn(
        'px-8 py-5 flex items-start gap-6 hover:bg-white/[0.05] transition-colors group cursor-pointer',
        !activity.read && 'border-l-2 border-secondary/40'
      )}
    >
      <div className="relative">
        <div className="w-10 h-10 rounded-full ring-2 ring-primary/20 bg-surface-container-highest flex items-center justify-center text-sm font-bold">
          {activity.user.charAt(0)}
        </div>
        <div className={cn('absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center', colorClasses[activity.color]?.split(' ')[1])}>
          <Icon className="w-2.5 h-2.5" />
        </div>
      </div>
      <div className="flex-1">
        <p className="text-sm">
          <span className="font-bold text-on-surface">{activity.user}</span>
          <span className="text-on-surface-variant mx-1">{activity.action}</span>
          <span className={cn('font-semibold', colorClasses[activity.color]?.split(' ')[0])}>{activity.target}</span>
        </p>
        <p className="text-xs text-outline-variant mt-1.5">{activity.time}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0 mt-0.5">
        {!activity.read && <div className="w-2 h-2 rounded-full bg-secondary" />}
        <ChevronRight className="w-4 h-4 text-on-surface-variant/30 group-hover:text-on-surface-variant group-hover:translate-x-0.5 transition-all" />
      </div>
    </div>
  );
}

function ActivityDetailModal({ activity, onClose }: { activity: any; onClose: () => void }) {
  const colorClasses: Record<string, string> = {
    primary:   'text-primary bg-primary/10 border-primary/20',
    secondary: 'text-secondary bg-secondary/10 border-secondary/20',
    tertiary:  'text-tertiary bg-tertiary/10 border-tertiary/20',
  };
  const iconMap: Record<string, React.ElementType> = { primary: MessageCircle, secondary: Code, tertiary: Zap };
  const Icon = iconMap[activity.color] || Zap;
  const cls = colorClasses[activity.color] ?? colorClasses.primary;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-surface-container-highest/80 backdrop-blur-[20px] rounded-2xl border border-white/10 shadow-[0_24px_48px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <h2 className="font-headline font-bold text-base">활동 상세</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-on-surface-variant hover:text-on-surface transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          {/* 유저 */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-surface-container-highest flex items-center justify-center text-lg font-bold ring-2 ring-primary/20">
              {activity.user.charAt(0)}
            </div>
            <div>
              <p className="font-bold text-base">{activity.user}</p>
              <p className="text-xs text-on-surface-variant">{activity.time}</p>
            </div>
          </div>

          {/* 액션 */}
          <div className={cn('rounded-xl px-4 py-4 border', cls)}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">액션</span>
            </div>
            <p className="text-sm font-medium">
              {activity.action}{' '}
              <span className="font-bold">{activity.target}</span>
            </p>
          </div>

          {/* 상태 */}
          <div className="flex items-center justify-between text-sm bg-white/5 rounded-xl px-4 py-3">
            <span className="text-on-surface-variant">읽음 상태</span>
            <span className={cn('font-bold', activity.read ? 'text-tertiary' : 'text-secondary')}>
              {activity.read ? '읽음' : '안 읽음'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
