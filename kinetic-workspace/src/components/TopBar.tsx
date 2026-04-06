import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, HelpCircle, Settings, LogOut, User, X, Check } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { cn } from '../lib/utils';

export function TopBar() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { user, logout } = useAuth();
  const { notifications, markNotificationRead, markAllNotificationsRead, projects, sprintTasks, files } = useApp();

  const [userDropdown, setUserDropdown]   = useState(false);
  const [notifPanel, setNotifPanel]       = useState(false);
  const [searchOpen, setSearchOpen]       = useState(false);
  const [searchQuery, setSearchQuery]     = useState('');

  const userRef   = useRef<HTMLDivElement>(null);
  const notifRef  = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const unreadNotifs = notifications.filter((n) => !n.read).length;

  const TABS = [
    { key: 'Dashboard', label: '대시보드', path: '/' },
    { key: 'Projects',  label: '프로젝트', path: '/projects' },
    { key: 'Chat',      label: '채팅',     path: '/chat' },
    { key: 'Storage',   label: '스토리지', path: '/storage' },
  ];

  const getActiveTab = () => {
    if (location.pathname === '/') return 'Dashboard';
    if (location.pathname.startsWith('/projects')) return 'Projects';
    if (location.pathname.startsWith('/chat')) return 'Chat';
    if (location.pathname.startsWith('/storage')) return 'Storage';
    return '';
  };
  const activeTab = getActiveTab();

  // Global search results
  const searchResults = searchQuery.trim().length > 1 ? [
    ...projects.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map((p) => ({ type: 'project' as const, label: p.name, sub: p.phase, path: '/projects' })),
    ...sprintTasks.filter((t) => t.label.toLowerCase().includes(searchQuery.toLowerCase())).map((t) => ({ type: 'task' as const, label: t.label, sub: t.checked ? '완료' : '진행 중', path: '/' })),
    ...files.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase())).map((f) => ({ type: 'file' as const, label: f.name, sub: f.type, path: '/storage' })),
  ] : [];

  // Click outside handlers
  useEffect(() => {
    function outside(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node))    setUserDropdown(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node))  setNotifPanel(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) { setSearchOpen(false); setSearchQuery(''); }
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  // Open search with Cmd/Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const avatarInitial = user?.name?.charAt(0).toUpperCase() ?? '?';

  const typeIcon: Record<string, string> = { project: '📁', task: '✅', file: '📄' };
  const typeLabel: Record<string, string> = { project: '프로젝트', task: '태스크', file: '파일' };

  return (
    <header className="fixed top-0 left-0 md:left-20 xl:left-64 right-0 z-50 bg-[#1a1a1a]/70 backdrop-blur-xl shadow-[0_20px_40px_rgba(255,255,255,0.04)] flex items-center justify-between px-6 py-3 transition-all duration-300 border-b border-white/5">
      {/* Nav tabs */}
      <div className="flex items-center gap-8">
        <div className="hidden md:flex items-center gap-6 font-headline tracking-tight text-sm font-medium">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Link key={tab.key} to={tab.path} className={cn('px-3 py-1 rounded-lg transition-colors duration-200', isActive ? 'text-primary font-bold' : 'text-on-surface-variant hover:bg-surface-bright')}>
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Search bar (desktop) */}
        <div ref={searchRef} className="relative hidden lg:block">
          <div
            className="flex items-center bg-surface-container-highest px-4 py-2 rounded-xl gap-2 w-64 border border-white/5 focus-within:ring-2 focus-within:ring-primary/20 focus-within:bg-surface-container-low transition-all cursor-text"
            onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
          >
            <Search className="w-4 h-4 text-on-surface-variant shrink-0" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              className="bg-transparent border-none text-sm focus:ring-0 text-on-surface placeholder:text-on-surface-variant/50 w-full outline-none"
              placeholder="검색... (Ctrl+K)"
              type="text"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }} className="text-on-surface-variant hover:text-on-surface">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search results dropdown */}
          {searchOpen && searchQuery.trim().length > 1 && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-surface-container-highest/90 backdrop-blur-xl rounded-xl border border-white/5 shadow-[0_8px_24px_rgba(0,0,0,0.5)] overflow-hidden z-50">
              {searchResults.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-on-surface-variant/50">결과 없음</div>
              ) : (
                <>
                  <div className="px-4 py-2 border-b border-white/5">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{searchResults.length}개 결과</span>
                  </div>
                  {searchResults.slice(0, 6).map((r, i) => (
                    <button key={i}
                      onClick={() => { navigate(r.path); setSearchOpen(false); setSearchQuery(''); }}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
                    >
                      <span className="text-base">{typeIcon[r.type]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-on-surface truncate">{r.label}</p>
                        <p className="text-[10px] text-on-surface-variant">{typeLabel[r.type]} · {r.sub}</p>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Notification bell */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => { setNotifPanel(!notifPanel); setUserDropdown(false); }}
            className="relative p-2 text-on-surface-variant hover:text-on-surface transition-colors bg-surface-container rounded-full border border-white/5"
          >
            <Bell className="w-5 h-5" />
            {unreadNotifs > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-secondary rounded-full flex items-center justify-center text-[9px] font-bold text-surface">
                {unreadNotifs}
              </span>
            )}
          </button>

          {notifPanel && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-surface-container-highest/90 backdrop-blur-[20px] rounded-xl border border-white/5 shadow-[0_20px_40px_rgba(0,0,0,0.5)] overflow-hidden z-50">
              <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
                <span className="font-bold text-sm">알림</span>
                {unreadNotifs > 0 && (
                  <button onClick={markAllNotificationsRead} className="text-[10px] font-bold text-primary hover:text-secondary transition-colors">
                    모두 읽음
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.map((n) => {
                  const colorCls: Record<string, string> = { primary: 'bg-primary', secondary: 'bg-secondary', tertiary: 'bg-tertiary' };
                  return (
                    <button key={n.id}
                      onClick={() => markNotificationRead(n.id)}
                      className={cn('w-full px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition-colors text-left', !n.read && 'bg-white/[0.02]')}
                    >
                      <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', n.read ? 'bg-transparent' : colorCls[n.color] ?? 'bg-secondary')} />
                      <div className="flex-1">
                        <p className={cn('text-sm leading-snug', n.read ? 'text-on-surface-variant' : 'text-on-surface font-medium')}>{n.text}</p>
                        <p className="text-[10px] text-on-surface-variant/50 mt-1">{n.time}</p>
                      </div>
                      {!n.read && <Check className="w-3 h-3 text-on-surface-variant/40 shrink-0 mt-1" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => navigate('/settings')}
          className="p-2 text-on-surface-variant hover:text-on-surface transition-colors bg-surface-container rounded-full border border-white/5"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        <div className="w-px h-6 bg-white/10 mx-1" />

        {/* User avatar dropdown */}
        <div ref={userRef} className="relative">
          <button onClick={() => { setUserDropdown(!userDropdown); setNotifPanel(false); }} className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-surface font-bold text-sm border border-primary/30 group-hover:shadow-lg group-hover:shadow-primary/20 transition-all">
              {avatarInitial}
            </div>
            <div className="hidden xl:block text-left">
              <p className="text-sm font-bold leading-none">{user?.name}</p>
              <p className="text-[10px] text-on-surface-variant mt-0.5">{user?.role}</p>
            </div>
          </button>

          {userDropdown && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-surface-container-highest/90 backdrop-blur-[20px] rounded-xl border border-white/5 shadow-[0_20px_40px_rgba(0,0,0,0.5)] overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-white/5">
                <p className="font-bold text-sm">{user?.name}</p>
                <p className="text-on-surface-variant text-xs">{user?.email}</p>
              </div>
              <div className="p-2">
                <Link to="/settings" onClick={() => setUserDropdown(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-white/5 hover:text-on-surface text-sm transition-all">
                  <Settings className="w-4 h-4" /> 설정
                </Link>
                <Link to="/settings" onClick={() => setUserDropdown(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-white/5 hover:text-on-surface text-sm transition-all">
                  <User className="w-4 h-4" /> 프로필
                </Link>
                <div className="h-px bg-white/5 my-1" />
                <button
                  onClick={() => { logout(); navigate('/login'); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-error hover:bg-error/10 text-sm transition-all text-left"
                >
                  <LogOut className="w-4 h-4" /> 로그아웃
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
