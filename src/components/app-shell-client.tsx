'use client';

import { useState, useEffect, useCallback } from 'react';
import { TopBar } from './top-bar';
import { SidebarNav } from './sidebar-nav';

const STORAGE_KEY = 'sidebar-collapsed';

interface AppShellClientProps {
  user: { email: string } | null;
  children: React.ReactNode;
}

export function AppShellClient({ user, children }: AppShellClientProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Hydrate collapsed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') setCollapsed(true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const toggleMobile = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Top bar — full width */}
      <TopBar user={user} onMenuToggle={toggleMobile} />

      {/* Body: sidebar + content */}
      <div className="flex">
        {/* Desktop sidebar */}
        <aside
          className={`sticky top-16 hidden h-[calc(100vh-4rem)] flex-col border-r border-border bg-[rgba(18,18,26,0.7)] backdrop-blur-xl transition-all duration-300 lg:flex ${
            collapsed ? 'w-[60px]' : 'w-[220px]'
          }`}
        >
          <SidebarNav collapsed={collapsed} onToggle={toggleCollapsed} />
        </aside>

        {/* Mobile sidebar overlay */}
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            {/* Slide-in sidebar */}
            <aside className="fixed inset-y-16 left-0 z-50 flex w-[220px] flex-col border-r border-border bg-[rgba(18,18,26,0.95)] backdrop-blur-xl lg:hidden">
              <SidebarNav collapsed={false} onToggle={() => setMobileOpen(false)} />
            </aside>
          </>
        )}

        {/* Main content */}
        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
