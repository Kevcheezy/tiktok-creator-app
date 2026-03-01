'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarNavProps {
  collapsed: boolean;
  onToggle: () => void;
}

const NAV_LINKS = [
  {
    href: '/',
    label: 'Dashboard',
    color: 'bg-electric',
    delay: '0s',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
        <path d="M3 4a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm8 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V4zM3 12a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4zm8 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
      </svg>
    ),
  },
  {
    href: '/products',
    label: 'Products',
    color: 'bg-summon',
    delay: '0.3s',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
        <path d="M4 3a2 2 0 00-2 2v2a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm0 6a2 2 0 00-2 2v2a2 2 0 002 2h12a2 2 0 002-2v-2a2 2 0 00-2-2H4z" />
      </svg>
    ),
  },
  {
    href: '/influencers',
    label: 'Influencers',
    color: 'bg-phoenix',
    delay: '0.6s',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.97 5.97 0 00-.94-3.21A3.001 3.001 0 0119 17v1h-3zM4.94 13.79A5.97 5.97 0 004 17v1H1v-1a3 3 0 013.94-2.21z" />
      </svg>
    ),
  },
  {
    href: '/presets',
    label: 'Presets',
    color: 'bg-summon',
    delay: '0.9s',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ),
  },
  {
    href: '/roadmap',
    label: 'Roadmap',
    color: 'bg-gil',
    delay: '1.2s',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
        <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    href: '/analytics',
    label: 'Analytics',
    color: 'bg-magenta',
    delay: '1.5s',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
      </svg>
    ),
  },
];

export function SidebarNav({ collapsed, onToggle }: SidebarNavProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Nav links */}
      <nav className="flex flex-1 flex-col gap-1 px-2 pt-4">
        {NAV_LINKS.map((link) => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              title={collapsed ? link.label : undefined}
              className={`group relative flex items-center gap-3 rounded-lg transition-all ${
                collapsed ? 'justify-center px-0 py-3' : 'px-4 py-3'
              } ${
                active
                  ? 'border-l-2 border-electric bg-electric/5 text-text-primary'
                  : 'border-l-2 border-transparent text-text-muted hover:bg-surface-raised/50 hover:text-text-secondary'
              }`}
            >
              {/* Icon */}
              <span className={`flex-shrink-0 ${active ? 'text-electric' : 'text-text-muted group-hover:text-text-secondary'}`}>
                {link.icon}
              </span>

              {/* Materia dot */}
              <span
                className={`absolute ${collapsed ? 'right-1.5 top-1.5' : 'left-1.5 top-1/2 -translate-y-1/2'} inline-block h-1.5 w-1.5 rounded-full ${link.color} opacity-60 animate-materia-pulse`}
                style={{ animationDelay: link.delay }}
              />

              {/* Label */}
              {!collapsed && (
                <span className="font-[family-name:var(--font-display)] text-sm font-medium whitespace-nowrap">
                  {link.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Version */}
      <div className={`border-t border-border px-3 py-2 ${collapsed ? 'text-center' : ''}`}>
        <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-primary">
          {collapsed
            ? (process.env.NEXT_PUBLIC_GIT_COMMIT || 'dev').slice(0, 7)
            : `v${process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0'}-${(process.env.NEXT_PUBLIC_GIT_COMMIT || 'dev').slice(0, 7)}`
          }
        </span>
      </div>

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-center border-t border-border py-3 text-text-muted transition-colors hover:text-text-secondary"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
        >
          <path
            fillRule="evenodd"
            d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </>
  );
}
