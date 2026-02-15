# Agent Role System Design

**Date:** 2026-02-15
**Status:** Approved

## Overview

Every Claude Code instance must operate under a declared role, locked for the entire session. This prevents cross-domain work and ensures the correct specialist skill is always active.

## Roles

| Role | Scope | Required Skill | Cannot Touch |
|------|-------|---------------|--------------|
| `frontend` | `.tsx`, pages, components, styling | `frontend-designer` | API routes, agents, workers, lib, db, middleware |
| `backend` | API routes, agents, workers, lib, db, middleware, migrations | `backend-developer` | `.tsx`, components, pages, styling |
| `product-manager` | Roadmap, CLAUDE.md priorities, design docs | `product-manager` | Any source code |
| `other` | Config, CI/CD, docs, tooling, package.json, git | General superpowers | Files scoped to frontend or backend |

## Role Gate Mechanism

- Added at top of CLAUDE.md, before Tech Stack
- User's first message must declare a role
- If no role stated, agent asks before doing anything
- Once declared, role is locked for the session
- Cross-domain work: flag it, suggest spawning another agent

## Product Manager Responsibilities

1. Roadmap management (PRODUCT_ROADMAP.md, tier ordering, dependencies)
2. Bug/feature triage (slot into tiers)
3. Specs & acceptance criteria (design docs)
4. Parallel work identification (flag tasks for independent agent teams)
5. Coordination (suggest spawning agents, never writes code)

## Implementation

- CLAUDE.md: Role gate section at top
- New skill: `.claude/skills/product-manager/SKILL.md`
- Existing skills unchanged (frontend-designer, backend-developer)
