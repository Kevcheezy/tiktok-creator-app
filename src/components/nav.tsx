import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { APP_VERSION, GIT_COMMIT } from '@/lib/version';

export async function Nav() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <nav className="glass sticky top-0 z-50 border-b border-border">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Brand */}
          <Link href="/" className="group flex items-center gap-3">
            {/* Logo mark */}
            <div className="relative flex h-9 w-9 items-center justify-center">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-electric to-magenta opacity-80 transition-opacity group-hover:opacity-100" />
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="relative z-10 h-5 w-5"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-text-primary">
              TikTok<span className="text-electric">Creator</span>
            </span>
          </Link>
          <span
            title={`commit ${GIT_COMMIT}`}
            className="font-[family-name:var(--font-mono)] text-[10px] leading-none text-text-muted/60 select-none"
          >
            v{APP_VERSION}
          </span>

          {/* Right side */}
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="font-[family-name:var(--font-display)] text-sm font-medium text-text-secondary transition-colors hover:text-electric"
            >
              Dashboard
            </Link>
            <Link
              href="/products"
              className="font-[family-name:var(--font-display)] text-sm font-medium text-text-secondary transition-colors hover:text-electric"
            >
              Products
            </Link>
            <Link
              href="/influencers"
              className="font-[family-name:var(--font-display)] text-sm font-medium text-text-secondary transition-colors hover:text-electric"
            >
              Influencers
            </Link>
            <Link
              href="/projects/new"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-lg bg-electric px-4 py-2 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:bg-electric/90 hover:shadow-[0_0_24px_rgba(0,240,255,0.3)]"
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                className="h-4 w-4"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              >
                <line x1="8" y1="3" x2="8" y2="13" />
                <line x1="3" y1="8" x2="13" y2="8" />
              </svg>
              New Project
            </Link>

            {/* User menu */}
            {user && (
              <>
                <div className="h-5 w-px bg-border" />
                <span className="text-sm text-text-muted truncate max-w-[160px]">
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
      </div>
    </nav>
  );
}
