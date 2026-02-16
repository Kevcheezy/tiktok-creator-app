# R1.5.20: Smart Cascade Editing (Per-Segment Script → Asset Re-generation)

**Author:** PM Agent
**Date:** 2026-02-16
**Status:** Spec Complete

---

## Problem

After keyframes are generated, editing the script is expensive and clumsy:

1. **No auto-cascade.** User edits the script, then must manually restart the pipeline from casting. No "Save & Regenerate" flow.
2. **All-or-nothing regeneration.** Changing one word in segment 3 regenerates ALL 4 segments' keyframes, videos, voiceovers, and B-roll. Cost: ~$6.20 for what should be a ~$1.55 fix.
3. **B-roll orphaned.** B-roll was planned for the old script. The restart goes to `broll_review → casting` but doesn't re-plan B-roll shots for changed segments.
4. **No segment-level diff.** The system doesn't know WHICH segments changed — it treats any script edit as a full-pipeline restart.

## Solution

Per-segment diff detection + surgical cascade. When a user edits a script after downstream work exists, the system:

1. **Detects which segments changed** (diff old vs new script text, shot_scripts, energy_arc per segment)
2. **Shows a cascade confirmation dialog** with per-segment impact and cost
3. **Auto-enqueues only affected segments** through the downstream pipeline (B-roll re-plan → casting → directing → voiceover → editing)
4. **Preserves unchanged segments** — their keyframes, videos, voiceovers, and B-roll stay untouched

---

## Segment Diff Detection

When a user saves script changes at `script_review` while downstream assets exist:

```typescript
interface SegmentDiff {
  segmentIndex: number;
  section: string;                    // "Hook", "Problem", etc.
  changed: boolean;
  changedFields: string[];            // ["script_text", "shot_scripts", "energy_arc"]
  downstreamAssets: {
    keyframes: number;                // count of existing keyframe assets
    videos: number;                   // count of existing video assets
    voiceovers: number;              // count of existing audio assets
    brollShots: number;              // count of existing B-roll shots
  };
  estimatedCost: number;             // cost to regenerate this segment only
}
```

**Diff logic:** Compare old vs new values for each segment:

| Field | Diff method | Cascade if changed |
|-------|------------|-------------------|
| `script_text` | String equality | casting + directing + voiceover + editing |
| `shot_scripts` | Deep JSON equality | directing + editing (keyframes may still be valid) |
| `energy_arc` | JSON equality | casting + directing + editing |
| `broll_cues` | JSON equality | broll re-planning only |
| `text_overlay` | String equality | editing only (safe — applied at render time) |
| `syllable_count` | Number equality | voiceover only (affects TTS pacing) |

**Cost per affected segment:**

| Stage | Cost |
|-------|------|
| B-roll re-plan (LLM) | ~$0.005 |
| B-roll generation (images) | ~$0.21 (3 images avg) |
| Casting (2 keyframes) | $0.14 |
| Directing (1 video) | $1.20 |
| Voiceover (1 audio) | $0.05 |
| **Total per segment** | **~$1.60** |

vs. full pipeline restart: ~$6.20 (all 4 segments). Editing 1 segment saves ~$4.60 (74%).

---

## Cascade Confirmation Dialog

When the user saves script edits with downstream assets present:

```
┌─────────────────────────────────────────────────────────┐
│  Script Changes Detected                                │
│                                                         │
│  The following segments have changed:                   │
│                                                         │
│  ✏️ Segment 2 (Problem)                                 │
│     Changed: script text, shot descriptions             │
│     Will regenerate: B-roll, keyframes, video, voice    │
│     Cost: ~$1.60                                        │
│                                                         │
│  ✏️ Segment 4 (CTA)                                     │
│     Changed: script text                                │
│     Will regenerate: B-roll, keyframes, video, voice    │
│     Cost: ~$1.60                                        │
│                                                         │
│  ── Unchanged (kept as-is) ──                           │
│  ✓ Segment 1 (Hook) — no changes                       │
│  ✓ Segment 3 (Solution + Product) — no changes         │
│                                                         │
│  Estimated cost: $3.20                                  │
│                                                         │
│  [Cancel]              [Save & Regenerate Affected]     │
└─────────────────────────────────────────────────────────┘
```

User can also choose "Save Only" (save script changes without triggering cascade — manual restart later, current behavior preserved).

---

## Cascade Pipeline Flow

After user confirms "Save & Regenerate Affected":

```
1. Save updated scene rows (only changed segments)
2. Mark affected segments' existing assets as 'superseded' (not deleted — kept for comparison)
3. For each affected segment:
   a. If broll_cues changed → re-plan B-roll for that segment only
   b. Re-generate keyframes (CastingAgent runs for affected segment indices only)
   c. Re-generate video (DirectorAgent runs for affected segment indices only)
   d. Re-generate voiceover (VoiceoverAgent runs for affected segment indices only)
4. When all affected segments complete → re-run EditorAgent (re-composite full video)
5. Project status cycles: script_review → cascade_in_progress → casting_review
```

**New pipeline status:** `cascade_in_progress` — indicates a partial regeneration is running. The project detail page shows which segments are regenerating with per-segment progress.

**Agent changes:** All agents need to accept a `segmentIndices: number[]` parameter instead of always processing `[0, 1, 2, 3]`. When `segmentIndices` is provided, the agent only processes those segments and skips the rest.

---

## Backend Changes

### New API endpoint

`POST /api/projects/[id]/cascade`

```typescript
// Request
{
  segmentDiffs: SegmentDiff[],      // which segments changed and how
  confirmedCost: number              // user-confirmed cost estimate
}

// Response
{
  cascadeId: string,                 // tracking ID for the cascade operation
  affectedSegments: number[],        // [1, 3] — segment indices being regenerated
  enqueuedStages: string[],          // ["broll_planning", "casting", "directing", "voiceover", "editing"]
  estimatedCost: number
}
```

### Modified endpoints

- `PATCH /api/projects/[id]` for script edits — returns `segmentDiffs` in response when downstream assets exist (so frontend can show cascade dialog)
- `POST /api/projects/[id]/retry` — accepts optional `segmentIndices` parameter for surgical restart

### Worker changes

All per-segment agents accept `segmentIndices`:

```typescript
// Current: always processes all segments
const SEGMENTS = [0, 1, 2, 3];

// After: processes only specified segments (defaults to all)
const segments = job.data.segmentIndices ?? [0, 1, 2, 3];
```

CastingAgent keyframe chaining needs special handling: if segment 2 changed but segment 1 didn't, use segment 1's existing end keyframe as the reference for segment 2's start keyframe (chain is preserved).

---

## Frontend Changes

- **Cascade confirmation dialog** (new component) — shown when saving script edits with downstream assets
- **Per-segment progress during cascade** — pipeline progress bar shows which segments are regenerating
- **"Save Only" vs "Save & Regenerate"** — two action buttons at script review when in edit mode with downstream assets
- **Cascade status indicator** — project card shows "Regenerating 2/4 segments" during cascade

---

## Acceptance Criteria

- [ ] Segment diff detection: compare old vs new script_text, shot_scripts, energy_arc, broll_cues per segment
- [ ] Cascade confirmation dialog shows per-segment changes, downstream impact, and cost estimate
- [ ] "Save & Regenerate Affected" triggers surgical cascade for changed segments only
- [ ] "Save Only" preserves current manual-restart behavior
- [ ] B-roll re-planned only for segments with changed broll_cues or script_text
- [ ] CastingAgent, DirectorAgent, VoiceoverAgent accept `segmentIndices` parameter — skip unchanged segments
- [ ] Keyframe chaining preserved: unchanged segment's end keyframe used as reference for next segment
- [ ] EditorAgent re-composites full video after all affected segments complete
- [ ] `cascade_in_progress` status with per-segment progress tracking
- [ ] Old assets marked 'superseded' (not deleted) during cascade
- [ ] Cost savings: regenerating 1 segment costs ~$1.60, not ~$6.20
- [ ] Existing full-pipeline restart flow continues to work (backward compat)
- [ ] `npm run build` passes

## Affected Files

**New:**
- `src/lib/segment-diff.ts` — diff detection logic
- `src/app/api/projects/[id]/cascade/route.ts` — cascade endpoint
- `src/components/cascade-dialog.tsx` — confirmation dialog

**Backend (modify):**
- `src/agents/casting-agent.ts` — accept segmentIndices, preserve chain from unchanged segments
- `src/agents/director-agent.ts` — accept segmentIndices
- `src/agents/voiceover-agent.ts` — accept segmentIndices
- `src/agents/broll-agent.ts` — accept segmentIndices for re-planning
- `src/workers/pipeline.worker.ts` — cascade job handler, pass segmentIndices to agents
- `src/lib/constants.ts` — cascade_in_progress status, segment cost constants
- `src/app/api/projects/[id]/route.ts` — return segmentDiffs on script edit with downstream assets

**Frontend (modify):**
- `src/components/project-detail.tsx` — cascade dialog trigger, per-segment progress during cascade
- `src/components/script-review.tsx` — "Save Only" vs "Save & Regenerate" buttons in edit mode
- `src/components/pipeline-progress.tsx` — per-segment regeneration indicators

## PARALLEL WORK ANALYSIS

```
- Task A (segment diff + cascade API): Independent, start immediately
  Files: src/lib/segment-diff.ts, src/app/api/projects/[id]/cascade/route.ts

- Task B (agent segmentIndices support): Independent of A (just adding parameter)
  Files: All 4 agents + pipeline worker
  Note: CastingAgent chain preservation is the complex part

- Task C (frontend): Depends on A (needs cascade API + segmentDiffs response)
  Files: cascade-dialog.tsx, project-detail.tsx, script-review.tsx, pipeline-progress.tsx

Recommendation: A + B in parallel (no shared files), then C after both complete.
```
