# Frontend Designer Agent — Design Doc

## Problem
The TikTok Creator App needs a consistent, high-quality frontend across all phases. Without a dedicated design agent, frontend work risks producing generic, inconsistent UI. The `frontend-design` Claude Code plugin provides aesthetic guidelines but needs project-specific context to be effective.

## Solution
A project-level Claude Code skill at `.claude/skills/frontend-designer/SKILL.md` that acts as the mandatory gateway for all frontend changes.

## How It Works

1. **Invocation**: Any Claude Code session working on this project that touches `.tsx` files, pages, components, or styling must invoke the `frontend-designer` skill first. This is enforced via a directive in `CLAUDE.md`.

2. **Scope**: Handles both full pages and individual components. Can be invoked directly (`/frontend-designer`) or dispatched as a subagent via `superpowers:dispatching-parallel-agents`.

3. **Content**: The skill embeds:
   - Full `frontend-design` plugin aesthetic guidelines (typography, color, motion, spatial composition, backgrounds)
   - Project constraints (Next.js 16, Tailwind v4, TypeScript, Supabase JS, no UI libraries)
   - Component inventory (6 components, 4 pages)
   - Data shapes from Supabase (snake_case fields)
   - Pipeline-specific UI patterns (progress indicators, review screens, comparison views, real-time polling, cost tracking)

4. **Workflow**: Understand request → audit existing UI → choose aesthetic direction → implement → verify build passes.

## Why Option A (Self-Contained Skill)
- Works when dispatched as a subagent (subagents can't invoke other plugins' skills)
- Version-controlled with the project
- Carries full context without external dependencies
- Any Claude Code session automatically picks it up

## Files Created
- `.claude/skills/frontend-designer/SKILL.md` — The skill definition
- `CLAUDE.md` — Added "Frontend Design Rule" section enforcing skill usage
