# Navigable Pipeline Stages — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users click completed pipeline stages to review and edit past work, with downstream impact warnings before destructive changes.

**Architecture:** Backend provides a `DOWNSTREAM_IMPACT_MAP` constant and a `POST /api/projects/[id]/impact` endpoint that classifies edits as safe or destructive and returns cost estimates. Frontend (separate agent) makes pipeline nodes clickable and adds read-only/edit modes to review components.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase, existing `API_COSTS` and `RESTART_STAGE_MAP` constants.

**Design spec:** `docs/plans/2026-02-15-navigable-pipeline-stages-design.md`

---

## Backend Tasks (this agent)

### Task 1: Add `DOWNSTREAM_IMPACT_MAP` constant

**Files:**
- Modify: `src/lib/constants.ts` (append after `BROLL_PRESETS`)

**Step 1: Add the impact map and stage cost estimate**

Append the following to `src/lib/constants.ts` after the existing exports:

```typescript
// ─── Downstream Impact Map ──────────────────────────────────────────────────

/**
 * Pipeline order for determining earliest affected stage.
 * Only includes stages that can be restarted (have RESTART_STAGE_MAP entries).
 */
export const PIPELINE_STAGE_ORDER = [
  'scripting',
  'broll_planning',
  'casting',
  'directing',
  'voiceover',
  'broll_generation',
  'editing',
] as const;

/**
 * Estimated cost per pipeline stage for impact warnings.
 * Based on API_COSTS: images at $0.07 each, videos at $1.20 each, etc.
 */
export const STAGE_COST_ESTIMATES: Record<string, { cost: number; label: string }> = {
  scripting: { cost: 0.01, label: 'Script Generation' },
  broll_planning: { cost: 0.01, label: 'B-Roll Planning' },
  broll_generation: { cost: 0.84, label: 'B-Roll Images (~12)' },
  casting: { cost: 0.56, label: 'Keyframe Casting (8 images)' },
  directing: { cost: 4.80, label: 'Video Directing (4 segments)' },
  voiceover: { cost: 0.20, label: 'Voiceover (4 segments)' },
  editing: { cost: 0.01, label: 'Final Video Rendering' },
};

/**
 * Maps review gate stages to the fields editable at that gate,
 * classified as safe (no regeneration) or destructive (requires pipeline restart).
 */
export const DOWNSTREAM_IMPACT_MAP: Record<string, Record<string, {
  type: 'safe' | 'destructive';
  affectedStages: string[];
  description: string;
}>> = {
  analysis_review: {
    product_image_url: { type: 'safe', affectedStages: [], description: 'Visual reference only' },
    product_data: {
      type: 'destructive',
      affectedStages: ['scripting', 'broll_planning', 'casting', 'directing', 'voiceover', 'editing'],
      description: 'Changes product context used by all downstream agents',
    },
    video_analysis: {
      type: 'destructive',
      affectedStages: ['scripting', 'casting', 'directing', 'editing'],
      description: 'Changes SEAL reference used for script and visual style',
    },
  },
  script_review: {
    script_text: {
      type: 'destructive',
      affectedStages: ['casting', 'directing', 'voiceover', 'editing'],
      description: 'Script text drives keyframe prompts, video, and voiceover audio',
    },
    energy_arc: {
      type: 'destructive',
      affectedStages: ['casting', 'directing', 'editing'],
      description: 'Energy arc shapes keyframe poses and video motion',
    },
    shot_scripts: {
      type: 'destructive',
      affectedStages: ['directing', 'broll_planning', 'editing'],
      description: 'Shot descriptions drive video generation and B-roll timing',
    },
    broll_cues: {
      type: 'destructive',
      affectedStages: ['broll_planning', 'broll_generation', 'editing'],
      description: 'Timing cues drive entire B-roll shot list',
    },
    text_overlay: { type: 'safe', affectedStages: [], description: 'Applied at render time' },
    hook_score: { type: 'safe', affectedStages: [], description: 'Metadata only' },
    audio_sync: { type: 'safe', affectedStages: [], description: 'Metadata only' },
  },
  broll_review: {
    prompt: {
      type: 'destructive',
      affectedStages: ['broll_generation', 'editing'],
      description: 'Prompt drives image generation',
    },
    timing_seconds: {
      type: 'destructive',
      affectedStages: ['broll_generation', 'editing'],
      description: 'Timing affects overlay placement in final video',
    },
    duration_seconds: {
      type: 'destructive',
      affectedStages: ['broll_generation', 'editing'],
      description: 'Duration affects overlay length in final video',
    },
    category: { type: 'safe', affectedStages: [], description: 'Metadata only' },
    narrative_role: { type: 'safe', affectedStages: [], description: 'Metadata only' },
  },
  influencer_selection: {
    influencer_id: {
      type: 'destructive',
      affectedStages: ['casting', 'directing', 'editing'],
      description: 'Reference image drives all keyframe generation',
    },
    product_placement: {
      type: 'destructive',
      affectedStages: ['casting', 'directing', 'editing'],
      description: 'Placement overrides affect keyframe visual prompts',
    },
  },
  casting_review: {
    keyframe: {
      type: 'destructive',
      affectedStages: ['directing', 'editing'],
      description: 'Keyframes are input to video generation',
    },
  },
  asset_review: {
    asset: {
      type: 'destructive',
      affectedStages: ['editing'],
      description: 'Changed assets require re-rendering final video',
    },
    text_overlay: { type: 'safe', affectedStages: [], description: 'Applied at render time' },
  },
};
```

**Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds, no type errors.

**Step 3: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat: add DOWNSTREAM_IMPACT_MAP, PIPELINE_STAGE_ORDER, STAGE_COST_ESTIMATES constants"
```

---

### Task 2: Create `POST /api/projects/[id]/impact` endpoint

**Files:**
- Create: `src/app/api/projects/[id]/impact/route.ts`

**Step 1: Create the impact endpoint**

Create `src/app/api/projects/[id]/impact/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import {
  DOWNSTREAM_IMPACT_MAP,
  PIPELINE_STAGE_ORDER,
  STAGE_COST_ESTIMATES,
  RESTART_STAGE_MAP,
} from '@/lib/constants';
import { logger } from '@/lib/logger';

/**
 * POST /api/projects/[id]/impact
 *
 * Given a stage and list of changed fields, returns the downstream impact:
 * which fields are safe vs destructive, affected stages, restart point, and cost.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { stage, changes } = body as { stage?: string; changes?: string[] };

    if (!stage || !changes || !Array.isArray(changes) || changes.length === 0) {
      return NextResponse.json(
        { error: 'Request body must include "stage" (string) and "changes" (string[])' },
        { status: 400 }
      );
    }

    // Verify project exists
    const { data: proj, error } = await supabase
      .from('project')
      .select('id, status')
      .eq('id', id)
      .single();

    if (error || !proj) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Look up impact map for the given stage
    const stageMap = DOWNSTREAM_IMPACT_MAP[stage];
    if (!stageMap) {
      return NextResponse.json(
        { error: `Unknown stage '${stage}'. Valid stages: ${Object.keys(DOWNSTREAM_IMPACT_MAP).join(', ')}` },
        { status: 400 }
      );
    }

    const safe: { field: string; description: string }[] = [];
    const destructive: { field: string; description: string; affectedStages: string[] }[] = [];
    const allAffectedSet = new Set<string>();

    for (const field of changes) {
      const impact = stageMap[field];
      if (!impact) {
        // Unknown field — treat as safe (no downstream impact known)
        safe.push({ field, description: 'No known downstream impact' });
        continue;
      }

      if (impact.type === 'safe') {
        safe.push({ field, description: impact.description });
      } else {
        destructive.push({
          field,
          description: impact.description,
          affectedStages: impact.affectedStages,
        });
        for (const s of impact.affectedStages) {
          allAffectedSet.add(s);
        }
      }
    }

    const allAffectedStages = PIPELINE_STAGE_ORDER.filter(s => allAffectedSet.has(s));

    // Determine restart point: earliest affected stage that has a RESTART_STAGE_MAP entry
    let restartFrom: string | null = null;
    for (const s of allAffectedStages) {
      if (RESTART_STAGE_MAP[s]) {
        restartFrom = s;
        break;
      }
    }

    // Calculate estimated cost
    let estimatedCost = 0;
    const costBreakdown: string[] = [];
    for (const s of allAffectedStages) {
      const estimate = STAGE_COST_ESTIMATES[s];
      if (estimate) {
        estimatedCost += estimate.cost;
        costBreakdown.push(`${estimate.label} ($${estimate.cost.toFixed(2)})`);
      }
    }

    // Build warning string
    let warning = '';
    if (destructive.length > 0 && costBreakdown.length > 0) {
      const fieldNames = destructive.map(d => d.field).join(', ');
      warning = `Editing ${fieldNames} will require regenerating: ${costBreakdown.join(', ')}.`;
    }

    return NextResponse.json({
      safe,
      destructive,
      allAffectedStages,
      restartFrom,
      estimatedCost: Math.round(estimatedCost * 100) / 100,
      warning,
    });
  } catch (err) {
    logger.error({ err, route: '/api/projects/[id]/impact' }, 'Error computing impact');
    return NextResponse.json({ error: 'Failed to compute impact' }, { status: 500 });
  }
}
```

**Step 2: Verify build**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds. New route `/api/projects/[id]/impact` appears in the output.

**Step 3: Commit**

```bash
git add src/app/api/projects/[id]/impact/route.ts
git commit -m "feat: add POST /api/projects/[id]/impact endpoint for downstream edit warnings"
```

---

### Task 3: Fix retry endpoint step type cast

**Files:**
- Modify: `src/app/api/projects/[id]/retry/route.ts:65-68`

The retry endpoint casts `mapping.queueStep` to a limited union type that doesn't include `broll_planning` or `broll_generation`. This breaks when the impact flow triggers a retry from a B-roll stage.

**Step 1: Fix the type cast**

In `src/app/api/projects/[id]/retry/route.ts`, change line 68:

```typescript
// Before:
step: mapping.queueStep as 'product_analysis' | 'scripting' | 'casting' | 'directing' | 'voiceover' | 'editing',

// After:
step: mapping.queueStep as PipelineJobData['step'],
```

Also add the import at the top of the file:

```typescript
import { PipelineJobData } from '@/lib/queue';
```

And add `broll_planning` and `broll_generation` to the `stepToJob` map (lines 89-96) for failed retry mode:

```typescript
const stepToJob: Record<string, string> = {
  analyzing: 'product_analysis',
  scripting: 'scripting',
  broll_planning: 'broll_planning',
  broll_generation: 'broll_generation',
  casting: 'casting',
  directing: 'directing',
  voiceover: 'voiceover',
  editing: 'editing',
};
```

**Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds, no type errors.

**Step 3: Commit**

```bash
git add src/app/api/projects/[id]/retry/route.ts
git commit -m "fix: include broll stages in retry endpoint step type and stepToJob map"
```

---

### Task 4: Update roadmap

**Files:**
- Modify: `docs/ENGINEERING_ROADMAP.md`

**Step 1: Add this feature to the roadmap**

Add a new item under Tier 1.5 (after R1.5.6) or as a new R1.5.7:

```markdown
#### R1.5.7 - Navigable Pipeline Stages
**Priority:** P1 - Medium
**Effort:** Medium
**Spec:** `docs/plans/2026-02-15-navigable-pipeline-stages-design.md`
**Why:** Users can't review or edit past stages without restarting the pipeline. Clicking completed stages lets them navigate back, view previous work, and make minor edits with downstream impact warnings.

**Backend:**
- [x] `DOWNSTREAM_IMPACT_MAP` constant — classifies edits as safe/destructive per stage
- [x] `PIPELINE_STAGE_ORDER` + `STAGE_COST_ESTIMATES` — cost estimation for impact warnings
- [x] `POST /api/projects/[id]/impact` — returns downstream impact, restart point, cost estimate
- [x] Fix retry endpoint to support broll_planning/broll_generation stages

**Frontend:**
- [ ] Clickable completed stage nodes in pipeline progress bar
- [ ] `viewingStage` + `editMode` state in project-detail.tsx
- [ ] Navigation banner: "Viewing [Stage] — Current: [Stage]" with Back/Edit buttons
- [ ] `readOnly` prop on ScriptReview, AssetReview, StoryboardView, InfluencerSelection
- [ ] Destructive edit confirmation dialog with cost estimate from impact API
```

**Step 2: Commit and push**

```bash
git add docs/ENGINEERING_ROADMAP.md
git commit -m "docs: add R1.5.7 Navigable Pipeline Stages to roadmap"
git push
```

---

## Frontend Tasks (for frontend agent)

The following tasks require the `frontend-designer` skill and should be done by a frontend agent session. They are documented here so the frontend agent has full context.

### Frontend Task A: Clickable Pipeline Nodes

**File:** `src/components/pipeline-progress.tsx`

- Add `onStageClick?: (stageKey: string) => void` prop to `PipelineProgress`
- Completed stage nodes (where `isCompleted === true`) get:
  - `onClick={() => onStageClick?.(stage.key)}`
  - `cursor-pointer`
  - Hover effect: `hover:ring-2 hover:ring-lime/30`
- Current and future nodes: no click handler, no cursor change
- Processing stages (non-review gates) should NOT be clickable even if completed

Only these stage keys are clickable: `analysis_review`, `script_review`, `broll_review`, `influencer_selection`, `casting_review`, `asset_review`.

### Frontend Task B: View State in Project Detail

**File:** `src/components/project-detail.tsx`

- Add state: `viewingStage: string | null`, `editMode: boolean`
- Pass `onStageClick={handleStageClick}` to `PipelineProgress`
- `handleStageClick(key)` sets `viewingStage` and clears `editMode`
- Change rendering logic: use `const displayStage = viewingStage || project.status` to determine which component to show
- Processing stage indicators (casting, directing, etc.) only show when `viewingStage` is null
- When `viewingStage` is set, render a navigation banner above the stage content

### Frontend Task C: Navigation Banner

**File:** `src/components/project-detail.tsx` (inline component)

When `viewingStage` is set, show a banner:
- Left: "Viewing **[Stage Label]**" with a subtle stage icon
- Right: "Current: **[Current Stage Label]**"
- Two buttons: "Edit" (enters edit mode) and "Back to current" (clears viewingStage)
- Uses existing design language (border-electric, bg-electric/5 for the viewing indicator)

### Frontend Task D: readOnly Prop on Review Components

**Files:**
- `src/components/script-review.tsx` — add `readOnly?: boolean` prop, hide ApproveControls when true
- `src/components/approve-controls.tsx` — not rendered when parent passes `readOnly`
- `src/components/asset-review.tsx` — add `readOnly?: boolean`, hide approve/reject/regenerate buttons
- `src/components/storyboard-view.tsx` — add `readOnly?: boolean`, hide edit/remove/upload/approve
- `InfluencerSelection` in `project-detail.tsx` — add `readOnly?: boolean`, show selection highlighted but disable confirm

### Frontend Task E: Destructive Edit Confirmation

When user saves changes in edit mode:
1. Collect changed field names from the component
2. Call `POST /api/projects/${projectId}/impact` with `{ stage: viewingStage, changes: [...fieldNames] }`
3. If response has no destructive changes: apply edits, show success toast
4. If destructive: show `ConfirmDialog` with `warning` text from the API, estimated cost
5. On confirm: apply PATCH, then `POST /api/projects/${projectId}/retry` with `{ stage: restartFrom }`
6. Clear `viewingStage` and `editMode`
