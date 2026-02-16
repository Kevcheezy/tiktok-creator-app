# Supabase Auth — Middleware Gate Design

## Goal

Add email/password authentication to the MONEY PRINTER 3000 using Supabase Auth. Unauthenticated users are redirected to a login page. All data remains shared across authenticated users (no per-user isolation yet).

## Approach

**Middleware-only gate.** A Next.js middleware checks for a valid Supabase session on every request. If no session, redirect to `/login`. Existing API routes and database access stay unchanged — the service role client continues to be used for all backend operations.

## Architecture

```
Browser → middleware.ts (check session, refresh token)
  ├─ Has session → pass through to page/API
  └─ No session → redirect to /login

/login page → email/password via Supabase Auth
  → session cookie set automatically
  → redirect to dashboard
```

## Auth Method

- Email + password (sign up and sign in)
- Google OAuth deferred to later

## New Files

| File | Purpose |
|------|---------|
| `src/lib/supabase/client.ts` | Browser Supabase client (`createBrowserClient` from `@supabase/ssr`) |
| `src/lib/supabase/server.ts` | Server Supabase client (`createServerClient` with cookie handling) |
| `src/middleware.ts` | Token refresh + redirect unauthenticated users |
| `src/app/login/page.tsx` | Login/signup page |
| `src/app/auth/callback/route.ts` | Auth callback (code exchange) |
| `src/app/auth/signout/route.ts` | Sign-out endpoint |

## Modified Files

| File | Change |
|------|--------|
| `src/components/nav.tsx` | User email display + logout button |
| `package.json` | Add `@supabase/ssr` |

## No Changes To

- `src/db/index.ts` — service role client stays as-is
- API routes — no auth checks added (middleware handles gating)
- Database schema — no user_id columns (data is shared)
- Worker process — continues using service role key
- RLS policies — none needed (service role bypasses RLS)

## Middleware Logic

1. Match all routes except: `/login`, `/auth/*`, `_next/*`, static files
2. Create server Supabase client with request cookies
3. Call `supabase.auth.getUser()` to validate + refresh token
4. No user → redirect to `/login`
5. Pass through with updated response cookies

## Login Page UX

- Dark cinematic design matching app aesthetic
- Toggle between Sign In and Sign Up modes
- Email + password fields
- Error display for invalid credentials
- Redirect to `/` on success

## Supabase Dashboard Config

- Email provider enabled (default)
- Site URL: `http://localhost:3000`
- Redirect URL: `http://localhost:3000/auth/callback`
