'use client';

import Link from 'next/link';
import { APP_VERSION, GIT_COMMIT } from '@/lib/version';

interface TopBarProps {
  user: { email: string } | null;
  onMenuToggle: () => void;
}

export function TopBar({ user, onMenuToggle }: TopBarProps) {
  return (
    <header className="glass sticky top-0 z-50 border-b border-border">
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        {/* Left: hamburger (mobile) + Brand */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={onMenuToggle}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-raised hover:text-text-secondary lg:hidden"
            aria-label="Toggle navigation"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path
                fillRule="evenodd"
                d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {/* Brand */}
          <Link href="/" className="group flex items-center gap-3">
            {/* Buster Sword logo */}
            <div className="relative flex h-9 w-9 items-center justify-center">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-electric to-lime opacity-80 transition-opacity group-hover:opacity-100" />
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="relative z-10 h-5 w-5"
              >
                {/* Blade */}
                <rect x="10.5" y="2" width="3" height="14" rx="0.5" fill="currentColor" opacity="0.9" />
                {/* Guard */}
                <rect x="6" y="16" width="12" height="2.5" rx="0.5" fill="currentColor" />
                {/* Grip */}
                <rect x="10.5" y="18.5" width="3" height="4" rx="0.5" fill="currentColor" opacity="0.6" />
              </svg>
            </div>
            <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-text-primary">
              MONEY<span className="text-electric">PRINTER</span><span className="text-lime">3000</span>
            </span>
          </Link>

          {/* Version badge */}
          <span
            title={`commit ${GIT_COMMIT}`}
            className="hidden font-[family-name:var(--font-mono)] text-[10px] leading-none text-text-muted/60 select-none sm:inline"
          >
            v{APP_VERSION}
          </span>
        </div>

        {/* Right: New Project + User */}
        <div className="flex items-center gap-4">
          {/* Command-style New Project button */}
          <Link
            href="/projects/new"
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded border-2 border-electric bg-transparent px-4 py-2 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-electric transition-all hover:bg-electric/10 hover:shadow-[0_0_24px_rgba(0,229,160,0.2)]"
          >
            <svg viewBox="0 0 8 10" fill="currentColor" className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity animate-command-cursor">
              <polygon points="0,0 8,5 0,10" />
            </svg>
            New Project
          </Link>

          {/* User menu */}
          {user && (
            <>
              <div className="h-5 w-px bg-border" />
              <span className="hidden text-sm text-text-muted truncate max-w-[160px] sm:inline">
                {user.email}
              </span>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="font-[family-name:var(--font-display)] text-sm font-medium text-text-muted transition-colors hover:text-magenta"
                >
                  Log out
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
