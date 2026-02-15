# Supabase Auth — Middleware Gate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add email/password authentication as a middleware gate — unauthenticated users are redirected to `/login`, all data remains shared.

**Architecture:** Next.js middleware intercepts every request, validates the Supabase session cookie, and redirects to `/login` if no valid session. A browser-side Supabase client handles sign-in/sign-up, and a server-side client (with cookie plumbing) refreshes tokens in middleware. The existing service-role client (`src/db/index.ts`) is untouched — no RLS, no user_id columns, no DB changes.

**Tech Stack:** `@supabase/ssr`, Next.js 16 middleware, Supabase Auth (email provider)

**Design Doc:** `docs/plans/2026-02-15-supabase-auth-design.md`

---

### Task 1: Install `@supabase/ssr`

**Files:**
- Modify: `package.json`

**Step 1: Install the package**

Run:
```bash
npm install @supabase/ssr
```
Expected: `@supabase/ssr` added to `dependencies` in package.json.

**Step 2: Verify install**

Run: `npx tsc --noEmit`
Expected: No new errors.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @supabase/ssr for auth"
```

---

### Task 2: Create browser Supabase client

**Files:**
- Create: `src/lib/supabase/client.ts`

This client runs in the browser. It uses the **anon key** (not service role) and talks to Supabase Auth for sign-in/sign-up/sign-out. The `@supabase/ssr` package's `createBrowserClient` handles cookie-based session storage automatically.

**Step 1: Create the file**

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors. The env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` already exist in `.env.local`.

**Step 3: Commit**

```bash
git add src/lib/supabase/client.ts
git commit -m "feat(auth): add browser supabase client"
```

---

### Task 3: Create server Supabase client

**Files:**
- Create: `src/lib/supabase/server.ts`

This client runs on the server (middleware, server components, route handlers). It uses the anon key and manually plumbs cookies via `next/headers` so Supabase can read/write the session cookie.

**Important:** `cookies()` from `next/headers` is async in Next.js 15+. The `createServerClient` from `@supabase/ssr` requires a `cookies` option with `getAll` and `setAll` methods.

**Step 1: Create the file**

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll is called from Server Components where cookies can't be set.
            // This is fine — middleware will refresh the session before the page loads.
          }
        },
      },
    }
  );
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/supabase/server.ts
git commit -m "feat(auth): add server supabase client with cookie handling"
```

---

### Task 4: Create middleware

**Files:**
- Create: `src/middleware.ts`

The middleware runs on every request. It:
1. Creates a server Supabase client with request/response cookie plumbing
2. Calls `getUser()` to validate + refresh the session token
3. Redirects to `/login` if no valid session
4. Passes through with updated cookies if session is valid

**Important:** Middleware can NOT use `cookies()` from `next/headers`. It must read/write cookies from the `NextRequest`/`NextResponse` objects directly. This is different from the server client in Task 3.

**Step 1: Create the middleware**

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and getUser().
  // A simple mistake could make it very hard to debug issues with users being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public files (svg, png, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Manual test**

Run: `npm run dev`
Visit: `http://localhost:3000`
Expected: Redirected to `/login` (which will 404 until Task 5 — that's fine, the redirect itself proves middleware works).

**Step 4: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(auth): add middleware to gate unauthenticated users"
```

---

### Task 5: Create login page

**Files:**
- Create: `src/app/login/page.tsx`

**IMPORTANT:** This task touches `.tsx` files. You MUST use the `frontend-designer` skill per CLAUDE.md.

The login page:
- Dark cinematic design matching the app's void/electric/magenta aesthetic
- Toggle between "Sign In" and "Sign Up" modes
- Email + password fields
- Error display for invalid credentials
- Redirect to `/` on success
- Client component (uses `useState`, browser Supabase client)

**Step 1: Create the login page**

Create `src/app/login/page.tsx` as a `'use client'` component:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        // Supabase may require email confirmation depending on settings.
        // For dev, email confirmation is disabled by default.
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-void px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-electric to-magenta">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={2.5}>
              <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-text-primary">
            TikTok<span className="text-electric">Creator</span>
          </h1>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl border border-border p-8">
          <h2 className="mb-6 text-center font-[family-name:var(--font-display)] text-lg font-semibold text-text-primary">
            {isSignUp ? 'Create account' : 'Welcome back'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-text-secondary">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none transition-colors focus:border-electric focus:ring-1 focus:ring-electric"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-text-secondary">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none transition-colors focus:border-electric focus:ring-1 focus:ring-electric"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-electric px-4 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:bg-electric/90 hover:shadow-[0_0_24px_rgba(0,240,255,0.3)] disabled:opacity-50"
            >
              {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
              className="text-sm text-text-muted transition-colors hover:text-electric"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Manual test**

Run: `npm run dev`
Visit: `http://localhost:3000/login`
Expected: Login page renders with dark cinematic design, email/password fields, sign-in/sign-up toggle.

**Step 4: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat(auth): add login/signup page"
```

---

### Task 6: Create auth callback route

**Files:**
- Create: `src/app/auth/callback/route.ts`

This route handles the OAuth/email confirmation callback. When Supabase sends a user back after email verification, it includes a `code` query parameter. This route exchanges that code for a session.

For email/password with no email confirmation (dev mode), this route won't be hit often, but it's needed for production email confirmation flows.

**Step 1: Create the callback route**

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page if code exchange fails
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/auth/callback/route.ts
git commit -m "feat(auth): add auth callback route for code exchange"
```

---

### Task 7: Create sign-out route

**Files:**
- Create: `src/app/auth/signout/route.ts`

A server-side route that signs the user out and redirects to `/login`. Using a route handler (not client-side signOut) ensures cookies are cleared properly on the server.

**Step 1: Create the signout route**

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/login`, {
    status: 302,
  });
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/auth/signout/route.ts
git commit -m "feat(auth): add sign-out route"
```

---

### Task 8: Update nav with user email + logout button

**Files:**
- Modify: `src/components/nav.tsx`

**IMPORTANT:** This task touches `.tsx` files. You MUST use the `frontend-designer` skill per CLAUDE.md.

The nav needs to:
1. Become a **server component** (or accept user data as a prop)
2. Show the authenticated user's email
3. Show a logout button that POSTs to `/auth/signout`

Since the nav is rendered inside a layout that runs on every page, and the middleware already ensures there's always a valid session for non-login pages, we can fetch the user server-side.

**Approach:** Convert `Nav` to an async server component that reads the session and displays the user's email. The logout button uses a `<form>` that POSTs to `/auth/signout` (no JS needed for basic form submission).

**Step 1: Update nav.tsx**

Change the `Nav` component to an async server component:

```typescript
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export async function Nav() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <nav className="glass sticky top-0 z-50 border-b border-border">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Brand */}
          <Link href="/" className="group flex items-center gap-3">
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

          {/* Right side */}
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="font-[family-name:var(--font-display)] text-sm font-medium text-text-secondary transition-colors hover:text-electric"
            >
              Dashboard
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
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Manual test**

Run: `npm run dev`
1. Visit `http://localhost:3000` → should redirect to `/login`
2. Sign up with email/password → should redirect to dashboard
3. Dashboard nav should show your email and "Log out" button
4. Click "Log out" → should redirect to `/login`
5. Visit `http://localhost:3000` again → should redirect to `/login` (session cleared)

**Step 4: Commit**

```bash
git add src/components/nav.tsx
git commit -m "feat(auth): show user email and logout in nav"
```

---

## Supabase Dashboard Configuration

Before testing, verify these settings in the Supabase Dashboard (https://supabase.com/dashboard/project/yuiwwmkalyplhcwgwcap/auth):

1. **Authentication → Providers → Email**: Enabled (this is the default)
2. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: Add `http://localhost:3000/auth/callback`
3. **Authentication → Email Templates**: Leave defaults (or disable "Confirm email" for easier dev testing)

---

## Verification Checklist

| # | Test | Expected |
|---|------|----------|
| 1 | `npm run build` | Compiles cleanly |
| 2 | Visit `/` without session | Redirects to `/login` |
| 3 | Visit `/projects/new` without session | Redirects to `/login` |
| 4 | Visit `/api/projects` without session | Redirects to `/login` |
| 5 | Sign up on `/login` | Account created, redirect to `/` |
| 6 | Sign in on `/login` | Session established, redirect to `/` |
| 7 | Nav shows user email | Email displayed in nav bar |
| 8 | Click "Log out" | Session cleared, redirect to `/login` |
| 9 | Worker process unaffected | `npm run worker` still runs with service role key |
| 10 | Invalid credentials | Error message displayed on login page |
