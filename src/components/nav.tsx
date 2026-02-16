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
          <span
            title={`commit ${GIT_COMMIT}`}
            className="font-[family-name:var(--font-mono)] text-[10px] leading-none text-text-muted/60 select-none"
          >
            v{APP_VERSION}
          </span>

          {/* Right side */}
          <div className="flex items-center gap-6">
            {/* Nav links with Materia dots */}
            <Link
              href="/"
              className="group flex items-center gap-2 font-[family-name:var(--font-display)] text-sm font-medium text-text-secondary transition-colors hover:text-electric"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-electric opacity-60 transition-opacity group-hover:opacity-100 animate-materia-pulse" />
              Dashboard
            </Link>
            <Link
              href="/products"
              className="group flex items-center gap-2 font-[family-name:var(--font-display)] text-sm font-medium text-text-secondary transition-colors hover:text-electric"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-summon opacity-60 transition-opacity group-hover:opacity-100 animate-materia-pulse" style={{ animationDelay: '0.3s' }} />
              Products
            </Link>
            <Link
              href="/influencers"
              className="group flex items-center gap-2 font-[family-name:var(--font-display)] text-sm font-medium text-text-secondary transition-colors hover:text-electric"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-phoenix opacity-60 transition-opacity group-hover:opacity-100 animate-materia-pulse" style={{ animationDelay: '0.6s' }} />
              Influencers
            </Link>

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
