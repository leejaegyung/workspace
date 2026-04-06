import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Rocket, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const result = await login(email, password);
    setIsLoading(false);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || '로그인에 실패했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center relative overflow-hidden">
      {/* Atmospheric background glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[180px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 mb-4">
            <Rocket className="w-7 h-7 text-surface fill-current" />
          </div>
          <h1 className="text-2xl font-extrabold font-headline tracking-tighter text-white">Kinetic</h1>
          <p className="text-on-surface-variant text-sm mt-1">팀 워크스페이스에 오신 것을 환영합니다</p>
        </div>

        {/* Glass card */}
        <div className="bg-surface-container-highest/70 backdrop-blur-[20px] rounded-2xl p-8 border border-white/5 shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
          <h2 className="font-headline font-bold text-xl mb-1">로그인</h2>
          <p className="text-on-surface-variant text-sm mb-8">계정에 접속하여 팀과 협업하세요.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">이메일</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@company.com"
                  className={cn(
                    "w-full bg-surface-container-highest rounded-xl py-[1.2rem] pl-11 pr-4 text-sm",
                    "border-none focus:outline-none focus:ring-2 focus:ring-primary/20",
                    "placeholder:text-on-surface-variant/40 transition-all",
                    "focus:bg-surface-container-low focus:shadow-[0_0_0_4px_rgba(151,169,255,0.08)]"
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">비밀번호</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className={cn(
                    "w-full bg-surface-container-highest rounded-xl py-[1.2rem] pl-11 pr-12 text-sm",
                    "border-none focus:outline-none focus:ring-2 focus:ring-primary/20",
                    "placeholder:text-on-surface-variant/40 transition-all",
                    "focus:bg-surface-container-low focus:shadow-[0_0_0_4px_rgba(151,169,255,0.08)]"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-error/10 border border-error/20 rounded-xl px-4 py-3">
                <div className="w-1.5 h-1.5 rounded-full bg-error shrink-0" />
                <p className="text-error text-sm font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "w-full bg-gradient-to-r from-primary to-secondary text-surface font-bold py-3.5 rounded-xl",
                "flex items-center justify-center gap-2 shadow-lg shadow-primary/20",
                "hover:opacity-90 hover:scale-[1.01] active:scale-95 transition-all",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
              )}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-surface/30 border-t-surface rounded-full animate-spin" />
              ) : (
                <>
                  <span>로그인</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-on-surface-variant text-sm">
              계정이 없으신가요?{' '}
              <Link to="/register" className="text-primary font-bold hover:text-secondary transition-colors">
                회원가입
              </Link>
            </p>
          </div>
        </div>

        {/* Demo hint */}
        <p className="text-center text-on-surface-variant/40 text-xs mt-6">
          처음 방문하셨나요? 회원가입으로 무료로 시작하세요.
        </p>
      </div>
    </div>
  );
}
