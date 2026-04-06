import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Rocket, User, Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const passwordStrength = () => {
    if (password.length === 0) return 0;
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const strength = passwordStrength();
  const strengthLabel = ['', '취약', '보통', '강함', '매우 강함'][strength];
  const strengthColor = ['', 'bg-error', 'bg-tertiary', 'bg-primary', 'bg-green-400'][strength];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }
    setIsLoading(true);
    const result = await register(name, email, password);
    setIsLoading(false);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || '회원가입에 실패했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center relative overflow-hidden py-12">
      {/* Atmospheric background glows */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 mb-4">
            <Rocket className="w-7 h-7 text-surface fill-current" />
          </div>
          <h1 className="text-2xl font-extrabold font-headline tracking-tighter text-white">Kinetic</h1>
          <p className="text-on-surface-variant text-sm mt-1">지금 바로 팀 워크스페이스를 시작하세요</p>
        </div>

        {/* Glass card */}
        <div className="bg-surface-container-highest/70 backdrop-blur-[20px] rounded-2xl p-8 border border-white/5 shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
          <h2 className="font-headline font-bold text-xl mb-1">회원가입</h2>
          <p className="text-on-surface-variant text-sm mb-8">무료 계정을 만들어 팀과 함께 시작하세요.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">이름</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="홍길동"
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
                  placeholder="최소 6자 이상"
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
              {password.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-1 flex-1 rounded-full transition-all duration-300",
                          i <= strength ? strengthColor : 'bg-surface-container-highest'
                        )}
                      />
                    ))}
                  </div>
                  <p className={cn("text-[10px] font-bold", strength >= 3 ? 'text-primary' : 'text-on-surface-variant')}>
                    비밀번호 강도: {strengthLabel}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">비밀번호 확인</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="비밀번호 재입력"
                  className={cn(
                    "w-full bg-surface-container-highest rounded-xl py-[1.2rem] pl-11 pr-12 text-sm",
                    "border-none focus:outline-none focus:ring-2 focus:ring-primary/20",
                    "placeholder:text-on-surface-variant/40 transition-all",
                    "focus:bg-surface-container-low focus:shadow-[0_0_0_4px_rgba(151,169,255,0.08)]"
                  )}
                />
                {confirmPassword.length > 0 && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {confirmPassword === password ? (
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-error" />
                    )}
                  </div>
                )}
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
                  <span>시작하기</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-on-surface-variant text-sm">
              이미 계정이 있으신가요?{' '}
              <Link to="/login" className="text-primary font-bold hover:text-secondary transition-colors">
                로그인
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
