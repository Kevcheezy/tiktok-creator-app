# Backend Developer Skill Design

**Date:** 2026-02-15
**Status:** Approved

## Overview

A mandatory skill that acts as the backend engineering gate for the MONEY PRINTER 3000. Mirrors the `frontend-designer` skill but for all non-`.tsx` backend files. Enforces the superpowers workflow (brainstorm, plan, execute) and senior-level engineering principles.

## Scope

**In-scope files (triggers skill):**
- `src/app/api/**/*.ts` — API route handlers
- `src/agents/**/*.ts` — AI agent classes
- `src/workers/**/*.ts` — BullMQ pipeline worker
- `src/lib/**/*.ts` — Utilities, queue config, API clients, constants
- `src/db/**/*.ts` — Schema, seed, database index
- `src/middleware.ts` — Auth/request middleware
- Database migrations via Supabase MCP

**Out-of-scope (handled by frontend-designer):**
- `src/components/**/*.tsx`
- `src/app/**/page.tsx`, `src/app/layout.tsx`
- `globals.css`, Tailwind config

## Workflow

1. **UNDERSTAND** — Read relevant existing backend code, understand the request
2. **BRAINSTORM** — Invoke `superpowers:brainstorming` to explore approaches
3. **PLAN** — Invoke `superpowers:writing-plans` to create implementation plan
4. **EXECUTE** — Invoke `superpowers:executing-plans` with TDD
5. **VERIFY** — Invoke `superpowers:verification-before-completion`

Each step is a hard gate — no skipping.

## Engineering Principles (Hard Rules)

### Error Handling & Resilience
- All external API calls must have try/catch with structured error responses
- Queue jobs must handle failure gracefully (log error, update status to 'failed', set error_message)
- API routes must return proper HTTP status codes
- Retry logic for transient failures on external APIs

### Security & Validation
- All API route inputs validated before processing
- Auth checks on protected routes
- Never expose service role keys or internal errors to client
- Parameterized queries only

### Testing
- Every backend change must include or update tests
- TDD workflow enforced
- Test API routes with expected inputs AND error cases
- Test agent pipeline steps in isolation

### API Design
- Consistent response shapes across all endpoints
- Proper HTTP methods
- Meaningful error messages in responses
- Follow existing endpoint patterns

## CLAUDE.md Integration

New rule added:
```
## Backend Development Rule
ALL backend changes MUST use the `backend-developer` skill.
```

## Location

`tiktok-creator-app/.claude/skills/backend-developer/SKILL.md`
