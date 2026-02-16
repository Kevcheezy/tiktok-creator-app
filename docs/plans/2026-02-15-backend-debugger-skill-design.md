# Backend Debugger Skill Design

## Overview

A project-specific debugger skill at `.claude/skills/debugger/SKILL.md` that the backend engineer agent invokes when investigating and fixing bugs. It layers on top of `superpowers:systematic-debugging`, adding app-specific triage, observability tools, query recipes, and known failure patterns.

## Decisions

- **Location:** `.claude/skills/debugger/SKILL.md` (project-specific, version-controlled)
- **Approach:** Layered skill wrapping `superpowers:systematic-debugging`
- **Scope:** Full diagnose-and-fix cycle (not read-only)
- **Required background:** `superpowers:systematic-debugging`

## Skill Structure

### 1. Frontmatter & Overview

```yaml
---
name: backend-debugger
description: Use when investigating bugs, failures, errors, or unexpected behavior in the backend — API routes, pipeline agents, workers, database queries, or external API calls. Use before proposing any fix.
---
```

References `superpowers:systematic-debugging` as required background. Inherits the Iron Law: no fixes without root cause investigation.

### 2. Phase 0: Triage

Three quick queries to classify the issue before deep investigation:

1. **Check project status** — `project` table: `status`, `failed_at_status`, `error_message`
2. **Check recent generation_log events** — Last 20 events, look for `stage_error` / `api_call` failures
3. **Check queue state** — `/api/queue/status?projectId=<id>`

Classifies into: Pipeline failure, External API failure, Database issue, Queue/Worker issue, API route error.

### 3. Observability Toolkit

| Tool | Purpose |
|------|---------|
| `execute_sql` (Supabase MCP) | Query `generation_log`, `project`, `asset` tables |
| `get_logs` (Supabase MCP) | Fetch 24h runtime logs by service |
| `list_tables` (Supabase MCP) | Inspect DB schema |
| `Grep` / `Read` | Search and read source code |
| `/api/queue/status` | Check BullMQ job state |
| `/api/projects/[id]/progress` | Pipeline progress detail |
| `/api/version` | Deployed version/commit |

Key tables: `generation_log`, `project`, `asset`, `segment`

### 4. Query Cookbook

Pre-built SQL for common investigations:

- **Pipeline timeline** — All events for a project ordered by time
- **Errors only** — Filter for `%error%` event types
- **Correlation trace** — Trace single pipeline run by `correlation_id`
- **API call analysis** — Provider, status code, latency, errors
- **Asset status** — All assets with generation status
- **Project health** — Current state and error info
- **Stage duration** — How long each completed stage took

### 5. Common Failure Patterns

| Pattern | Symptoms | Path |
|---------|----------|------|
| Pipeline stuck at stage | Status stuck, no complete/error events | Worker logs, BullMQ state |
| External API timeout | High latencyMs, missing statusCode | Provider status, rate limits |
| External API rate limit | statusCode 429 | Call frequency, backoff config |
| Asset generation failed | asset.status = 'failed' | Trace agent, check API call |
| Cost anomaly | cost_usd higher than expected | Sum api_call costs |
| Worker crash/restart | Jobs waiting, no stage_start | Railway logs, OOM |
| DB constraint violation | "violates" in error | Source code, data integrity |
| Retry exhaustion | Failed after 3 attempts | All attempt errors |

### 6. Fix Implementation

**Allowed scope:** `src/app/api/`, `src/agents/`, `src/workers/`, `src/lib/`, DB migrations, middleware.
**Cannot touch:** `.tsx` files, components.

**Workflow:**
1. Confirm root cause with evidence
2. Read relevant source code
3. Implement fix
4. Add/update `logToGenerationLog()` if failure wasn't visible enough
5. Verify via `superpowers:verification-before-completion`

**Observability improvement rule:** If investigation was hard due to insufficient logs, the fix MUST include improved logging.
