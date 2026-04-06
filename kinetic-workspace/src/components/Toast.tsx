import React from 'react';
import { CheckCircle2, XCircle, Info, Sparkles, X } from 'lucide-react';
import { useToast, ToastItem } from '../contexts/ToastContext';
import { cn } from '../lib/utils';

const config = {
  success: { icon: CheckCircle2, color: 'text-primary', bg: 'bg-primary/10 border-primary/20' },
  error:   { icon: XCircle,      color: 'text-error',   bg: 'bg-error/10 border-error/20' },
  info:    { icon: Info,         color: 'text-on-surface-variant', bg: 'bg-surface-container-highest border-white/10' },
  delight: { icon: Sparkles,     color: 'text-tertiary', bg: 'bg-tertiary/10 border-tertiary/20' },
};

function ToastCard({ toast }: { toast: ToastItem; key?: React.Key }) {
  const { dismiss } = useToast();
  const { icon: Icon, color, bg } = config[toast.type];

  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-3 rounded-xl border shadow-[0_8px_24px_rgba(0,0,0,0.4)]',
      'backdrop-blur-[20px] min-w-[280px] max-w-[380px]',
      'animate-[slideIn_0.25s_ease-out]',
      bg
    )}>
      <Icon className={cn('w-4 h-4 shrink-0', color)} />
      <p className="text-sm font-medium text-on-surface flex-1">{toast.message}</p>
      <button onClick={() => dismiss(toast.id)} className="text-on-surface-variant hover:text-on-surface transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useToast();
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 items-end">
      {toasts.map((t) => <ToastCard key={t.id} toast={t} />)}
    </div>
  );
}
