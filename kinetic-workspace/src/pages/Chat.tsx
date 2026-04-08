import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Plus, UserPlus, Info, Download, Paperclip, Smile, AtSign, Bold, Italic, Send, Pin, Palette, X, Bell } from 'lucide-react';
import { cn } from '../lib/utils';
import { useApp, ChatMessage } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import { apiFetch } from '../lib/apiFetch';
import { useAuth } from '../contexts/AuthContext';

const EMOJI_LIST = ['👍', '❤️', '🔥', '✨', '😂', '🎉', '🚀', '💯'];

// 서버 메시지 → ChatMessage 변환
function mapServerMsg(m: any, myId?: string): ChatMessage {
  return {
    id: m.id,
    user: m.user_name,
    time: new Date(m.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    content: m.content,
    isMe: m.user_id === myId,
    serverTime: m.created_at,
  };
}

export function Chat() {
  const { channels, registeredUsers, sendMessage, receiveMessages, toggleReaction, markChannelRead, addChannel, openDM, leaveChannel, addNotification, loadChannels, pollChannels, setActiveChannelId: syncActiveChannel } = useApp();
  const { toast } = useToast();
  const { user } = useAuth();

  const [activeChannelId, setActiveChannelId] = useState('');
  const [inputText, setInputText]             = useState('');
  const [emojiPicker, setEmojiPicker]         = useState<string | null>(null);
  const [addChannelOpen, setAddChannelOpen]   = useState(false);
  const [newChannelName, setNewChannelName]   = useState('');
  const [searchQuery, setSearchQuery]         = useState('');
  const [dmPickerOpen, setDmPickerOpen]       = useState(false);
  const [memberMgmtOpen, setMemberMgmtOpen]   = useState(false);
  const dmPickerRef                           = useRef<HTMLDivElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const emojiRef       = useRef<HTMLDivElement>(null);

  // 폴링 기준 타임스탬프 (activeChannelId별로 관리)
  const lastPollTimeRef = useRef<Record<string, string>>({});

  // 채널 목록 로드 후 첫 채널 선택
  useEffect(() => {
    if (channels.length > 0 && !activeChannelId) {
      setActiveChannelId(channels[0].id);
    }
  }, [channels, activeChannelId]);

  // ── WS 폴백: 채널 목록 폴링 (30초) — 새 DM 채널 감지 ──────────────────────
  useEffect(() => {
    const listPoll = setInterval(() => pollChannels(), 30000);
    return () => clearInterval(listPoll);
  }, []); // eslint-disable-line

  // ── 활성 채널 폴링 (3초) — WS 실패 시 실시간 대체 ──────────────────────────
  useEffect(() => {
    if (!activeChannelId) return;
    const activePoll = setInterval(() => {
      const after = lastPollTimeRef.current[activeChannelId];
      if (!after) return;
      apiFetch(`/api/chat/channels/${activeChannelId}/messages?after=${encodeURIComponent(after)}`)
        .then((r) => r.ok ? r.json() : { messages: [] })
        .then(({ messages: serverMsgs = [] }) => {
          if (!serverMsgs.length) return;
          const mapped = serverMsgs.map((m: any) => mapServerMsg(m, user?.id));
          receiveMessages(activeChannelId, mapped, true);
          lastPollTimeRef.current[activeChannelId] = serverMsgs[serverMsgs.length - 1].created_at;
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(activePoll);
  }, [activeChannelId]); // eslint-disable-line

  // ── 비활성 채널 폴링 (10초) — 읽지 않은 메시지 카운트 ──────────────────────
  useEffect(() => {
    const inactivePoll = setInterval(() => {
      channels.forEach((ch) => {
        if (ch.id === activeChannelId) return;
        const after = lastPollTimeRef.current[ch.id];
        if (!after) return;
        apiFetch(`/api/chat/channels/${ch.id}/messages?after=${encodeURIComponent(after)}`)
          .then((r) => r.ok ? r.json() : { messages: [] })
          .then(({ messages: serverMsgs = [] }) => {
            if (!serverMsgs.length) return;
            const mapped = serverMsgs.map((m: any) => mapServerMsg(m, user?.id));
            receiveMessages(ch.id, mapped, false);
            lastPollTimeRef.current[ch.id] = serverMsgs[serverMsgs.length - 1].created_at;
          })
          .catch(() => {});
      });
    }, 10000);
    return () => clearInterval(inactivePoll);
  }, [channels, activeChannelId]); // eslint-disable-line

  const activeChannel = channels.find((c) => c.id === activeChannelId) ?? channels[0];
  const channelList   = channels.filter((c) => c.type === 'channel');
  const dmList        = channels.filter((c) => c.type === 'dm');

  // 메시지 끝으로 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChannel?.messages]);

  // 외부 클릭 처리
  useEffect(() => {
    function outside(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setEmojiPicker(null);
      if (dmPickerRef.current && !dmPickerRef.current.contains(e.target as Node)) setDmPickerOpen(false);
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  // ── 활성 채널 전환 시: AppContext에 알리고 메시지 초기 로드 ──────────────────
  useEffect(() => {
    if (!activeChannelId) return;

    // WS가 isActive 판단에 사용할 현재 채널 ID를 AppContext에 동기화
    syncActiveChannel(activeChannelId);

    // 초기 로드 (채널 전환 시 기존 메시지 + 새 메시지 가져오기)
    apiFetch(`/api/chat/channels/${activeChannelId}/messages`)
      .then((r) => r.ok ? r.json() : { messages: [] })
      .then(({ messages: serverMsgs = [] }) => {
        const mapped = serverMsgs.map((m: any) => mapServerMsg(m, user?.id));
        receiveMessages(activeChannelId, mapped, true);
        // 메시지가 없어도 폴링 기준 시간을 설정 — 빈 채널(새 DM 등)도 폴링이 동작하도록
        lastPollTimeRef.current[activeChannelId] = serverMsgs.length > 0
          ? serverMsgs[serverMsgs.length - 1].created_at
          : new Date(Date.now() - 2000).toISOString();
      })
      .catch(() => {});
  }, [activeChannelId]);  // eslint-disable-line

  function handleSend() {
    if (!inputText.trim() || !activeChannel) return;
    const chId = activeChannel.id;
    setInputText('');
    inputRef.current?.focus();
    sendMessage(chId, inputText.trim(), user?.name)
      .then((serverTime) => {
        // 전송 성공 시 폴링 기준 시간을 서버 시간으로 업데이트
        if (serverTime) lastPollTimeRef.current[chId] = serverTime;
      })
      .catch((err) => {
        console.error('[Chat] handleSend 전송 실패:', err);
        // err 가 HTTP 상태 코드(숫자)면 표시, 아니면 일반 메시지
        const detail = typeof err === 'number' ? ` (${err})` : '';
        toast(`메시지 전송에 실패했습니다${detail}. 브라우저 콘솔을 확인해 주세요.`, 'error');
      });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleChannelClick(id: string) {
    setActiveChannelId(id);
    markChannelRead(id);
  }

  function handleAddChannel() {
    if (!newChannelName.trim()) return;
    addChannel(newChannelName.trim());
    setAddChannelOpen(false);
    setNewChannelName('');
    toast(`#${newChannelName.toLowerCase().replace(/\s+/g, '-')} 채널이 생성되었습니다.`, 'success');
  }

  const filteredMessages = (activeChannel?.messages ?? []).filter((m) =>
    !searchQuery || m.content?.toLowerCase().includes(searchQuery.toLowerCase()) || m.user.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex bg-surface overflow-hidden -mx-6 lg:-mx-10 -mt-24 -mb-12" style={{ height: 'calc(100% + 9rem)' }}>
      {/* -mt-24/-mb-12으로 main의 pt-24/pb-12 패딩을 상쇄, calc로 content area에 패딩만큼 높이를 추가 확보 */}

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <section className="w-72 bg-surface-container-low flex flex-col shrink-0">
        <div className="p-4 border-b border-outline-variant/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container-highest border-none rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary/30 placeholder:text-on-surface-variant/50 transition-all outline-none"
              placeholder="메시지 검색..."
              type="text"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-6 hide-scrollbar">
          {/* Channels */}
          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant/60">채널</h3>
              <button onClick={() => setAddChannelOpen(true)} className="text-on-surface-variant hover:text-primary transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {addChannelOpen && (
              <div className="mx-1 mb-2 flex gap-1.5">
                <input autoFocus value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddChannel(); if (e.key === 'Escape') { setAddChannelOpen(false); setNewChannelName(''); } }}
                  placeholder="채널 이름"
                  className="flex-1 bg-surface-container-highest rounded-lg px-3 py-1.5 text-sm border-none focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-on-surface-variant/40"
                />
                <button onClick={handleAddChannel} className="text-primary hover:text-secondary transition-colors px-1"><Plus className="w-4 h-4" /></button>
                <button onClick={() => { setAddChannelOpen(false); setNewChannelName(''); }} className="text-on-surface-variant hover:text-on-surface transition-colors px-1"><X className="w-4 h-4" /></button>
              </div>
            )}
            <div className="space-y-0.5">
              {channelList.map((ch) => (
                <div key={ch.id} className={cn('flex items-center gap-1 rounded-lg transition-all group/ch',
                  activeChannelId === ch.id ? 'bg-surface-container' : 'hover:bg-surface-container-high'
                )}>
                  <button onClick={() => handleChannelClick(ch.id)}
                    className={cn('flex-1 flex items-center gap-3 px-3 py-2 text-sm',
                      activeChannelId === ch.id ? 'text-primary font-medium' : 'text-on-surface-variant hover:text-on-surface'
                    )}>
                    <span className={cn('text-lg shrink-0', activeChannelId === ch.id ? 'text-primary/60' : 'text-on-surface-variant/40')}>#</span>
                    <span className="flex-1 text-left truncate">{ch.name}</span>
                    {ch.unread > 0 && <span className="w-2 h-2 rounded-full bg-secondary shrink-0" />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeChannelId === ch.id) {
                        const next = channels.find((c) => c.id !== ch.id);
                        if (next) setActiveChannelId(next.id);
                      }
                      leaveChannel(ch.id);
                    }}
                    className="opacity-0 group-hover/ch:opacity-100 p-1.5 mr-1 text-on-surface-variant/50 hover:text-error transition-all rounded"
                    title="채널 숨기기"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* DMs */}
          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant/60">다이렉트 메시지</h3>
              <div className="relative" ref={dmPickerRef}>
                <button
                  onClick={() => setDmPickerOpen((v) => !v)}
                  className="text-on-surface-variant hover:text-primary transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                {dmPickerOpen && (
                  <div className="absolute right-0 top-full mt-1 w-56 bg-surface-container-highest/95 backdrop-blur-xl rounded-xl border border-white/5 shadow-[0_8px_24px_rgba(0,0,0,0.5)] overflow-hidden z-50">
                    {registeredUsers.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-on-surface-variant">가입된 유저가 없습니다.</div>
                    ) : (
                      registeredUsers
                        .filter((u) => u.name !== user?.name) // 자기 자신 제외
                        .map((u) => (
                          <button
                            key={u.id}
                            onClick={async () => {
                              const chId = await openDM(u.id, u.name);
                              if (chId) setActiveChannelId(chId);
                              setDmPickerOpen(false);
                            }}
                            className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-white/5 transition-colors"
                          >
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-[10px] font-bold text-surface shrink-0">
                              {u.name.charAt(0)}
                            </div>
                            <div className="text-left">
                              <p className="text-sm text-on-surface">{u.name}</p>
                              <p className="text-[10px] text-on-surface-variant">{u.email}</p>
                            </div>
                          </button>
                        ))
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-0.5">
              {dmList.map((dm) => (
                <div key={dm.id} className={cn('flex items-center gap-1 rounded-lg transition-all group/dm',
                  activeChannelId === dm.id ? 'bg-surface-container' : 'hover:bg-surface-container-high'
                )}>
                  <button onClick={() => handleChannelClick(dm.id)}
                    className={cn('flex-1 flex items-center gap-3 px-3 py-2 text-sm',
                      activeChannelId === dm.id ? 'text-primary font-medium' : 'text-on-surface-variant hover:text-on-surface'
                    )}>
                    <div className="relative shrink-0">
                      <div className="w-6 h-6 rounded-md bg-surface-container-highest flex items-center justify-center text-[10px] font-bold">
                        {dm.name.charAt(0)}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-surface-container-low bg-green-500" />
                    </div>
                    <span className="flex-1 text-left truncate">{dm.name}</span>
                    {dm.unread > 0 && <span className="bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold">{dm.unread}</span>}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeChannelId === dm.id) {
                        const next = channels.find((c) => c.id !== dm.id);
                        if (next) setActiveChannelId(next.id);
                      }
                      leaveChannel(dm.id);
                    }}
                    className="opacity-0 group-hover/dm:opacity-100 p-1.5 mr-1 text-on-surface-variant/50 hover:text-error transition-all rounded"
                    title="DM 닫기"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Main chat ────────────────────────────────────────── */}
      <section className="flex-1 flex flex-col bg-surface overflow-hidden relative">
        {/* Channel header */}
        <header className="h-[72px] flex items-center justify-between px-8 border-b border-outline-variant/10 bg-surface/50 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-primary font-bold text-xl">
              {activeChannel?.type === 'channel' ? '#' : activeChannel?.name.charAt(0)}
            </div>
            <div>
              <h2 className="font-headline font-bold text-lg leading-none">{activeChannel?.name}</h2>
              <p className="text-xs text-on-surface-variant mt-1">
                {activeChannel?.type === 'channel' ? `${activeChannel.messages.length}개의 메시지` : activeChannel?.status === 'online' ? '온라인' : '오프라인'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeChannel?.type === 'channel' && (
              <button
                onClick={() => setMemberMgmtOpen(true)}
                className="p-2 text-on-surface-variant hover:text-primary transition-colors"
                title="멤버 관리"
              >
                <UserPlus className="w-5 h-5" />
              </button>
            )}
            <button onClick={() => toast('채널 정보를 표시합니다.', 'info')} className="p-2 text-on-surface-variant hover:text-on-surface transition-colors">
              <Info className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Messages — min-h-0 필수: 중첩 flex에서 flex-1만으론 부모 높이를 초과해 overflow가 안 잘림 */}
        <div className="flex-1 min-h-0 overflow-y-auto p-8 space-y-6 hide-scrollbar">
          {searchQuery && filteredMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant/40">
              <Search className="w-8 h-8 mb-3" />
              <p className="text-sm">"{searchQuery}"에 대한 결과가 없습니다.</p>
            </div>
          )}
          {!searchQuery && (
            <div className="flex items-center gap-4 py-2">
              <div className="h-px flex-1 bg-outline-variant/10" />
              <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant/40">오늘</span>
              <div className="h-px flex-1 bg-outline-variant/10" />
            </div>
          )}
          {(searchQuery ? filteredMessages : activeChannel?.messages ?? []).map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              emojiPicker={emojiPicker}
              emojiRef={emojiRef}
              onEmojiOpen={(id) => setEmojiPicker(emojiPicker === id ? null : id)}
              onReact={(emoji) => {
                toggleReaction(activeChannel!.id, msg.id, emoji);
                setEmojiPicker(null);
              }}
              userName={user?.name ?? 'Me'}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <footer className="p-6 pt-0 shrink-0">
          <div className="bg-surface-container-highest/50 backdrop-blur-xl rounded-2xl border border-outline-variant/10 p-2 shadow-2xl">
            <div className="flex flex-col">
              <textarea
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent border-none focus:ring-0 text-sm resize-none py-3 px-4 placeholder:text-on-surface-variant/50 min-h-[50px] max-h-[200px] outline-none"
                placeholder={`메시지 #${activeChannel?.name}`}
                rows={1}
              />
              <div className="flex items-center justify-between p-2 border-t border-outline-variant/5">
                <div className="flex items-center gap-1">
                  <button onClick={() => toast('파일 첨부는 준비 중입니다.', 'info')} className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-bright rounded-lg transition-all"><Paperclip className="w-5 h-5" /></button>
                  <button onClick={() => setEmojiPicker(emojiPicker === 'input' ? null : 'input')} className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-bright rounded-lg transition-all"><Smile className="w-5 h-5" /></button>
                  <button onClick={() => toast('@멘션 기능은 준비 중입니다.', 'info')} className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-bright rounded-lg transition-all"><AtSign className="w-5 h-5" /></button>
                  <div className="w-px h-6 bg-outline-variant/10 mx-1" />
                  <button onClick={() => setInputText((t) => `**${t}**`)} className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-bright rounded-lg transition-all"><Bold className="w-5 h-5" /></button>
                  <button onClick={() => setInputText((t) => `_${t}_`)} className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-bright rounded-lg transition-all"><Italic className="w-5 h-5" /></button>
                </div>
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim()}
                  className="bg-primary hover:bg-primary-dim text-surface px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>전송</span>
                  <Send className="w-4 h-4" />
                </button>
              </div>
              {/* Input emoji picker */}
              {emojiPicker === 'input' && (
                <div ref={emojiRef} className="flex gap-2 px-4 pb-2 flex-wrap">
                  {EMOJI_LIST.map((emoji) => (
                    <button key={emoji} onClick={() => { setInputText((t) => t + emoji); setEmojiPicker(null); inputRef.current?.focus(); }}
                      className="text-xl hover:scale-125 transition-transform active:scale-90">{emoji}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-on-surface-variant/40 font-medium">
            <span><kbd className="bg-surface-container-highest px-1 rounded border border-outline-variant/20">Enter</kbd> 전송</span>
            <span><kbd className="bg-surface-container-highest px-1 rounded border border-outline-variant/20">Shift+Enter</kbd> 줄바꿈</span>
          </div>
        </footer>
      </section>

      {/* ── Member Management Modal ───────────────────────────── */}
      {memberMgmtOpen && activeChannel && (
        <ChannelMemberModal
          channel={activeChannel}
          registeredUsers={registeredUsers}
          currentUserId={user?.id ?? ''}
          onClose={() => setMemberMgmtOpen(false)}
          onRefresh={loadChannels}
        />
      )}

      {/* ── Right panel ──────────────────────────────────────── */}
      <aside className="w-64 bg-surface-container-low border-l border-outline-variant/10 hidden xl:flex flex-col shrink-0">
        <div className="p-5 border-b border-outline-variant/10">
          <h3 className="font-headline font-bold text-sm">채널 정보</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-6 hide-scrollbar">
          <div>
            <div className="aspect-square rounded-2xl bg-gradient-to-br from-surface-container to-surface-variant flex items-center justify-center mb-4 relative overflow-hidden group">
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 absolute inset-0" />
              <Palette className="w-10 h-10 text-primary drop-shadow-lg relative z-10" />
            </div>
            <h4 className="font-bold text-base">{activeChannel?.name}</h4>
            <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
              {activeChannel?.type === 'channel' ? '팀 협업을 위한 채널입니다.' : `${activeChannel?.name}과의 다이렉트 메시지`}
            </p>
          </div>
          <div>
            <h4 className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant/60 mb-3">고정된 항목</h4>
            <div className="space-y-2">
              <PinnedItem title="Style_Guide_v4.fig" user="Sarah Chen" />
              <PinnedItem title="Q4_Visual_Goals.pdf" user="Marcus Bell" />
            </div>
          </div>
          <div>
            <h4 className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant/60 mb-3">
              최근 메시지 ({activeChannel?.messages.length ?? 0})
            </h4>
            <div className="space-y-1">
              {(activeChannel?.messages ?? []).slice(-5).map((m) => (
                <div key={m.id} className="text-[11px] text-on-surface-variant truncate">
                  <span className="font-bold text-on-surface">{m.user}</span>
                  {m.content && `: ${m.content}`}
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg, emojiPicker, emojiRef, onEmojiOpen, onReact, userName }: {
  msg: ChatMessage;
  emojiPicker: string | null;
  emojiRef: React.RefObject<HTMLDivElement>;
  key?: React.Key;
  onEmojiOpen: (id: string) => void;
  onReact: (emoji: string) => void;
  userName: string;
}) {
  const isMe = msg.isMe || msg.user === userName || msg.user === 'Me';

  return (
    <div className={cn('flex gap-4 group', isMe && 'flex-row-reverse')}>
      <div className={cn('w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-sm font-bold',
        isMe ? 'bg-gradient-to-br from-primary to-secondary text-surface' : 'bg-surface-container-highest text-on-surface'
      )}>
        {isMe ? (userName.charAt(0).toUpperCase()) : msg.user.charAt(0).toUpperCase()}
      </div>
      <div className={cn('space-y-1.5 max-w-[70%] flex flex-col', isMe && 'items-end')}>
        <div className={cn('flex items-center gap-2', isMe && 'flex-row-reverse')}>
          <span className="font-bold text-sm">{isMe ? userName : msg.user}</span>
          <span className="text-[10px] text-on-surface-variant/50">{msg.time}</span>
        </div>

        {msg.content && (
          <div className={cn('px-4 py-3 rounded-2xl text-sm leading-relaxed border',
            isMe
              ? msg.failed
                ? 'bg-error/20 border-error/30 text-on-surface font-medium rounded-tr-none'
                : 'bg-gradient-to-br from-primary to-secondary text-surface font-medium rounded-tr-none border-outline-variant/5'
              : 'bg-surface-container-high text-on-surface rounded-tl-none border-outline-variant/5'
          )}>
            {msg.content}
            {/* 전송 실패 표시 — 낙관적 업데이트가 실패한 경우 */}
            {msg.failed && (
              <div className="text-[10px] text-error mt-1">전송 실패 · 서버 콘솔을 확인해 주세요</div>
            )}
          </div>
        )}

        {msg.attachment && (
          <div className="bg-surface-container-high p-1 rounded-2xl rounded-tl-none border border-outline-variant/5">
            <div className="relative rounded-xl overflow-hidden aspect-video w-72">
              <img className="w-full h-full object-cover" src={msg.attachment.image} referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                <button onClick={() => {}} className="bg-white/20 p-3 rounded-full backdrop-blur-md hover:bg-white/30 transition-colors">
                  <Download className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>
            <div className="p-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold">{msg.attachment.name}</p>
                <p className="text-[10px] text-on-surface-variant/60">{msg.attachment.size}</p>
              </div>
            </div>
          </div>
        )}

        {/* Reactions + emoji picker */}
        <div className="flex items-center gap-1 flex-wrap relative">
          {(msg.reactions ?? []).filter((r) => r.count > 0).map((r, i) => (
            <button key={i} onClick={() => onReact(r.emoji)}
              className={cn('rounded-full px-2 py-0.5 flex items-center gap-1.5 transition-colors border text-xs',
                r.active ? 'bg-primary/10 border-primary/20' : 'bg-surface-container-highest border-outline-variant/10 hover:bg-surface-bright'
              )}>
              <span>{r.emoji}</span>
              <span className={cn('text-[10px] font-bold', r.active ? 'text-primary' : 'text-on-surface-variant')}>{r.count}</span>
            </button>
          ))}
          {/* Add reaction */}
          <div className="relative">
            <button
              onClick={() => onEmojiOpen(msg.id)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-bright transition-all"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
            {emojiPicker === msg.id && (
              <div ref={emojiRef} className={cn(
                'absolute bottom-full mb-1 bg-surface-container-highest/90 backdrop-blur-xl rounded-xl border border-white/5 p-2 flex gap-1.5 z-50 shadow-[0_8px_24px_rgba(0,0,0,0.4)]',
                isMe ? 'right-0' : 'left-0'
              )}>
                {EMOJI_LIST.map((emoji) => (
                  <button key={emoji} onClick={() => onReact(emoji)} className="text-lg hover:scale-125 transition-transform active:scale-90">
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PinnedItem({ title, user }: { title: string; user: string }) {
  const { toast } = useToast();
  return (
    <div onClick={() => toast(`"${title}" 파일을 엽니다.`, 'info')}
      className="bg-surface-container-high p-3 rounded-xl border border-outline-variant/5 hover:border-primary/20 transition-colors cursor-pointer group">
      <div className="flex items-center gap-2 mb-1">
        <Pin className="w-3 h-3 text-primary" />
        <span className="text-[10px] font-bold">{title}</span>
      </div>
      <p className="text-[10px] text-on-surface-variant">Pinned by {user}</p>
    </div>
  );
}

// ─── ChannelMemberModal ───────────────────────────────────────────────────────

interface MemberUser { id: string; name: string; email: string; role: string; }

function ChannelMemberModal({
  channel,
  registeredUsers,
  currentUserId,
  onClose,
  onRefresh,
}: {
  channel: { id: string; name: string; type: string };
  registeredUsers: MemberUser[];
  currentUserId: string;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [members, setMembers] = useState<MemberUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/chat/channels/${channel.id}/members`);
      const data = await res.json();
      setMembers(data.members ?? []);
    } catch {
      toast('멤버 목록을 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }, [channel.id]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const memberIds = new Set(members.map((m) => m.id));
  const nonMembers = registeredUsers.filter((u) => !memberIds.has(u.id));

  async function addMember(userId: string, userName: string) {
    const res = await apiFetch(`/api/chat/channels/${channel.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      toast(`${userName}님을 채널에 추가했습니다.`, 'success');
      fetchMembers();
      onRefresh();
    } else {
      toast('추가에 실패했습니다.', 'error');
    }
  }

  async function removeMember(userId: string, userName: string) {
    const res = await apiFetch(`/api/chat/channels/${channel.id}/members/${userId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      toast(`${userName}님을 채널에서 제거했습니다.`, 'success');
      fetchMembers();
      onRefresh();
    } else {
      toast('제거에 실패했습니다.', 'error');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-surface-container-highest/90 backdrop-blur-xl rounded-2xl border border-white/5 shadow-[0_24px_64px_rgba(0,0,0,0.6)] w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/10">
          <div>
            <h2 className="font-headline font-bold text-base">멤버 관리</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">#{channel.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-on-surface-variant hover:text-on-surface transition-colors rounded-lg hover:bg-surface-bright">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto hide-scrollbar">
          {/* Current members */}
          <div>
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant/60 mb-3">
              현재 멤버 ({members.length})
            </h3>
            {loading ? (
              <div className="text-xs text-on-surface-variant/50 py-2">불러오는 중...</div>
            ) : members.length === 0 ? (
              <div className="text-xs text-on-surface-variant/50 py-2">멤버가 없습니다.</div>
            ) : (
              <div className="space-y-1">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors group">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-[11px] font-bold text-surface shrink-0">
                      {m.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.name}</p>
                      <p className="text-[10px] text-on-surface-variant/60 truncate">{m.email}</p>
                    </div>
                    <span className="text-[10px] text-on-surface-variant/40 shrink-0">{m.role}</span>
                    {m.id !== currentUserId && (
                      <button
                        onClick={() => removeMember(m.id, m.name)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-on-surface-variant/50 hover:text-error transition-all rounded"
                        title="멤버 제거"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add members */}
          {nonMembers.length > 0 && (
            <div>
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant/60 mb-3">
                추가 가능한 멤버
              </h3>
              <div className="space-y-1">
                {nonMembers.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors">
                    <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-[11px] font-bold text-on-surface-variant shrink-0">
                      {u.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      <p className="text-[10px] text-on-surface-variant/60 truncate">{u.email}</p>
                    </div>
                    <button
                      onClick={() => addMember(u.id, u.name)}
                      className="shrink-0 text-xs font-bold text-primary hover:text-secondary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-all"
                    >
                      추가
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
