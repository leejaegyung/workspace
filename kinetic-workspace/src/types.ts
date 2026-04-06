import React from 'react';
import { 
  LayoutGrid, 
  Trello, 
  MessageSquare, 
  FolderOpen, 
  Settings, 
  HelpCircle, 
  Rocket,
  Search,
  Bell,
  ChevronRight,
  Plus,
  Share2,
  Download,
  ExternalLink,
  Pin,
  Palette,
  FileText,
  Archive,
  Film,
  CloudUpload,
  MoreHorizontal,
  Edit2,
  CheckCircle2,
  Calendar,
  TrendingUp,
  Code,
  MessageCircle,
  Zap,
  Wand2,
  Cloud,
  Database,
  Edit,
  UserPlus,
  Info,
  Paperclip,
  Smile,
  AtSign,
  Bold,
  Italic,
  Send,
  Grid
} from 'lucide-react';

export type NavItem = {
  label: string;
  icon: React.ElementType;
  path: string;
  isActive?: boolean;
};

export const navItems: NavItem[] = [
  { label: '대시보드', icon: LayoutGrid, path: '/' },
  { label: '프로젝트', icon: Trello, path: '/projects' },
  { label: '개인 업무', icon: Grid, path: '/board' },
  { label: '채팅', icon: MessageSquare, path: '/chat' },
  { label: '스토리지', icon: FolderOpen, path: '/storage' },
];

export const bottomNavItems: NavItem[] = [
  { label: '설정', icon: Settings, path: '/settings' },
  { label: '지원', icon: HelpCircle, path: '/support' },
];
