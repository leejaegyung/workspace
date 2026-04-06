import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../lib/apiFetch';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProjectMember {
  id: string;
  name: string;
  initial: string;
  role: string;
  color: 'primary' | 'secondary' | 'tertiary';
}

export interface Project {
  id: string;
  initial: string;
  name: string;
  phase: string;
  progress: number;
  color: string;
  members: ProjectMember[];
  description?: string;
}

export interface SprintTask {
  id: string;
  label: string;
  checked: boolean;
}

export interface ActivityItem {
  id: string;
  user: string;
  action: string;
  target: string;
  time: string;
  color: 'primary' | 'secondary' | 'tertiary';
  read: boolean;
}

export interface KanbanTask {
  id: string;
  tag: string;
  title: string;
  desc?: string;
  date?: string;
  color: 'primary' | 'secondary' | 'tertiary';
  priority?: string;
  attachments?: number;
  comments?: number;
  progress?: number;
  isUrgent?: boolean;
  isCompleted?: boolean;
  assignees?: string[];
}

export interface KanbanColumn {
  id: string;
  title: string;
  color: 'primary' | 'secondary' | 'tertiary';
  tasks: KanbanTask[];
}

export interface ChatMessage {
  id: string;
  user: string;
  time: string;
  content?: string;
  isMe?: boolean;
  reactions?: { emoji: string; count: number; active: boolean }[];
  attachment?: { name: string; size: string; image: string };
  serverTime?: string;
}

export interface Channel {
  id: string;
  name: string;
  type: 'channel' | 'dm';
  status?: 'online' | 'offline';
  unread: number;
  messages: ChatMessage[];
}

export interface FileItem {
  id: string;
  name: string;
  type: string;
  size: string;
  date: string;
  color?: 'primary' | 'secondary' | 'tertiary' | 'error';
  iconType: 'folder' | 'file' | 'archive' | 'film' | 'image';
  image?: string;
  subtitle?: string;
  storageId?: string;
}

export interface Notification {
  id: string;
  text: string;
  time: string;
  read: boolean;
  color: 'primary' | 'secondary' | 'tertiary';
}

// ─── Context Interface ────────────────────────────────────────────────────────

interface AppContextType {
  // Projects
  projects: Project[];
  projectsLoading: boolean;
  addProject: (p: Omit<Project, 'id'>) => Promise<string>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  addProjectMember: (projectId: string, member: Omit<ProjectMember, 'id'>) => Promise<void>;
  removeProjectMember: (projectId: string, memberId: string) => Promise<void>;
  // Sprint (로컬 — 대시보드 전용)
  sprintTasks: SprintTask[];
  toggleSprintTask: (id: string) => void;
  addSprintTask: (label: string) => void;
  deleteSprintTask: (id: string) => void;
  // Activity (로컬)
  activities: ActivityItem[];
  addActivity: (a: Omit<ActivityItem, 'id'>) => void;
  markAllRead: () => void;
  // Personal Kanban (개인 업무 보드)
  kanban: KanbanColumn[];
  kanbanLoading: boolean;
  addKanbanTask: (colId: string, task: Omit<KanbanTask, 'id'>) => Promise<void>;
  editKanbanTask: (colId: string, taskId: string, updates: Partial<KanbanTask>) => Promise<void>;
  deleteKanbanTask: (colId: string, taskId: string) => Promise<void>;
  addKanbanColumn: (title: string) => Promise<void>;
  deleteKanbanColumn: (colId: string) => Promise<void>;
  // Project Kanban
  projectKanban: Record<string, KanbanColumn[]>;
  addProjectKanbanTask: (projectId: string, colId: string, task: Omit<KanbanTask, 'id'>) => Promise<void>;
  editProjectKanbanTask: (projectId: string, colId: string, taskId: string, updates: Partial<KanbanTask>) => Promise<void>;
  deleteProjectKanbanTask: (projectId: string, colId: string, taskId: string) => Promise<void>;
  addProjectKanbanColumn: (projectId: string, title: string) => Promise<void>;
  deleteProjectKanbanColumn: (projectId: string, colId: string) => Promise<void>;
  initProjectKanban: (projectId: string) => Promise<void>;
  // Chat
  channels: Channel[];
  registeredUsers: { id: string; name: string; email: string }[];
  sendMessage: (channelId: string, content: string, senderName?: string) => void;
  receiveMessages: (channelId: string, newMsgs: ChatMessage[], isActive: boolean) => void;
  toggleReaction: (channelId: string, msgId: string, emoji: string) => void;
  markChannelRead: (channelId: string) => void;
  addChannel: (name: string) => void;
  openDM: (userId: string, userName: string) => Promise<string>;
  leaveChannel: (channelId: string) => void;
  loadChannels: () => void;
  pollChannels: () => void;
  setActiveChannelId: (id: string) => void;
  // Files
  files: FileItem[];
  filesLoading: boolean;
  addFolder: (name: string, storageId?: string) => Promise<void>;
  addFile: (file: Omit<FileItem, 'id'>) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  renameFile: (id: string, name: string) => Promise<void>;
  // Notifications (로컬)
  notifications: Notification[];
  addNotification: (n: Omit<Notification, 'id'>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
}

const AppContext = createContext<AppContextType | null>(null);


// ─── API 헬퍼 ────────────────────────────────────────────────────────────────
async function api(method: string, path: string, body?: object) {
  const res = await apiFetch(`/api/data${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: React.ReactNode }) {
  // ── Projects ──────────────────────────────────────────────────────────────
  const [projects, setProjects]         = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    try {
      const { projects: data } = await api('GET', '/projects');
      setProjects(data ?? []);
    } catch {}
    setProjectsLoading(false);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const addProject = async (p: Omit<Project, 'id'>): Promise<string> => {
    const { project } = await api('POST', '/projects', p);
    setProjects((prev) => [...prev, { ...project, members: [] }]);
    // 기본 칸반 로드
    const { kanban: cols } = await api('GET', `/kanban/${project.id}`);
    setProjectKanban((prev) => ({ ...prev, [project.id]: cols ?? [] }));
    return project.id;
  };

  const updateProject = async (id: string, updates: Partial<Project>) => {
    await api('PATCH', `/projects/${id}`, updates);
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, ...updates } : p));
  };

  const deleteProject = async (id: string) => {
    await api('DELETE', `/projects/${id}`);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setProjectKanban((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };

  const addProjectMember = async (projectId: string, member: Omit<ProjectMember, 'id'> & { userId?: string }) => {
    const { id } = await api('POST', `/projects/${projectId}/members`, member);
    const { userId, ...memberData } = member as any;
    setProjects((prev) => prev.map((p) =>
      p.id === projectId ? { ...p, members: [...p.members, { ...memberData, id }] } : p
    ));
  };

  const removeProjectMember = async (projectId: string, memberId: string) => {
    await api('DELETE', `/projects/${projectId}/members/${memberId}`);
    setProjects((prev) => prev.map((p) =>
      p.id === projectId ? { ...p, members: p.members.filter((m) => m.id !== memberId) } : p
    ));
  };

  // ── Sprint (서버 DB — 유저별) ──────────────────────────────────────────────
  const [sprintTasks, setSprintTasks] = useState<SprintTask[]>([]);

  useEffect(() => {
    api('GET', '/sprint-tasks')
      .then(({ tasks }) => setSprintTasks(tasks ?? []))
      .catch(() => {});
  }, []);

  const toggleSprintTask = (id: string) => {
    const task = sprintTasks.find((t) => t.id === id);
    if (!task) return;
    const checked = !task.checked;
    setSprintTasks((prev) => prev.map((t) => t.id === id ? { ...t, checked } : t));
    api('PATCH', `/sprint-tasks/${id}`, { checked }).catch(() => {});
  };

  const addSprintTask = (label: string) => {
    const tempId = crypto.randomUUID();
    setSprintTasks((prev) => [...prev, { id: tempId, label, checked: false }]);
    api('POST', '/sprint-tasks', { label })
      .then(({ id: serverId }) => {
        setSprintTasks((prev) => prev.map((t) => t.id === tempId ? { ...t, id: serverId } : t));
      })
      .catch(() => setSprintTasks((prev) => prev.filter((t) => t.id !== tempId)));
  };

  const deleteSprintTask = (id: string) => {
    setSprintTasks((prev) => prev.filter((t) => t.id !== id));
    api('DELETE', `/sprint-tasks/${id}`).catch(() => {});
  };

  // ── Activity (로컬) ───────────────────────────────────────────────────────
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const addActivity = (a: Omit<ActivityItem, 'id'>) =>
    setActivities((prev) => [{ ...a, id: crypto.randomUUID() }, ...prev]);
  const markAllRead = () =>
    setActivities((prev) => prev.map((a) => ({ ...a, read: true })));

  // ── Personal Kanban ───────────────────────────────────────────────────────
  const [kanban, setKanban]           = useState<KanbanColumn[]>([]);
  const [kanbanLoading, setKanbanLoading] = useState(true);

  useEffect(() => {
    api('GET', '/kanban/personal')
      .then(({ kanban: data }) => setKanban(data ?? []))
      .catch(() => {})
      .finally(() => setKanbanLoading(false));
  }, []);

  const addKanbanTask = async (colId: string, task: Omit<KanbanTask, 'id'>) => {
    const { id } = await api('POST', `/kanban/personal/columns/${colId}/tasks`, task);
    setKanban((prev) => prev.map((col) =>
      col.id === colId ? { ...col, tasks: [...col.tasks, { ...task, id }] } : col
    ));
  };

  const editKanbanTask = async (colId: string, taskId: string, updates: Partial<KanbanTask>) => {
    await api('PATCH', `/kanban/personal/tasks/${taskId}`, updates);
    setKanban((prev) => prev.map((col) =>
      col.id === colId ? { ...col, tasks: col.tasks.map((t) => t.id === taskId ? { ...t, ...updates } : t) } : col
    ));
  };

  const deleteKanbanTask = async (colId: string, taskId: string) => {
    await api('DELETE', `/kanban/personal/tasks/${taskId}`);
    setKanban((prev) => prev.map((col) =>
      col.id === colId ? { ...col, tasks: col.tasks.filter((t) => t.id !== taskId) } : col
    ));
  };

  const addKanbanColumn = async (title: string) => {
    const { id } = await api('POST', '/kanban/personal/columns', { title });
    setKanban((prev) => [...prev, { id, title, color: 'primary', tasks: [] }]);
  };

  const deleteKanbanColumn = async (colId: string) => {
    await api('DELETE', `/kanban/personal/columns/${colId}`);
    setKanban((prev) => prev.filter((c) => c.id !== colId));
  };

  // ── Project Kanban ────────────────────────────────────────────────────────
  const [projectKanban, setProjectKanban] = useState<Record<string, KanbanColumn[]>>({});

  const initProjectKanban = async (projectId: string) => {
    if (projectKanban[projectId]) return;
    try {
      const { kanban: data } = await api('GET', `/kanban/${projectId}`);
      setProjectKanban((prev) => ({ ...prev, [projectId]: data ?? [] }));
    } catch {}
  };

  const addProjectKanbanTask = async (projectId: string, colId: string, task: Omit<KanbanTask, 'id'>) => {
    const { id } = await api('POST', `/kanban/${projectId}/columns/${colId}/tasks`, task);
    setProjectKanban((prev) => ({
      ...prev,
      [projectId]: (prev[projectId] ?? []).map((col) =>
        col.id === colId ? { ...col, tasks: [...col.tasks, { ...task, id }] } : col
      ),
    }));
  };

  const editProjectKanbanTask = async (projectId: string, colId: string, taskId: string, updates: Partial<KanbanTask>) => {
    await api('PATCH', `/kanban/${projectId}/tasks/${taskId}`, updates);
    setProjectKanban((prev) => ({
      ...prev,
      [projectId]: (prev[projectId] ?? []).map((col) =>
        col.id === colId ? { ...col, tasks: col.tasks.map((t) => t.id === taskId ? { ...t, ...updates } : t) } : col
      ),
    }));
  };

  const deleteProjectKanbanTask = async (projectId: string, colId: string, taskId: string) => {
    await api('DELETE', `/kanban/${projectId}/tasks/${taskId}`);
    setProjectKanban((prev) => ({
      ...prev,
      [projectId]: (prev[projectId] ?? []).map((col) =>
        col.id === colId ? { ...col, tasks: col.tasks.filter((t) => t.id !== taskId) } : col
      ),
    }));
  };

  const addProjectKanbanColumn = async (projectId: string, title: string) => {
    const { id } = await api('POST', `/kanban/${projectId}/columns`, { title });
    setProjectKanban((prev) => ({
      ...prev,
      [projectId]: [...(prev[projectId] ?? []), { id, title, color: 'primary', tasks: [] }],
    }));
  };

  const deleteProjectKanbanColumn = async (projectId: string, colId: string) => {
    await api('DELETE', `/kanban/${projectId}/columns/${colId}`);
    setProjectKanban((prev) => ({
      ...prev,
      [projectId]: (prev[projectId] ?? []).filter((c) => c.id !== colId),
    }));
  };

  // ── Chat ──────────────────────────────────────────────────────────────────
  const [channels, setChannels]               = useState<Channel[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const activeChannelIdRef                    = useRef<string>('');

  // 최초 로드: 전체 교체 (앱 시작 시 1회)
  function loadChannels() {
    apiFetch('/api/chat/channels')
      .then((r) => r.ok ? r.json() : { channels: [] })
      .then(({ channels: apiChannels = [] }) => {
        setChannels(apiChannels.map((ch: any) => ({
          id: ch.id, name: ch.name, type: ch.type as 'channel' | 'dm',
          status: 'online' as const, unread: 0, messages: [],
        })));
      })
      .catch(() => {});
  }

  // 폴링용: 새 채널만 추가, 기존 채널(messages·unread) 절대 건드리지 않음
  function pollChannels() {
    apiFetch('/api/chat/channels')
      .then((r) => r.ok ? r.json() : { channels: [] })
      .then(({ channels: apiChannels = [] }) => {
        setChannels((prev) => {
          const existingIds = new Set(prev.map((ch) => ch.id));
          const added = (apiChannels as any[]).filter((ch) => !existingIds.has(ch.id));
          if (added.length === 0) return prev;
          return [
            ...prev,
            ...added.map((ch: any) => ({
              id: ch.id, name: ch.name, type: ch.type as 'channel' | 'dm',
              status: 'online' as const, unread: 0, messages: [],
            })),
          ];
        });
      })
      .catch(() => {});
  }

  // ── WebSocket 실시간 메시지 수신 ──────────────────────────────────────────
  const receiveMessagesRef = useRef<typeof receiveMessages | null>(null);
  const setChannelsRef     = useRef<typeof setChannels | null>(null);

  useEffect(() => {
    apiFetch('/api/auth/users')
      .then((r) => r.ok ? r.json() : { users: [] })
      .then(({ users = [] }) => { if (users.length) setRegisteredUsers(users); })
      .catch(() => {});
    loadChannels();
  }, []);

  // WebSocket 연결 (앱 마운트 시 1회, 재연결 포함)
  useEffect(() => {
    receiveMessagesRef.current = receiveMessages;
    setChannelsRef.current = setChannels;
  });

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let ws: WebSocket | null = null;
    let reconnectTimer = 0;
    let destroyed = false;

    function connect() {
      if (destroyed) return;
      ws = new WebSocket(wsUrl);

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);

          if (data.type === 'message') {
            const m = data.message;
            const mapped = {
              id: m.id,
              user: m.user_name,
              time: new Date(m.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
              content: m.content,
              isMe: false, // 발신자는 WS 브로드캐스트에서 제외되므로 항상 false
              serverTime: m.created_at,
            };
            const isActive = data.channelId === activeChannelIdRef.current;
            receiveMessagesRef.current?.(data.channelId, [mapped], isActive);
          }

          if (data.type === 'channel_created') {
            setChannelsRef.current?.((prev) => {
              if (prev.find((c) => c.id === data.channel.id)) return prev;
              return [...prev, { id: data.channel.id, name: data.channel.name, type: data.channel.type as 'channel' | 'dm', status: 'online' as const, unread: 0, messages: [] }];
            });
          }
        } catch {}
      };

      ws.onclose = () => {
        if (destroyed) return;
        reconnectTimer = window.setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    }

    connect();

    return () => {
      destroyed = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []); // eslint-disable-line

  const sendMessage = (channelId: string, content: string, senderName?: string) => {
    const tempId = `temp-${crypto.randomUUID()}`;
    const msg: ChatMessage = {
      id: tempId, user: senderName ?? 'Me',
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      content, isMe: true,
    };
    setChannels((prev) => prev.map((ch) =>
      ch.id === channelId ? { ...ch, messages: [...ch.messages, msg] } : ch
    ));
    apiFetch(`/api/chat/channels/${channelId}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.message) {
          setChannels((prev) => prev.map((ch) => {
            if (ch.id !== channelId) return ch;
            return {
              ...ch,
              messages: ch.messages.map((m) =>
                m.id === tempId ? { ...m, id: data.message.id, serverTime: data.message.created_at } : m
              ),
            };
          }));
        }
      })
      .catch(() => {});
  };

  const receiveMessages = (channelId: string, newMsgs: ChatMessage[], isActive: boolean) => {
    setChannels((prev) => prev.map((ch) => {
      if (ch.id !== channelId) return ch;
      const existingIds = new Set(ch.messages.map((m) => m.id));
      const toAdd = newMsgs.filter((m) => !existingIds.has(m.id));
      if (!toAdd.length) return ch;
      const fromOthers = toAdd.filter((m) => !m.isMe).length;
      return { ...ch, messages: [...ch.messages, ...toAdd], unread: isActive ? 0 : ch.unread + fromOthers };
    }));
  };

  const openDM = async (userId: string, userName: string): Promise<string> => {
    const existing = channels.find((c) => c.type === 'dm' && c.name === userName);
    if (existing) return existing.id;
    try {
      const r = await apiFetch('/api/chat/channels/dm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId }),
      });
      const data = await r.json();
      if (data?.channel) {
        setChannels((prev) => {
          if (prev.find((c) => c.id === data.channel.id)) return prev;
          return [...prev, { id: data.channel.id, name: data.channel.name, type: 'dm', status: 'online', unread: 0, messages: [] }];
        });
        return data.channel.id;
      }
    } catch {}
    return '';
  };

  const toggleReaction = (channelId: string, msgId: string, emoji: string) => {
    setChannels((prev) => prev.map((ch) =>
      ch.id !== channelId ? ch : {
        ...ch,
        messages: ch.messages.map((m) => {
          if (m.id !== msgId) return m;
          const reactions = m.reactions ?? [];
          const existing = reactions.find((r) => r.emoji === emoji);
          if (existing) {
            return { ...m, reactions: reactions.map((r) => r.emoji === emoji ? { ...r, active: !r.active, count: r.active ? r.count - 1 : r.count + 1 } : r).filter((r) => r.count > 0) };
          }
          return { ...m, reactions: [...reactions, { emoji, count: 1, active: true }] };
        }),
      }
    ));
  };

  const markChannelRead = (channelId: string) =>
    setChannels((prev) => prev.map((ch) => ch.id === channelId ? { ...ch, unread: 0 } : ch));

  const leaveChannel = (channelId: string) => {
    setChannels((prev) => prev.filter((c) => c.id !== channelId));
    apiFetch(`/api/chat/channels/${channelId}/members/me`, { method: 'DELETE' }).catch(() => {});
  };

  const setActiveChannelId = (id: string) => {
    activeChannelIdRef.current = id;
  };

  const addChannel = (name: string) => {
    apiFetch('/api/chat/channels', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.toLowerCase().replace(/\s+/g, '-'), type: 'channel' }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.channel) {
          setChannels((prev) => {
            if (prev.find((c) => c.id === data.channel.id)) return prev;
            return [...prev, { id: data.channel.id, name: data.channel.name, type: 'channel', unread: 0, messages: [] }];
          });
        }
      })
      .catch(() => {});
  };

  // ── Files ─────────────────────────────────────────────────────────────────
  const [files, setFiles]           = useState<FileItem[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);

  useEffect(() => {
    api('GET', '/files')
      .then(({ files: data }) => setFiles(data ?? []))
      .catch(() => {})
      .finally(() => setFilesLoading(false));
  }, []);

  const addFolder = async (name: string, storageId?: string) => {
    const { id } = await api('POST', '/files', { name, type: 'Folder', size: '0 files', date: '방금', color: 'primary', iconType: 'folder', storageId: storageId ?? null });
    setFiles((prev) => [{ id, name, type: 'Folder', size: '0 files', date: '방금', color: 'primary', iconType: 'folder', storageId }, ...prev]);
  };

  const addFile = async (file: Omit<FileItem, 'id'>) => {
    const { id } = await api('POST', '/files', { ...file, iconType: file.iconType, storageId: file.storageId ?? null });
    setFiles((prev) => [{ ...file, id }, ...prev]);
  };

  const deleteFile = async (id: string) => {
    await api('DELETE', `/files/${id}`);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const renameFile = async (id: string, name: string) => {
    await api('PATCH', `/files/${id}`, { name });
    setFiles((prev) => prev.map((f) => f.id === id ? { ...f, name } : f));
  };

  // ── Notifications (로컬) ──────────────────────────────────────────────────
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const addNotification = (n: Omit<Notification, 'id'>) =>
    setNotifications((prev) => [{ ...n, id: crypto.randomUUID() }, ...prev]);
  const markNotificationRead = (id: string) =>
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  const markAllNotificationsRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  return (
    <AppContext.Provider value={{
      projects, projectsLoading, addProject, updateProject, deleteProject, addProjectMember, removeProjectMember,
      sprintTasks, toggleSprintTask, addSprintTask, deleteSprintTask,
      activities, addActivity, markAllRead,
      kanban, kanbanLoading, addKanbanTask, editKanbanTask, deleteKanbanTask, addKanbanColumn, deleteKanbanColumn,
      projectKanban, addProjectKanbanTask, editProjectKanbanTask, deleteProjectKanbanTask, addProjectKanbanColumn, deleteProjectKanbanColumn, initProjectKanban,
      channels, registeredUsers, sendMessage, receiveMessages, toggleReaction, markChannelRead, addChannel, openDM, leaveChannel, loadChannels, pollChannels, setActiveChannelId,
      files, filesLoading, addFolder, addFile, deleteFile, renameFile,
      notifications, addNotification, markNotificationRead, markAllNotificationsRead,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
