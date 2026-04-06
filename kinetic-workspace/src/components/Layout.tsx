import React from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col md:ml-20 xl:ml-64 transition-all duration-300">
        <TopBar />
        <main className="flex-1 overflow-y-auto pt-24 pb-12 px-6 lg:px-10 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}
