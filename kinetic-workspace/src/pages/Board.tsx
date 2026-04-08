import React, { useState, useRef, useEffect } from 'react';
import { Plus, MoreHorizontal, Edit2, CheckCircle2, Calendar, Paperclip, MessageCircle, Trash2, X, Tag, BarChart2, UserPlus, Users, ArrowRightLeft } from 'lucide-react';
import { cn } from '../lib/utils';
import { useApp, KanbanTask, KanbanColumn } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from '../components/Modal';

type ColorType = 'primary' | 'secondary' | 'tertiary';

const TAG_OPTIONS = ['UI 디자인', '프론트엔드', '백엔드', '브랜딩', '시스템', '리서치', '성공'];

const COLOR_OPTIONS: { label: string; value: ColorType }[] = [
  { label: '파랑', value: 'primary' },
  { label: '보라', value: 'secondary' },
  { label: '분홍', value: 'tertiary' },
];

export function Board() {
  const { kanban, addKanbanTask, editKanbanTask, deleteKanbanTask, moveKanbanTask, addKanbanColumn, deleteKanbanColumn } = useApp();
  const { toast } = useToast();
  const { user } = useAuth();

  // 드래그 중인 태스크 참조 (컬럼 간 이동용)
  const dragRef = useRef<{ colId: string; task: KanbanTask } | null>(null);

  // 개인 업무 보드 — 담당자는 본인만
  const allMembers = user ? [{ name: user.name, initial: user.name.charAt(0), color: 'from-primary to-secondary' }] : [];
  const TEAM_MEMBERS = allMembers;


  // New Task modal
  const [newTaskModal, setNewTaskModal] = useState<{ open: boolean; colId: string }>({ open: false, colId: '' });
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc]   = useState('');
  const [taskTag, setTaskTag]     = useState(TAG_OPTIONS[0]);
  const [taskColor, setTaskColor] = useState<ColorType>('primary');
  const [taskDate, setTaskDate]   = useState('');
  const [taskPriority, setTaskPriority] = useState('');

  // Edit Task modal
  const [editModal, setEditModal] = useState<{ open: boolean; colId: string; task: KanbanTask | null }>({ open: false, colId: '', task: null });
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc]   = useState('');

  // Task Detail modal
  const [detailModal, setDetailModal] = useState<{ open: boolean; colId: string; task: KanbanTask | null }>({ open: false, colId: '', task: null });
  const [detailTitle, setDetailTitle] = useState('');
  const [detailDesc, setDetailDesc]   = useState('');
  const [detailTag, setDetailTag]     = useState('');
  const [detailDate, setDetailDate]   = useState('');
  const [detailPriority, setDetailPriority] = useState('');
  const [detailColor, setDetailColor] = useState<ColorType>('primary');
  const [editingDetailTitle, setEditingDetailTitle] = useState(false);
  const [editingDetailDesc, setEditingDetailDesc]   = useState(false);

  // Add column modal
  const [colModal, setColModal] = useState(false);
  const [colName, setColName]   = useState('');

  // Column more menu
  const [colMenu, setColMenu] = useState<string | null>(null);
  const colMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setColMenu(null);
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  function openNewTask(colId: string) {
    setNewTaskModal({ open: true, colId });
    setTaskTitle(''); setTaskDesc(''); setTaskTag(TAG_OPTIONS[0]); setTaskColor('primary'); setTaskDate(''); setTaskPriority('');
  }

  async function handleCreateTask() {
    if (!taskTitle.trim()) return;
    await addKanbanTask(newTaskModal.colId, {
      tag: taskTag, title: taskTitle.trim(), desc: taskDesc.trim() || undefined,
      date: taskDate || undefined, priority: taskPriority || undefined,
      color: taskColor,
    });
    toast(`"${taskTitle.trim()}" 태스크가 추가되었습니다.`, 'success');
    setNewTaskModal({ open: false, colId: '' });
  }

  function openEdit(colId: string, task: KanbanTask) {
    setEditModal({ open: true, colId, task });
    setEditTitle(task.title); setEditDesc(task.desc ?? '');
  }

  function openDetail(colId: string, task: KanbanTask) {
    setDetailModal({ open: true, colId, task });
    setDetailTitle(task.title);
    setDetailDesc(task.desc ?? '');
    setDetailTag(task.tag);
    setDetailDate(task.date ?? '');
    setDetailPriority(task.priority ?? '');
    setDetailColor(task.color);
    setEditingDetailTitle(false);
    setEditingDetailDesc(false);
  }

  async function handleSaveDetailField(field: Partial<KanbanTask>) {
    if (!detailModal.task) return;
    await editKanbanTask(detailModal.colId, detailModal.task.id, field);
    setDetailModal(prev => prev.task ? { ...prev, task: { ...prev.task, ...field } } : prev);
  }

  async function handleSaveEdit() {
    if (!editModal.task || !editTitle.trim()) return;
    await editKanbanTask(editModal.colId, editModal.task.id, { title: editTitle.trim(), desc: editDesc.trim() || undefined });
    toast('태스크가 수정되었습니다.', 'success');
    setEditModal({ open: false, colId: '', task: null });
  }

  async function handleDeleteTask(colId: string, taskId: string, title: string) {
    await deleteKanbanTask(colId, taskId);
    toast(`"${title}" 태스크가 삭제되었습니다.`, 'info');
  }

  /** 태스크를 다른 컬럼으로 이동 (서버 move API — ID 유지, 복사 없음) */
  async function handleMoveTask(fromColId: string, toColId: string, task: KanbanTask) {
    if (fromColId === toColId) return;
    await moveKanbanTask(fromColId, toColId, task.id);
  }

  function handleDragStart(colId: string, task: KanbanTask) {
    dragRef.current = { colId, task };
  }

  async function handleDrop(toColId: string) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.colId === toColId) return;
    await handleMoveTask(drag.colId, toColId, drag.task);
  }

  async function handleMarkDone(colId: string, task: KanbanTask) {
    const doneCol = kanban.find((c) => c.title === '완료');
    if (doneCol) {
      await deleteKanbanTask(colId, task.id);
      await addKanbanTask(doneCol.id, { ...task, isCompleted: true });
      toast(`🎉 "${task.title}" 완료!`, 'delight');
    }
  }

  async function handleAddColumn() {
    if (!colName.trim()) return;
    await addKanbanColumn(colName.trim());
    toast(`"${colName.trim()}" 컬럼이 추가되었습니다.`, 'success');
    setColModal(false); setColName('');
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-extrabold font-headline tracking-tight text-on-surface mb-2">개인 업무</h1>
          <p className="text-on-surface-variant max-w-xl">{user?.name ?? ''}의 개인 태스크 보드 — 나만의 업무를 관리하세요.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 bg-surface-container rounded-xl px-4 py-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-surface">
              {(user?.name ?? '?').charAt(0)}
            </div>
            <span className="text-sm font-medium text-on-surface">{user?.name ?? '나'}</span>
          </div>
          <button
            onClick={() => openNewTask(kanban[0]?.id ?? '')}
            className="bg-gradient-to-br from-primary to-secondary text-surface font-bold px-6 py-2.5 rounded-xl hover:opacity-90 transition-all shadow-lg flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            새 태스크
          </button>
        </div>
      </header>

      {/* Kanban board */}
      <div className="flex gap-8 overflow-x-auto pb-8 hide-scrollbar items-start">
        {kanban.map((col) => (
          <KanbanColView
            key={col.id}
            col={col}
            colMenu={colMenu}
            colMenuRef={colMenuRef}
            setColMenu={setColMenu}
            onAddTask={() => openNewTask(col.id)}
            onEditTask={(task) => openEdit(col.id, task)}
            onDeleteTask={(task) => handleDeleteTask(col.id, task.id, task.title)}
            onMarkDone={(task) => handleMarkDone(col.id, task)}
            onViewDetail={(task) => openDetail(col.id, task)}
            onDeleteColumn={() => { deleteKanbanColumn(col.id).then(() => toast(`"${col.title}" 컬럼이 삭제되었습니다.`, 'info')).catch(() => toast('삭제 실패', 'error')); setColMenu(null); }}
            onDragTaskStart={(task) => handleDragStart(col.id, task)}
            onDropTask={() => handleDrop(col.id)}
          />
        ))}

        {/* Add Column */}
        <section className="min-w-[320px] max-w-[320px]">
          <button
            onClick={() => setColModal(true)}
            className="w-full h-full py-20 border-2 border-dashed border-outline-variant/15 rounded-2xl text-on-surface-variant hover:text-primary hover:border-primary/30 transition-all flex flex-col items-center justify-center gap-3"
          >
            <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center">
              <Plus className="w-6 h-6" />
            </div>
            <span className="font-headline font-bold text-sm">새 열 추가</span>
          </button>
        </section>
      </div>

      {/* New Task Modal */}
      <Modal open={newTaskModal.open} onClose={() => setNewTaskModal({ open: false, colId: '' })} title="새 태스크 추가">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">태스크 이름 *</label>
            <input autoFocus value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTask()}
              placeholder="ex) UI 컴포넌트 리팩토링"
              className="w-full bg-surface-container-highest rounded-xl py-3 px-4 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-low transition-all placeholder:text-on-surface-variant/40"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">설명</label>
            <textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} rows={3}
              placeholder="태스크 세부 내용..."
              className="w-full bg-surface-container-highest rounded-xl py-3 px-4 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-low transition-all resize-none placeholder:text-on-surface-variant/40"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">태그</label>
              <select value={taskTag} onChange={(e) => setTaskTag(e.target.value)}
                className="w-full bg-surface-container-highest rounded-xl py-3 px-4 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                {TAG_OPTIONS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">마감일</label>
              <input type="date" value={taskDate} onChange={(e) => setTaskDate(e.target.value)}
                className="w-full bg-surface-container-highest rounded-xl py-3 px-4 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">색상</label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button key={c.value} onClick={() => setTaskColor(c.value)}
                  className={cn('flex-1 py-2 rounded-lg text-xs font-bold transition-all',
                    taskColor === c.value
                      ? { primary: 'bg-primary/20 text-primary ring-1 ring-primary/40', secondary: 'bg-secondary/20 text-secondary ring-1 ring-secondary/40', tertiary: 'bg-tertiary/20 text-tertiary ring-1 ring-tertiary/40' }[c.value]
                      : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-bright'
                  )}>{c.label}</button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setNewTaskModal({ open: false, colId: '' })} className="px-5 py-2.5 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-white/5 transition-all">취소</button>
            <button onClick={handleCreateTask} disabled={!taskTitle.trim()}
              className="px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-primary to-secondary text-surface shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              추가하기
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Task Modal */}
      <Modal open={editModal.open} onClose={() => setEditModal({ open: false, colId: '', task: null })} title="태스크 편집">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">태스크 이름</label>
            <input autoFocus value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
              className="w-full bg-surface-container-highest rounded-xl py-3 px-4 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-low transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">설명</label>
            <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3}
              className="w-full bg-surface-container-highest rounded-xl py-3 px-4 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-low transition-all resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setEditModal({ open: false, colId: '', task: null })} className="px-5 py-2.5 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-white/5 transition-all">취소</button>
            <button onClick={handleSaveEdit} disabled={!editTitle.trim()}
              className="px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-primary to-secondary text-surface shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-40">
              저장
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Column Modal */}
      <Modal open={colModal} onClose={() => setColModal(false)} title="새 컬럼 추가" size="sm">
        <div className="space-y-4">
          <input autoFocus value={colName} onChange={(e) => setColName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
            placeholder="ex) Review"
            className="w-full bg-surface-container-highest rounded-xl py-3 px-4 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-low transition-all placeholder:text-on-surface-variant/40"
          />
          <div className="flex justify-end gap-3">
            <button onClick={() => setColModal(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-white/5 transition-all">취소</button>
            <button onClick={handleAddColumn} disabled={!colName.trim()}
              className="px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-primary to-secondary text-surface shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-40">
              추가
            </button>
          </div>
        </div>
      </Modal>

      {/* Task Detail Modal */}
      {detailModal.open && detailModal.task && (() => {
        const task = detailModal.task!;
        const isDone = detailModal.colId === 'done';
        const colorMap: Record<ColorType, { tag: string; bar: string; text: string; glow: string }> = {
          primary:   { tag: 'border-primary bg-primary/10 text-primary',     bar: 'from-primary to-primary-dim',     text: 'text-primary',   glow: 'shadow-primary/30' },
          secondary: { tag: 'border-secondary bg-secondary/10 text-secondary', bar: 'from-secondary to-secondary-dim', text: 'text-secondary', glow: 'shadow-secondary/30' },
          tertiary:  { tag: 'border-tertiary bg-tertiary/10 text-tertiary',   bar: 'from-tertiary to-tertiary-dim',   text: 'text-tertiary',  glow: 'shadow-tertiary/30' },
        };
        const c = colorMap[detailColor];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetailModal({ open: false, colId: '', task: null })} />
            <div className="relative w-full max-w-lg glass-panel rounded-2xl shadow-[0_40px_80px_rgba(0,0,0,0.5)] overflow-hidden">

              {/* Color accent top bar */}
              <div className={cn('h-1 w-full bg-gradient-to-r', c.bar)} />

              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div className="flex flex-wrap gap-2 flex-1">
                    {/* Tag */}
                    <select
                      value={detailTag}
                      onChange={(e) => { setDetailTag(e.target.value); handleSaveDetailField({ tag: e.target.value }); }}
                      className={cn('text-[0.65rem] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border cursor-pointer bg-transparent focus:outline-none', c.tag)}
                    >
                      {TAG_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {/* Priority */}
                    <select
                      value={detailPriority}
                      onChange={(e) => { setDetailPriority(e.target.value); handleSaveDetailField({ priority: e.target.value || undefined }); }}
                      className="text-[0.65rem] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-on-surface-variant focus:outline-none cursor-pointer"
                    >
                      <option value="">우선순위 없음</option>
                      <option value="낮음">낮음</option>
                      <option value="보통">보통</option>
                      <option value="높음">높음</option>
                    </select>
                    {task.isCompleted && (
                      <span className="text-[0.65rem] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-tertiary/10 text-tertiary">완료</span>
                    )}
                  </div>
                  <button
                    onClick={() => setDetailModal({ open: false, colId: '', task: null })}
                    className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Title */}
                {editingDetailTitle ? (
                  <input
                    autoFocus
                    value={detailTitle}
                    onChange={(e) => setDetailTitle(e.target.value)}
                    onBlur={() => { if (detailTitle.trim()) { handleSaveDetailField({ title: detailTitle.trim() }); } setEditingDetailTitle(false); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { if (detailTitle.trim()) handleSaveDetailField({ title: detailTitle.trim() }); setEditingDetailTitle(false); } if (e.key === 'Escape') { setDetailTitle(task.title); setEditingDetailTitle(false); } }}
                    className="w-full bg-white/5 rounded-xl px-3 py-2 font-headline font-bold text-xl border border-primary/30 focus:outline-none mb-4"
                  />
                ) : (
                  <h3
                    onClick={() => setEditingDetailTitle(true)}
                    className={cn('font-headline font-bold text-xl mb-4 cursor-text hover:text-primary transition-colors leading-snug', task.isCompleted && 'line-through text-on-surface-variant')}
                  >
                    {detailTitle || task.title}
                  </h3>
                )}

                {/* Description */}
                {editingDetailDesc ? (
                  <textarea
                    autoFocus
                    value={detailDesc}
                    onChange={(e) => setDetailDesc(e.target.value)}
                    onBlur={() => { handleSaveDetailField({ desc: detailDesc.trim() || undefined }); setEditingDetailDesc(false); }}
                    onKeyDown={(e) => { if (e.key === 'Escape') setEditingDetailDesc(false); }}
                    rows={3}
                    className="w-full bg-white/5 rounded-xl px-3 py-2 text-sm border border-primary/30 focus:outline-none resize-none mb-4 placeholder:text-on-surface-variant/40"
                    placeholder="태스크 설명을 입력하세요..."
                  />
                ) : (
                  <p
                    onClick={() => setEditingDetailDesc(true)}
                    className="text-sm text-on-surface-variant mb-5 cursor-text hover:text-on-surface transition-colors min-h-[2rem] leading-relaxed"
                  >
                    {detailDesc || <span className="italic opacity-40">설명을 추가하려면 클릭하세요...</span>}
                  </p>
                )}

                {/* Meta row */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {/* Date */}
                  <div className="flex items-center gap-2 bg-white/[0.03] rounded-xl px-3 py-2.5">
                    <Calendar className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
                    <input
                      type="date"
                      value={detailDate}
                      onChange={(e) => { setDetailDate(e.target.value); handleSaveDetailField({ date: e.target.value || undefined }); }}
                      className="bg-transparent text-xs text-on-surface-variant focus:outline-none w-full cursor-pointer"
                    />
                  </div>
                  {/* Color */}
                  <div className="flex items-center gap-2 bg-white/[0.03] rounded-xl px-3 py-2.5">
                    <Tag className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
                    <div className="flex gap-1.5">
                      {(['primary', 'secondary', 'tertiary'] as ColorType[]).map(col => (
                        <button
                          key={col}
                          onClick={() => { setDetailColor(col); handleSaveDetailField({ color: col }); }}
                          className={cn(
                            'w-4 h-4 rounded-full transition-all',
                            { primary: 'bg-primary', secondary: 'bg-secondary', tertiary: 'bg-tertiary' }[col],
                            detailColor === col ? 'ring-2 ring-white/60 scale-110' : 'opacity-50 hover:opacity-80'
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Status (column) change */}
                <div className="flex items-center gap-2 bg-white/[0.03] rounded-xl px-3 py-2.5 mb-5">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
                  <span className="text-xs text-on-surface-variant shrink-0">상태</span>
                  <div className="flex gap-1.5 flex-wrap ml-1">
                    {kanban.map((col) => (
                      <button
                        key={col.id}
                        onClick={() => {
                          if (col.id === detailModal.colId) return;
                          handleMoveTask(detailModal.colId, col.id, task);
                          setDetailModal((prev) => ({ ...prev, colId: col.id }));
                        }}
                        className={cn(
                          'text-[0.65rem] font-bold px-2 py-0.5 rounded-full transition-all',
                          col.id === detailModal.colId
                            ? 'bg-primary/20 text-primary ring-1 ring-primary/40'
                            : 'bg-white/5 text-on-surface-variant hover:bg-white/10'
                        )}
                      >
                        {col.title}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Assignees */}
                <AssigneePicker
                  assignees={detailModal.task?.assignees ?? []}
                  allMembers={allMembers}
                  onToggle={(name) => {
                    const current = detailModal.task?.assignees ?? [];
                    const next = current.includes(name)
                      ? current.filter(n => n !== name)
                      : [...current, name];
                    handleSaveDetailField({ assignees: next });
                  }}
                />

                {/* Progress bar (if exists) */}
                {task.progress !== undefined && (
                  <div className="mb-5">
                    <div className="flex justify-between text-[11px] text-on-surface-variant mb-2">
                      <span className="flex items-center gap-1"><BarChart2 className="w-3 h-3" /> 진행률</span>
                      <span className={cn('font-bold', c.text)}>{task.progress}%</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full bg-gradient-to-r', c.bar)} style={{ width: `${task.progress}%` }} />
                    </div>
                  </div>
                )}

                {/* Attachments / Comments info */}
                {(task.attachments || task.comments) && (
                  <div className="flex gap-4 mb-5">
                    {task.attachments && <div className="flex items-center gap-1.5 text-xs text-on-surface-variant"><Paperclip className="w-3.5 h-3.5" />{task.attachments}개 첨부파일</div>}
                    {task.comments && <div className="flex items-center gap-1.5 text-xs text-on-surface-variant"><MessageCircle className="w-3.5 h-3.5" />{task.comments}개 댓글</div>}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-white/5">
                  {!isDone && !task.isCompleted && (
                    <button
                      onClick={() => { handleMarkDone(detailModal.colId, task); setDetailModal({ open: false, colId: '', task: null }); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-tertiary/10 text-tertiary text-sm font-bold hover:bg-tertiary/20 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" /> 완료 처리
                    </button>
                  )}
                  <button
                    onClick={() => { setDetailModal({ open: false, colId: '', task: null }); openEdit(detailModal.colId, task); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-on-surface-variant text-sm font-bold hover:bg-white/10 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" /> 편집
                  </button>
                  <button
                    onClick={() => { handleDeleteTask(detailModal.colId, task.id, task.title); setDetailModal({ open: false, colId: '', task: null }); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-error/10 text-error text-sm font-bold hover:bg-error/20 transition-colors ml-auto"
                  >
                    <Trash2 className="w-4 h-4" /> 삭제
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── AssigneePicker ───────────────────────────────────────────────────────────

function AssigneePicker({ assignees, allMembers, onToggle }: {
  assignees: string[];
  allMembers: { name: string; initial: string; color: string }[];
  onToggle: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1">
          <Users className="w-3 h-3" /> 담당자
        </span>
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-secondary transition-colors"
          >
            <UserPlus className="w-3 h-3" /> 추가
          </button>
          {open && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-surface-container-highest/95 backdrop-blur-xl rounded-xl border border-white/5 shadow-[0_8px_24px_rgba(0,0,0,0.5)] overflow-hidden z-50">
              {allMembers.map((m) => {
                const isAssigned = assignees.includes(m.name);
                return (
                  <button
                    key={m.name}
                    onClick={() => onToggle(m.name)}
                    className={cn(
                      'w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors',
                      isAssigned ? 'bg-primary/10' : 'hover:bg-white/5'
                    )}
                  >
                    <div className={cn('w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center text-[10px] font-bold text-surface shrink-0', m.color)}>
                      {m.initial}
                    </div>
                    <span className={cn('flex-1 text-left', isAssigned ? 'text-primary font-semibold' : 'text-on-surface-variant')}>
                      {m.name}
                    </span>
                    {isAssigned && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {assignees.length === 0 ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-xs text-on-surface-variant hover:text-primary transition-colors"
        >
          <div className="w-7 h-7 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center">
            <Plus className="w-3 h-3" />
          </div>
          담당자를 지정하세요
        </button>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          {assignees.map((name) => {
            const m = allMembers.find(x => x.name === name) ?? { initial: name.charAt(0), color: 'from-primary to-secondary', name };
            return (
              <button
                key={name}
                onClick={() => onToggle(name)}
                title={`${name} 제거`}
                className="group flex items-center gap-1.5 bg-white/5 hover:bg-error/10 rounded-full pl-0.5 pr-2.5 py-0.5 transition-all"
              >
                <div className={cn('w-6 h-6 rounded-full bg-gradient-to-br flex items-center justify-center text-[9px] font-bold text-surface', m.color)}>
                  {m.initial}
                </div>
                <span className="text-xs text-on-surface-variant group-hover:text-error transition-colors">{name}</span>
              </button>
            );
          })}
          <button
            onClick={() => setOpen(true)}
            className="w-7 h-7 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── KanbanColView ────────────────────────────────────────────────────────────

function KanbanColView({ col, colMenu, colMenuRef, setColMenu, onAddTask, onEditTask, onDeleteTask, onMarkDone, onViewDetail, onDeleteColumn, onDragTaskStart, onDropTask }: {
  col: KanbanColumn;
  colMenu: string | null;
  colMenuRef: React.RefObject<HTMLDivElement>;
  setColMenu: (id: string | null) => void;
  key?: React.Key;
  onAddTask: () => void;
  onEditTask: (task: KanbanTask) => void;
  onDeleteTask: (task: KanbanTask) => void;
  onMarkDone: (task: KanbanTask) => void;
  onViewDetail: (task: KanbanTask) => void;
  onDeleteColumn: () => void;
  onDragTaskStart: (task: KanbanTask) => void;
  onDropTask: () => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  const colorDot: Record<string, string> = {
    primary:   'bg-primary shadow-[0_0_10px_rgba(151,169,255,0.6)]',
    secondary: 'bg-secondary shadow-[0_0_10px_rgba(172,138,255,0.6)]',
    tertiary:  'bg-tertiary shadow-[0_0_10px_rgba(255,163,233,0.6)]',
  };
  const isDone = col.id === 'done';

  return (
    <section
      className={cn('min-w-[320px] max-w-[320px] flex flex-col gap-4 transition-all', isDone && 'opacity-70', isDragOver && 'ring-2 ring-primary/40 rounded-2xl')}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false); }}
      onDrop={(e) => { e.preventDefault(); setIsDragOver(false); onDropTask(); }}
    >
      <div className="flex items-center justify-between px-2 mb-2">
        <div className="flex items-center gap-3">
          <div className={cn('w-2 h-2 rounded-full', colorDot[col.color] ?? colorDot.primary)} />
          <h3 className="font-headline font-bold text-on-surface">{col.title}</h3>
          <span className="text-xs bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full">{col.tasks.length}</span>
        </div>
        <div className="relative" ref={colMenu === col.id ? colMenuRef : undefined}>
          <button onClick={() => setColMenu(colMenu === col.id ? null : col.id)}
            className="text-on-surface-variant hover:text-on-surface transition-colors">
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {colMenu === col.id && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-surface-container-highest/90 backdrop-blur-xl rounded-xl border border-white/5 shadow-[0_8px_24px_rgba(0,0,0,0.4)] overflow-hidden z-50">
              <button onClick={onAddTask} className="w-full px-4 py-2.5 text-left text-sm text-on-surface-variant hover:bg-white/5 hover:text-on-surface transition-colors flex items-center gap-2">
                <Plus className="w-3.5 h-3.5" /> 태스크 추가
              </button>
              <button onClick={onDeleteColumn} className="w-full px-4 py-2.5 text-left text-sm text-error hover:bg-error/10 transition-colors flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5" /> 컬럼 삭제
              </button>
            </div>
          )}
        </div>
      </div>

      {col.tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onEdit={() => onEditTask(task)}
          onDelete={() => onDeleteTask(task)}
          onMarkDone={() => onMarkDone(task)}
          onViewDetail={() => onViewDetail(task)}
          isDoneCol={isDone}
          onDragStart={() => onDragTaskStart(task)}
        />
      ))}

      <button
        onClick={onAddTask}
        className="w-full py-4 border-2 border-dashed border-outline-variant/20 rounded-xl text-on-surface-variant hover:text-on-surface hover:border-primary/50 transition-all flex items-center justify-center gap-2 font-bold text-sm"
      >
        <Plus className="w-4 h-4" /> 태스크 추가
      </button>
    </section>
  );
}

// ─── TaskCard ─────────────────────────────────────────────────────────────────

function TaskCard({ task, onEdit, onDelete, onMarkDone, onViewDetail, isDoneCol, onDragStart }: {
  task: KanbanTask;
  onEdit: () => void;
  onDelete: () => void;
  onMarkDone: () => void;
  onViewDetail: () => void;
  isDoneCol: boolean;
  onDragStart: () => void;
  key?: React.Key;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  const colorClasses: Record<string, string> = {
    primary:   'border-primary bg-primary/10 text-primary',
    secondary: 'border-secondary bg-secondary/10 text-secondary',
    tertiary:  'border-tertiary bg-tertiary/10 text-tertiary',
  };

  return (
    <article
      draggable
      onDragStart={(e) => { e.stopPropagation(); onDragStart(); }}
      onClick={onViewDetail}
      className={cn(
        'bg-surface-container rounded-xl p-5 shadow-lg group hover:bg-surface-bright transition-all cursor-grab active:cursor-grabbing',
        task.isUrgent ? 'border-l-2 border-error' : !task.isCompleted ? `border-l-2 border-${task.color}` : ''
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-wrap gap-2">
          <span className={cn('text-[0.65rem] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full', colorClasses[task.color])}>
            {task.tag}
          </span>
          {task.priority && (
            <span className="text-[0.65rem] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-on-surface-variant/10 text-on-surface-variant">
              우선순위: {task.priority}
            </span>
          )}
        </div>
        <div className="relative" ref={menuRef} onClick={(e) => e.stopPropagation()}>
          {task.isCompleted ? (
            <CheckCircle2 className="w-4 h-4 text-tertiary fill-tertiary/20" />
          ) : (
            <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} className="opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="w-4 h-4 text-on-surface-variant hover:text-on-surface" />
            </button>
          )}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-surface-container-highest/90 backdrop-blur-xl rounded-xl border border-white/5 shadow-[0_8px_24px_rgba(0,0,0,0.4)] overflow-hidden z-50">
              {!isDoneCol && (
                <button onClick={() => { setMenuOpen(false); onMarkDone(); }}
                  className="w-full px-3 py-2.5 text-left text-sm text-tertiary hover:bg-tertiary/10 transition-colors flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 완료 처리
                </button>
              )}
              <button onClick={() => { setMenuOpen(false); onEdit(); }}
                className="w-full px-3 py-2.5 text-left text-sm text-on-surface-variant hover:bg-white/5 hover:text-on-surface transition-colors flex items-center gap-2">
                <Edit2 className="w-3.5 h-3.5" /> 편집
              </button>
              <button onClick={() => { setMenuOpen(false); onDelete(); }}
                className="w-full px-3 py-2.5 text-left text-sm text-error hover:bg-error/10 transition-colors flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5" /> 삭제
              </button>
            </div>
          )}
        </div>
      </div>

      <h4 className={cn('font-headline font-bold text-on-surface mb-2 leading-snug', task.isCompleted && 'line-through text-on-surface-variant')}>
        {task.title}
      </h4>
      {task.desc && <p className="text-on-surface-variant text-xs mb-6 line-clamp-2">{task.desc}</p>}

      <div className="flex items-center justify-between mt-4">
        {/* Assignee avatars */}
        <div className="flex -space-x-2">
          {(task.assignees ?? []).slice(0, 3).map((name) => {
            const m = [...TEAM_MEMBERS, { name: '나', initial: '나', color: 'from-primary to-secondary' }].find(x => x.name === name);
            return (
              <div key={name} title={name} className={cn('w-7 h-7 rounded-full bg-gradient-to-br border-2 border-surface flex items-center justify-center text-[9px] font-bold text-surface', m?.color ?? 'from-primary to-secondary')}>
                {(m?.initial ?? name.charAt(0))}
              </div>
            );
          })}
          {(task.assignees?.length ?? 0) === 0 && (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/40 to-secondary/40 flex items-center justify-center text-[10px] font-bold">U</div>
          )}
          {(task.assignees?.length ?? 0) > 3 && (
            <div className="w-7 h-7 rounded-full bg-surface-container-highest border-2 border-surface flex items-center justify-center text-[9px] font-bold text-primary">
              +{(task.assignees?.length ?? 0) - 3}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {task.attachments && <div className="flex items-center gap-1 text-on-surface-variant text-[0.7rem]"><Paperclip className="w-3 h-3" />{task.attachments}</div>}
          {task.comments && <div className="flex items-center gap-1 text-on-surface-variant text-[0.7rem]"><MessageCircle className="w-3 h-3" />{task.comments}</div>}
          {task.date && <div className={cn('flex items-center gap-1.5 text-[0.7rem] font-medium', task.isUrgent ? 'text-error font-bold' : 'text-on-surface-variant')}><Calendar className="w-3 h-3" />{task.date}</div>}
          {task.isCompleted && <div className="text-[0.7rem] text-tertiary font-bold uppercase">완료</div>}
        </div>
      </div>
      {task.progress && (
        <div className="mt-4 w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${task.progress}%` }} />
        </div>
      )}
    </article>
  );
}
