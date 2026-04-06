import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Rocket } from 'lucide-react';
import { navItems, bottomNavItems } from '../types';
import { cn } from '../lib/utils';

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="h-screen w-20 xl:w-64 fixed left-0 top-0 z-40 bg-[#0e0e0e] flex flex-col py-6 border-r border-white/5 hidden md:flex transition-all duration-300">
      <div className="px-6 mb-10 flex items-center gap-3">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
          <Rocket className="w-6 h-6 text-surface fill-current" />
        </div>
        <h1 className="text-xl font-bold tracking-tighter text-white font-headline hidden xl:block">Kinetic</h1>
      </div>
      <nav className="flex-1 space-y-2 px-3">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.label}
              to={item.path}
              className={cn(
                "group px-4 py-3 rounded-xl flex items-center gap-3 transition-all",
                isActive 
                  ? "text-primary bg-primary/10 border-l-2 border-secondary" 
                  : "text-on-surface-variant hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive && "fill-primary/20")} />
              <span className="font-medium text-sm hidden xl:block">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      
      <div className="mt-auto px-3 space-y-2">
        <div className="px-4 py-6 mb-4 xl:block hidden">
          <div className="bg-gradient-to-br from-primary/20 to-secondary/20 p-4 rounded-xl border border-white/5">
            <p className="text-xs font-bold text-primary uppercase mb-1">프로 플랜</p>
            <p className="text-[11px] text-on-surface-variant mb-3">스토리지 75% 사용 중</p>
            <div className="h-1 bg-surface-container rounded-full overflow-hidden">
              <div className="h-full bg-primary w-3/4"></div>
            </div>
          </div>
        </div>
        {bottomNavItems.map((item) => (
          <Link
            key={item.label}
            to={item.path}
            className="text-on-surface-variant px-4 py-3 rounded-xl flex items-center gap-3 hover:bg-white/5 hover:text-white transition-all"
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium text-sm hidden xl:block">{item.label}</span>
          </Link>
        ))}
      </div>
    </aside>
  );
}
