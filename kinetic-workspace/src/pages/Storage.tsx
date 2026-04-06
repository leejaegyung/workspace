import React, { useState, useRef, useEffect } from 'react';
import { apiFetch } from '../lib/apiFetch';
import { Search, Plus, Folder, FileText, Archive, Film, CloudUpload, MoreHorizontal, Database, ChevronRight, Trash2, Edit2, Download, Check, X, Cloud, HardDrive, Eye, ExternalLink, Settings, ArrowLeft } from 'lucide-react';
import { cn } from '../lib/utils';
import { useApp, FileItem } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from '../components/Modal';
import { useNavigate } from 'react-router-dom';

interface StorageConnection {
  id: string;
  type: 'google-drive' | 'nas' | 'local';
  label: string;
  config: Record<string, string>;
  connected: boolean;
  sharing?: 'all' | 'private';
  ownerId?: string;
}

export function Storage() {
  const { files, addFolder, addFile, deleteFile, renameFile } = useApp();
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [folderModal, setFolderModal]         = useState(false);
  const [folderName, setFolderName]           = useState('');
  const [searchQuery, setSearchQuery]         = useState('');
  const [activeMenu, setActiveMenu]           = useState<string | null>(null);
  const [renameId, setRenameId]               = useState<string | null>(null);
  const [renameValue, setRenameValue]         = useState('');
  const [dragOver, setDragOver]               = useState(false);
  const [previewFile, setPreviewFile]         = useState<FileItem | null>(null);
  const [connections, setConnections]         = useState<StorageConnection[]>([]);
  const [activeStorageId, setActiveStorageId] = useState<string | null>(null);
  const [scannedFiles, setScannedFiles]       = useState<any[] | null>(null);
  const [scanLoading, setScanLoading]         = useState(false);
  const [scanError, setScanError]             = useState<string | null>(null);
  const [diskStats, setDiskStats]             = useState<{ total: number; used: number } | null>(null);
  // 폴더 탐색: 현재 경로와 뒤로가기 스택
  const [currentDirPath, setCurrentDirPath]   = useState<string | null>(null);
  const [dirStack, setDirStack]               = useState<string[]>([]); // 뒤로가기 스택

  useEffect(() => {
    apiFetch('/api/data/storage/connections')
      .then(r => r.ok ? r.json() : { value: [] })
      .then(({ value }) => { if (Array.isArray(value)) setConnections(value); })
      .catch(() => {});
  }, []);

  // activeStorageId 바뀌면 폴더 스택 초기화
  useEffect(() => {
    setCurrentDirPath(null);
    setDirStack([]);
    setDiskStats(null);
  }, [activeStorageId]);

  // 로컬 스토리지 선택 또는 폴더 이동 시 파일시스템 스캔
  useEffect(() => {
    if (!activeStorageId) { setScannedFiles(null); setScanError(null); return; }
    const conn = connections.find(c => c.id === activeStorageId);
    if (!conn || (conn.type !== 'local' && conn.type !== 'nas') || !conn.config.path) { setScannedFiles(null); setScanError(null); return; }

    const scanPath = currentDirPath ?? conn.config.path;
    setScanLoading(true);
    setScanError(null);
    apiFetch(`/api/data/storage/scan?dirPath=${encodeURIComponent(scanPath)}`)
      .then(r => r.json())
      .then(({ files: data, error, diskTotal, diskUsed }) => {
        if (error) { setScanError(error); setScannedFiles(null); setDiskStats(null); }
        else {
          setScannedFiles(data ?? []);
          if (diskTotal) setDiskStats({ total: diskTotal, used: diskUsed });
        }
      })
      .catch(() => setScanError('파일 목록을 불러올 수 없습니다.'))
      .finally(() => setScanLoading(false));
  }, [activeStorageId, connections, currentDirPath]);

  // 폴더 클릭 핸들러
  function enterFolder(file: any) {
    if (!file.isDir || !file.fullPath) return;
    const conn = connections.find(c => c.id === activeStorageId);
    setDirStack(prev => [...prev, currentDirPath ?? conn?.config?.path ?? '']);
    setCurrentDirPath(file.fullPath);
    setSearchQuery('');
  }

  // 뒤로가기
  function goBack() {
    if (dirStack.length === 0) return;
    const prev = dirStack[dirStack.length - 1];
    const conn = connections.find(c => c.id === activeStorageId);
    setCurrentDirPath(prev === conn?.config?.path ? null : prev);
    setDirStack(d => d.slice(0, -1));
    setSearchQuery('');
  }

  const fileInputRef = useRef<HTMLInputElement>(null);

  function fmtDisplaySize(bytes: number) {
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
    if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    if (bytes >= 1024)      return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  }

  // 스탯: 드라이브 실제 사용량 우선, 없으면 DB 기준
  const displayUsed  = diskStats?.used ?? 42.8 * 1024 ** 3;
  const displayTotal = diskStats?.total ?? 100 * 1024 ** 3;
  const storagePercent = Math.min(Math.round((displayUsed / displayTotal) * 100), 99);

  // 로컬 스캔 결과 or DB 파일
  const storageFiles = scannedFiles !== null
    ? scannedFiles
    : activeStorageId
      ? files.filter((f) => f.storageId === activeStorageId)
      : files.filter((f) => !f.storageId);

  const filteredFiles = storageFiles.filter((f) =>
    !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase()) || f.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 브레드크럼 경로 세그먼트 계산
  const activeConn = connections.find(c => c.id === activeStorageId);
  const rootPath = activeConn?.config?.path ?? '';
  const breadcrumbSegments: { label: string; dirPath: string | null }[] = [];
  if (activeConn && currentDirPath && rootPath) {
    const rel = currentDirPath.startsWith(rootPath)
      ? currentDirPath.slice(rootPath.length).replace(/^[\\/]/, '')
      : currentDirPath;
    const parts = rel.split(/[\\/]/).filter(Boolean);
    let built = rootPath;
    for (const part of parts) {
      built = built.replace(/[\\/]+$/, '') + '\\' + part;
      breadcrumbSegments.push({ label: part, dirPath: built });
    }
  }

  async function handleCreateFolder() {
    if (!folderName.trim()) return;
    await addFolder(folderName.trim(), activeStorageId ?? undefined);
    toast(`"${folderName.trim()}" 폴더가 생성되었습니다.`, 'success');
    setFolderModal(false);
    setFolderName('');
  }

  function handleUpload(fileList: FileList | null) {
    if (!fileList) return;
    Array.from(fileList).forEach((f) => {
      const sizeMB = (f.size / 1024 / 1024).toFixed(1);
      addFile({
        name: f.name,
        type: f.type.split('/')[1]?.toUpperCase() || 'File',
        size: `${sizeMB} MB`,
        date: '방금',
        iconType: f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'film' : 'file',
        color: 'primary',
        storageId: activeStorageId ?? undefined,
      });
    });
    toast(`${fileList.length}개의 파일이 업로드되었습니다.`, 'success');
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  }

  function handleStartRename(file: FileItem) {
    setRenameId(file.id);
    setRenameValue(file.name);
    setActiveMenu(null);
  }

  async function handleConfirmRename() {
    if (!renameId || !renameValue.trim()) { setRenameId(null); return; }
    await renameFile(renameId, renameValue.trim());
    toast('이름이 변경되었습니다.', 'success');
    setRenameId(null);
  }

  async function handleDelete(file: FileItem) {
    await deleteFile(file.id);
    toast(`"${file.name}"이 삭제되었습니다.`, 'info');
    setActiveMenu(null);
  }

  const iconMap: Record<string, React.ElementType> = {
    folder: Folder, file: FileText, archive: Archive, film: Film, image: FileText,
  };

  return (
    <div className="max-w-[1600px] mx-auto">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight font-headline text-on-surface mb-2">팀 스토리지</h2>
          <p className="text-on-surface-variant">워크스페이스 에셋과 협업 파일을 관리하세요.</p>
        </div>
        <div className="flex gap-3 items-center">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="파일 검색..."
              className="bg-surface-container-highest rounded-xl py-2.5 pl-10 pr-4 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-low transition-all placeholder:text-on-surface-variant/40 w-48"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setFolderModal(true)}
            className="flex items-center gap-2 bg-surface-container-highest text-primary font-bold px-5 py-2.5 rounded-xl hover:bg-surface-bright transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">새 폴더</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-gradient-to-tr from-primary to-secondary text-surface font-bold px-5 py-2.5 rounded-xl hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/10"
          >
            <CloudUpload className="w-4 h-4" />
            <span className="text-sm">업로드</span>
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
        </div>
      </header>

      {/* Connected storage sources */}
      {connections.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">연결된 스토리지</h3>
            <button onClick={() => navigate('/settings')} className="text-xs text-primary hover:text-secondary transition-colors flex items-center gap-1">
              <Settings className="w-3 h-3" /> 스토리지 설정
            </button>
          </div>
          <div className="flex gap-3 flex-wrap">
            {/* Workspace chip (no storageId) */}
            <button
              onClick={() => setActiveStorageId(null)}
              className={cn(
                'flex items-center gap-2 rounded-xl px-4 py-2.5 transition-all',
                activeStorageId === null
                  ? 'bg-primary/15 ring-1 ring-primary/40'
                  : 'bg-surface-container hover:bg-surface-bright'
              )}
            >
              <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
                <HardDrive className="w-3.5 h-3.5" />
              </div>
              <span className="text-sm font-medium text-on-surface">워크스페이스</span>
              {activeStorageId === null && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">선택됨</span>}
            </button>
            {connections.filter(conn =>
              conn.sharing === 'all' || !conn.sharing || conn.ownerId === user?.id
            ).map((conn) => {
              const connIconMap = { 'google-drive': Cloud, nas: Database, local: HardDrive };
              const colorMap = { 'google-drive': 'text-primary bg-primary/10', nas: 'text-secondary bg-secondary/10', local: 'text-tertiary bg-tertiary/10' };
              const Icon = connIconMap[conn.type];
              const isActive = activeStorageId === conn.id;
              return (
                <button
                  key={conn.id}
                  onClick={() => setActiveStorageId(conn.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-4 py-2.5 transition-all',
                    isActive
                      ? 'bg-primary/15 ring-1 ring-primary/40'
                      : 'bg-surface-container hover:bg-surface-bright'
                  )}
                >
                  <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center', colorMap[conn.type])}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-medium text-on-surface">{conn.label}</span>
                  {isActive
                    ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">선택됨</span>
                    : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary">연결됨</span>
                  }
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-surface-container rounded-xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Database className="w-24 h-24 text-primary" />
          </div>
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">사용 스토리지</p>
          <h3 className="text-2xl font-bold font-headline mb-4">
            {fmtDisplaySize(displayUsed)} <span className="text-sm font-normal text-on-surface-variant">/ {fmtDisplaySize(displayTotal)}</span>
          </h3>
          <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-secondary transition-all" style={{ width: `${storagePercent}%` }} />
          </div>
        </div>
        <div className="bg-surface-container rounded-xl p-6 flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">전체 파일</p>
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-2xl font-bold font-headline">{storageFiles.length}</span>
              <span className="text-sm text-on-surface-variant">개의 파일</span>
            </div>
          </div>
          <p className="text-[0.7rem] text-on-surface-variant mt-4">
            {scannedFiles !== null
              ? `${storageFiles.filter(f => f.date === new Date().toISOString().split('T')[0]).length}개 오늘 수정됨`
              : `${storageFiles.filter(f => f.date === '방금').length}개 최근 추가됨`}
          </p>
        </div>
        <div className="bg-surface-container rounded-xl p-6 flex items-center gap-6">
          <div className="flex -space-x-3">
            {[1, 2].map((i) => (
              <div key={i} className="w-10 h-10 rounded-full border-2 border-surface-container bg-gradient-to-br from-primary/40 to-secondary/40 flex items-center justify-center text-xs font-bold">
                {['JK', 'SJ'][i - 1]}
              </div>
            ))}
            <div className="w-10 h-10 rounded-full border-2 border-surface-container bg-surface-container-highest flex items-center justify-center text-xs font-bold text-primary">+4</div>
          </div>
          <div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">활성 협업자</p>
            <p className="text-sm text-on-surface mt-1">6명과 공유 중</p>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-on-surface-variant mb-6 flex-wrap">
        {dirStack.length > 0 && (
          <button
            onClick={goBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-highest hover:bg-surface-bright text-on-surface-variant hover:text-on-surface transition-all text-xs font-bold mr-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> 뒤로
          </button>
        )}
        <button onClick={() => setActiveStorageId(null)} className="hover:text-primary transition-colors">
          워크스페이스
        </button>
        {activeConn && (
          <>
            <ChevronRight className="w-4 h-4 shrink-0" />
            <button
              onClick={() => { setCurrentDirPath(null); setDirStack([]); setSearchQuery(''); }}
              className={cn('hover:text-primary transition-colors', !currentDirPath && 'text-on-surface font-semibold')}
            >
              {activeConn.label}
            </button>
            {breadcrumbSegments.map((seg, i) => (
              <React.Fragment key={seg.dirPath}>
                <ChevronRight className="w-4 h-4 shrink-0" />
                <button
                  onClick={() => {
                    setCurrentDirPath(seg.dirPath === rootPath ? null : seg.dirPath);
                    setDirStack(dirStack.slice(0, i + 1));
                    setSearchQuery('');
                  }}
                  className={cn('hover:text-primary transition-colors', i === breadcrumbSegments.length - 1 && 'text-on-surface font-semibold')}
                >
                  {seg.label}
                </button>
              </React.Fragment>
            ))}
          </>
        )}
        {!activeConn && (
          <>
            <ChevronRight className="w-4 h-4 shrink-0" />
            <span className="text-on-surface-variant">파일</span>
          </>
        )}
      </div>

      {/* File table */}
      <div className="bg-surface-container rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-outline-variant/10 text-[0.75rem] font-bold text-on-surface-variant uppercase tracking-widest">
          <div className="col-span-6">이름</div>
          <div className="col-span-2">유형</div>
          <div className="col-span-2">크기</div>
          <div className="col-span-2 text-right">수정일</div>
        </div>

        {scanLoading && (
          <div className="py-16 flex flex-col items-center text-on-surface-variant/40">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-3" />
            <p className="text-sm">파일 목록 불러오는 중...</p>
          </div>
        )}
        {scanError && !scanLoading && (
          <div className="py-16 flex flex-col items-center text-error/60">
            <Search className="w-8 h-8 mb-3" />
            <p className="text-sm">{scanError}</p>
          </div>
        )}
        {!scanLoading && !scanError && filteredFiles.length === 0 && (
          <div className="py-16 flex flex-col items-center text-on-surface-variant/40">
            <Search className="w-8 h-8 mb-3" />
            {searchQuery
              ? <p className="text-sm">"{searchQuery}"에 대한 파일이 없습니다.</p>
              : <p className="text-sm">이 스토리지에 파일이 없습니다.</p>
            }
          </div>
        )}

        <div className="divide-y divide-outline-variant/5">
          {!scanLoading && !scanError && filteredFiles.map((file) => {
            const Icon = iconMap[file.iconType] ?? FileText;
            const colorClasses: Record<string, string> = {
              primary: 'bg-primary/10 text-primary', secondary: 'bg-secondary/10 text-secondary',
              tertiary: 'bg-tertiary/10 text-tertiary', error: 'bg-error/10 text-error',
            };

            return (
              <div
                key={file.id}
                className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-surface-bright/50 group transition-all cursor-pointer relative"
                onClick={() => {
                  if (activeMenu === file.id || renameId === file.id) return;
                  if ((file as any).isDir) { enterFolder(file); return; }
                  setPreviewFile(file);
                }}
              >
                <div className="col-span-6 flex items-center gap-4">
                  {file.image ? (
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-surface-container-highest shrink-0">
                      <img className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" src={file.image} referrerPolicy="no-referrer" />
                    </div>
                  ) : (
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform', file.color ? colorClasses[file.color] : 'bg-surface-container-highest text-on-surface-variant')}>
                      <Icon className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    {renameId === file.id ? (
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmRename(); if (e.key === 'Escape') setRenameId(null); }}
                          className="bg-surface-container-highest rounded-lg px-2 py-1 text-sm border-none focus:outline-none focus:ring-1 focus:ring-primary/30 w-48"
                        />
                        <button onClick={handleConfirmRename} className="text-primary hover:text-secondary transition-colors"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setRenameId(null)} className="text-on-surface-variant hover:text-on-surface transition-colors"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <>
                        <span className="font-semibold text-on-surface block leading-none truncate">{file.name}</span>
                        {file.subtitle && <span className="text-[0.7rem] text-on-surface-variant mt-1 block">{file.subtitle}</span>}
                      </>
                    )}
                  </div>
                </div>
                <div className="col-span-2 text-on-surface-variant text-sm">{file.type}</div>
                <div className="col-span-2 text-on-surface-variant text-sm">{file.size}</div>
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <span className="text-on-surface-variant text-sm">{file.date}</span>
                  {/* Action menu */}
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setActiveMenu(activeMenu === file.id ? null : file.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-bright transition-all"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {activeMenu === file.id && (
                      <div className="absolute right-0 top-full mt-1 w-40 bg-surface-container-highest/90 backdrop-blur-xl rounded-xl border border-white/5 shadow-[0_8px_24px_rgba(0,0,0,0.4)] overflow-hidden z-50">
                        {!(file as any).isDir && (
                        <button onClick={(e) => {
                          e.stopPropagation();
                          if ((file as any).fullPath) {
                            const a = document.createElement('a');
                            a.href = `/api/data/storage/download?filePath=${encodeURIComponent((file as any).fullPath)}`;
                            a.download = file.name;
                            a.click();
                          } else if (file.image) {
                            const a = document.createElement('a');
                            a.href = file.image;
                            a.download = file.name;
                            a.click();
                          } else {
                            toast(`"${file.name}" 다운로드를 시작합니다.`, 'info');
                          }
                          setActiveMenu(null);
                        }}
                          className="w-full px-4 py-2.5 text-left text-sm text-on-surface-variant hover:bg-white/5 hover:text-on-surface transition-colors flex items-center gap-2">
                          <Download className="w-3.5 h-3.5" /> 다운로드
                        </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); setPreviewFile(file); setActiveMenu(null); }}
                          className="w-full px-4 py-2.5 text-left text-sm text-on-surface-variant hover:bg-white/5 hover:text-on-surface transition-colors flex items-center gap-2">
                          <Eye className="w-3.5 h-3.5" /> 미리보기
                        </button>
                        <button onClick={() => handleStartRename(file)}
                          className="w-full px-4 py-2.5 text-left text-sm text-on-surface-variant hover:bg-white/5 hover:text-on-surface transition-colors flex items-center gap-2">
                          <Edit2 className="w-3.5 h-3.5" /> 이름 변경
                        </button>
                        <button onClick={() => handleDelete(file)}
                          className="w-full px-4 py-2.5 text-left text-sm text-error hover:bg-error/10 transition-colors flex items-center gap-2">
                          <Trash2 className="w-3.5 h-3.5" /> 삭제
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'mt-8 border-2 border-dashed rounded-2xl py-12 flex flex-col items-center justify-center transition-all cursor-pointer',
          dragOver
            ? 'border-primary/60 bg-primary/5 text-primary'
            : 'border-outline-variant/20 text-on-surface-variant/40 hover:text-primary/40 hover:border-primary/20'
        )}
      >
        <CloudUpload className="w-10 h-10 mb-3" />
        <p className="text-sm font-medium">{dragOver ? '놓아서 업로드' : '파일을 드래그하거나 클릭하여 업로드'}</p>
      </div>

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setPreviewFile(null)}>
          <div className="bg-surface-container-highest/95 backdrop-blur-xl rounded-2xl border border-white/5 shadow-[0_24px_64px_rgba(0,0,0,0.7)] w-full max-w-3xl mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-on-surface text-sm truncate">{previewFile.name}</p>
                  <p className="text-xs text-on-surface-variant">{previewFile.type} · {previewFile.size}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    if (previewFile.image) {
                      const a = document.createElement('a');
                      a.href = previewFile.image;
                      a.download = previewFile.name;
                      a.click();
                    } else {
                      toast(`"${previewFile.name}" 다운로드를 시작합니다.`, 'info');
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-bold"
                >
                  <Download className="w-3.5 h-3.5" /> 다운로드
                </button>
                <button onClick={() => setPreviewFile(null)} className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Preview content */}
            <div className="p-6 min-h-[300px] flex items-center justify-center">
              {previewFile.image ? (
                <img src={previewFile.image} alt={previewFile.name} className="max-w-full max-h-[60vh] rounded-xl object-contain" referrerPolicy="no-referrer" />
              ) : previewFile.iconType === 'film' ? (
                <div className="flex flex-col items-center gap-4 text-on-surface-variant">
                  <Film className="w-16 h-16 opacity-40" />
                  <p className="text-sm">동영상 미리보기는 지원되지 않습니다.</p>
                </div>
              ) : previewFile.iconType === 'archive' ? (
                <div className="flex flex-col items-center gap-4 text-on-surface-variant">
                  <Archive className="w-16 h-16 opacity-40" />
                  <p className="text-sm">압축 파일은 웹에서 미리볼 수 없습니다.</p>
                </div>
              ) : previewFile.iconType === 'folder' ? (
                <div className="flex flex-col items-center gap-4 text-on-surface-variant">
                  <Folder className="w-16 h-16 opacity-40" />
                  <p className="text-sm">폴더입니다.</p>
                </div>
              ) : (
                <div className="w-full">
                  <div className="bg-surface-container rounded-xl p-6 text-on-surface-variant text-sm font-mono whitespace-pre-wrap">
                    {previewFile.subtitle || `${previewFile.name}\n\n파일 내용 미리보기가 지원되지 않습니다.\n다운로드하여 확인하세요.`}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-3 border-t border-white/5 flex items-center justify-between">
              <p className="text-xs text-on-surface-variant">수정일: {previewFile.date}</p>
              {previewFile.image && (
                <a href={previewFile.image} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:text-secondary transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" /> 새 탭에서 열기
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      <Modal open={folderModal} onClose={() => setFolderModal(false)} title="새 폴더 만들기" size="sm">
        <div className="space-y-4">
          <input
            autoFocus
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            placeholder="폴더 이름"
            className="w-full bg-surface-container-highest rounded-xl py-3 px-4 text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-low transition-all placeholder:text-on-surface-variant/40"
          />
          <div className="flex justify-end gap-3">
            <button onClick={() => setFolderModal(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-white/5 transition-all">취소</button>
            <button
              onClick={handleCreateFolder}
              disabled={!folderName.trim()}
              className="px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-primary to-secondary text-surface shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-40"
            >
              만들기
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
