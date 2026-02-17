# Cancel Generations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add cooperative cancellation to all generation types — pipeline stages, test videos, and individual asset regenerations — so users can hard-cancel in-flight work and stop wasting money.

**Architecture:** Database-flag approach. A `cancel_requested_at` timestamp on the project signals pipeline-level cancel. Asset status flipped to `cancelled` signals individual asset cancel. The worker checks these flags between poll iterations and bails out with a custom `CancellationError` that prevents retries.

**Tech Stack:** Supabase (PostgreSQL), BullMQ worker, Next.js API routes, React components (Tailwind CSS v4)

---

### Task 1: Add `cancel_requested_at` Column to Project Table

**Files:**
- Modify: Supabase database via MCP migration

**Step 1: Apply migration**

```sql
ALTER TABLE project ADD COLUMN cancel_requested_at timestamptz;
```

Use `apply_migration` with name `add_cancel_requested_at_to_project`.

**Step 2: Verify column exists**

Run: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'project' AND column_name = 'cancel_requested_at';`
Expected: One row with `timestamptz` type.

**Step 3: Update Drizzle schema**

Add to `src/db/schema.ts` in the `project` table definition, after `failedAtStatus` (line 155):

```typescript
cancelRequestedAt: timestamp('cancel_requested_at'),
```

**Step 4: Build to verify types**

Run: `npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat: add cancel_requested_at column to project table"
git push
```

---

### Task 2: Create `CancellationError` Class

**Files:**
- Create: `src/lib/errors.ts`

**Step 1: Write the error class**

```typescript
/**
 * Thrown when a generation is cancelled by the user.
 * The worker catches this and exits cleanly without retrying.
 */
export class CancellationError extends Error {
  constructor(message = 'Generation cancelled by user') {
    super(message);
    this.name = 'CancellationError';
  }
}
```

**Step 2: Build to verify**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/errors.ts
git commit -m "feat: add CancellationError class for cooperative cancellation"
git push
```

---

### Task 3: Add `shouldCancel` Support to `WaveSpeedClient.pollResult()`

**Files:**
- Modify: `src/lib/api-clients/wavespeed.ts:260-334`

**Step 1: Update `pollResult()` to accept a `shouldCancel` callback**

Add `shouldCancel` to the options parameter (line 262):

```typescript
async pollResult(
  taskId: string,
  options?: { maxWait?: number; initialInterval?: number; shouldCancel?: () => Promise<boolean> }
): Promise<{ status: string; url?: string }> {
```

**Step 2: Check `shouldCancel` inside the poll loop**

At line 281 (start of the `while` loop), add a cancellation check BEFORE the poll request:

```typescript
while (Date.now() - startTime < config.maxWait) {
  // Check for cancellation before polling
  if (options?.shouldCancel) {
    const cancelled = await options.shouldCancel();
    if (cancelled) {
      logger.info({ taskId }, 'Poll cancelled by shouldCancel callback');
      const { CancellationError } = await import('./../../lib/errors');
      throw new CancellationError(`Task ${taskId} cancelled by user`);
    }
  }
```

**Step 3: Build to verify**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/api-clients/wavespeed.ts
git commit -m "feat: add shouldCancel callback to WaveSpeedClient.pollResult()"
git push
```

---

### Task 4: Wire Cancellation Checks into Pipeline Worker

**Files:**
- Modify: `src/workers/pipeline.worker.ts`

This is the biggest task. The worker needs:
1. A helper to check project-level cancellation
2. A helper to check asset-level cancellation
3. `CancellationError` handling in the main job dispatcher
4. `shouldCancel` callbacks passed to every `pollResult()` call

**Step 1: Add cancellation helpers at the top of the file (after line 26)**

```typescript
import { CancellationError } from '../lib/errors';

/** Check if a project has been cancelled. */
async function isProjectCancelled(projectId: string): Promise<boolean> {
  const { data } = await supabase
    .from('project')
    .select('cancel_requested_at')
    .eq('id', projectId)
    .single();
  return !!data?.cancel_requested_at;
}

/** Check if an individual asset has been cancelled. */
async function isAssetCancelled(assetId: string): Promise<boolean> {
  const { data } = await supabase
    .from('asset')
    .select('status')
    .eq('id', assetId)
    .single();
  return data?.status === 'cancelled';
}

/** Build a shouldCancel callback for use in pollResult(). Checks both project and asset. */
function buildShouldCancel(projectId: string, assetId?: string): () => Promise<boolean> {
  return async () => {
    if (await isProjectCancelled(projectId)) return true;
    if (assetId && await isAssetCancelled(assetId)) return true;
    return false;
  };
}
```

**Step 2: Handle `CancellationError` in the main worker dispatcher**

Wrap the job handler (lines 112-143) so `CancellationError` doesn't trigger retries. Replace the worker callback:

```typescript
const worker = new Worker(
  'pipeline',
  async (job: Job) => {
    const { projectId, productId, step } = job.data;
    const correlationId = crypto.randomUUID();
    const jobLog = createLogger({ agentName: 'PipelineWorker', jobId: job.id, correlationId, projectId: projectId || productId });

    jobLog.info({ step, projectId, productId }, 'Processing job');

    try {
      if (step === 'product_analysis') {
        await handleProductAnalysis(projectId, correlationId, jobLog, productId);
      } else if (step === 'scripting') {
        await handleScripting(projectId, correlationId, jobLog);
      } else if (step === 'casting') {
        await handleCasting(projectId, correlationId, jobLog);
      } else if (step === 'directing') {
        await handleDirecting(projectId, correlationId, jobLog);
      } else if (step === 'voiceover') {
        await handleVoiceover(projectId, correlationId, jobLog);
      } else if (step === 'broll_planning') {
        await handleBrollPlanning(projectId, correlationId, jobLog);
      } else if (step === 'broll_generation') {
        await handleBrollGeneration(projectId, correlationId, jobLog);
      } else if (step === 'editing') {
        await handleEditing(projectId, correlationId, jobLog);
      } else if (step === 'regenerate_asset') {
        await handleAssetRegeneration(projectId, job.data.assetId, correlationId, jobLog);
      } else if (step === 'regenerate_asset_cascade') {
        await handleCascadeRegeneration(projectId, job.data.assetId, correlationId, jobLog);
      } else if (step === 'keyframe_edit') {
        await handleKeyframeEdit(projectId!, job.data.assetId!, job.data.editPrompt!, job.data.propagate || false, correlationId, jobLog);
      } else {
        jobLog.warn({ step }, 'Unknown step, skipping');
      }
    } catch (err) {
      if (err instanceof CancellationError) {
        jobLog.info({ step, projectId }, 'Job cancelled by user, exiting cleanly');
        await logToGenerationLog(supabase, {
          project_id: projectId || productId || 'unknown',
          correlation_id: correlationId,
          event_type: 'stage_cancelled',
          agent_name: 'PipelineWorker',
          stage: step,
        });
        // Mark any remaining generating assets as cancelled
        if (projectId) {
          await supabase
            .from('asset')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('project_id', projectId)
            .eq('status', 'generating');
        }
        return; // Exit cleanly — no retry
      }
      throw err; // Re-throw other errors for BullMQ retry
    }
  },
  // ... connection config unchanged
```

**Step 3: Pass `shouldCancel` to every `pollResult()` call**

Update every `pollResult()` call in the file to include the callback:

- `regenerateKeyframe()` line 1013:
  ```typescript
  const pollResult = await wavespeed.pollResult(taskId, { maxWait: 240000, initialInterval: 5000, shouldCancel: buildShouldCancel(projectId, assetId) });
  ```

- `regenerateVideo()` line 1257:
  ```typescript
  const pollResult = await wavespeed.pollResult(result.taskId, { shouldCancel: buildShouldCancel(projectId, assetId) });
  ```

- `editSingleKeyframe()` lines 1498-1501:
  ```typescript
  const pollResult = await wavespeed.pollResult(result.taskId, {
    maxWait: 240000,
    initialInterval: 5000,
    shouldCancel: buildShouldCancel(projectId, assetId),
  });
  ```

**Step 4: Add project-level cancellation checks to stage handlers**

In each stage handler that runs agents (e.g., `handleCasting`, `handleDirecting`, `handleVoiceover`, `handleBrollGeneration`), add a cancellation check BEFORE calling the agent's `run()` method:

```typescript
// At the start of each handler, after setting project status:
if (await isProjectCancelled(projectId)) {
  throw new CancellationError(`Stage ${stage} cancelled before start`);
}
```

And AFTER the agent completes, before auto-enqueueing the next step:

```typescript
// After agent.run() completes, before enqueueing next step:
if (await isProjectCancelled(projectId)) {
  throw new CancellationError(`Stage ${stage} cancelled after completion`);
}
```

**Step 5: Build to verify**

Run: `npm run build`
Expected: PASS

**Step 6: Commit**

```bash
git add src/workers/pipeline.worker.ts
git commit -m "feat: wire cooperative cancellation into pipeline worker"
git push
```

---

### Task 5: Enhance Project Cancel API Route

**Files:**
- Modify: `src/app/api/projects/[id]/cancel/route.ts`

**Step 1: Update the cancel route to set `cancel_requested_at` and flip asset statuses**

Replace the full route handler:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

const CANCEL_ROLLBACK_MAP: Record<string, string> = {
  analyzing: 'created',
  scripting: 'analysis_review',
  broll_planning: 'script_review',
  casting: 'influencer_selection',
  directing: 'casting_review',
  voiceover: 'casting_review',
  broll_generation: 'casting_review',
  editing: 'asset_review',
};

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { data: proj, error } = await supabase
      .from('project')
      .select('id, status')
      .eq('id', id)
      .single();

    if (error || !proj) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const rollbackTo = CANCEL_ROLLBACK_MAP[proj.status];
    if (!rollbackTo) {
      return NextResponse.json(
        { error: `Cannot cancel from status "${proj.status}". Only processing stages can be canceled.` },
        { status: 400 }
      );
    }

    // 1. Set cancel flag so the worker knows to stop
    await supabase
      .from('project')
      .update({
        cancel_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    // 2. Flip in-flight and pending assets to cancelled
    await supabase
      .from('asset')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('project_id', id)
      .in('status', ['generating', 'pending']);

    // 3. Roll back project status and clear cancel flag
    await supabase
      .from('project')
      .update({
        status: rollbackTo,
        cancel_requested_at: null,
        error_message: null,
        failed_at_status: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    logger.info(
      { projectId: id, from: proj.status, to: rollbackTo, route: '/api/projects/[id]/cancel' },
      'Pipeline hard-cancelled, assets marked cancelled, rolled back to review gate'
    );

    return NextResponse.json({ status: rollbackTo });
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/cancel' }, 'Error canceling pipeline');
    return NextResponse.json(
      { error: 'Failed to cancel pipeline stage' },
      { status: 500 }
    );
  }
}
```

**Step 2: Build to verify**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/api/projects/[id]/cancel/route.ts
git commit -m "feat: enhance project cancel route with cancel_requested_at flag and asset cleanup"
git push
```

---

### Task 6: Create Individual Asset Cancel API Route

**Files:**
- Create: `src/app/api/projects/[id]/assets/[assetId]/cancel/route.ts`

**Step 1: Write the route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

/**
 * POST /api/projects/[id]/assets/[assetId]/cancel
 *
 * Cancels a single in-flight asset (test video, regeneration, etc.).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  const { id: projectId, assetId } = await params;

  try {
    const { data: asset, error } = await supabase
      .from('asset')
      .select('id, status, project_id')
      .eq('id', assetId)
      .single();

    if (error || !asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    if (asset.project_id !== projectId) {
      return NextResponse.json({ error: 'Asset does not belong to this project' }, { status: 400 });
    }

    if (asset.status !== 'generating') {
      return NextResponse.json(
        { error: `Cannot cancel asset with status "${asset.status}". Only generating assets can be cancelled.` },
        { status: 400 }
      );
    }

    await supabase
      .from('asset')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', assetId);

    logger.info(
      { projectId, assetId, route: '/api/projects/[id]/assets/[assetId]/cancel' },
      'Asset cancelled'
    );

    return NextResponse.json({ status: 'cancelled', assetId });
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/assets/[assetId]/cancel' }, 'Error cancelling asset');
    return NextResponse.json(
      { error: 'Failed to cancel asset' },
      { status: 500 }
    );
  }
}
```

**Step 2: Build to verify**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/api/projects/[id]/assets/[assetId]/cancel/route.ts
git commit -m "feat: add individual asset cancel API route"
git push
```

---

### Task 7: Add Cancel Button to Pipeline Progress UI

**Files:**
- Modify: `src/components/pipeline-progress.tsx`

**Step 1: Add cancel button next to the current processing stage**

The pipeline-progress component shows a progress bar for each stage. Add a "Cancel" button that appears when a stage is actively processing.

The component needs:
1. Accept an `onCancel` callback prop
2. Show a cancel button when the current stage is a processing stage (not a review gate)
3. Call `POST /api/projects/[id]/cancel` when clicked

Add `onCancel?: () => void` to the component props. Render a cancel button alongside the current processing stage indicator. Style it as a small, destructive-action button (red/magenta text, no background, small font).

**Step 2: Wire cancel handler from the parent page**

In the parent page/component that renders `<PipelineProgress>`, add:

```typescript
const handlePipelineCancel = async () => {
  await fetch(`/api/projects/${projectId}/cancel`, { method: 'POST' });
  // Refresh project data to reflect rollback
  router.refresh();
};
```

Pass `onCancel={handlePipelineCancel}` to the pipeline progress component.

**Step 3: Build to verify**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add cancel button to pipeline progress UI"
git push
```

---

### Task 8: Add Cancel Button to Test Video Generation

**Files:**
- Modify: `src/components/video-preview-panel.tsx`

**Step 1: Replace disabled "Generating..." button with a "Cancel" button**

In the test generate button area (lines 417-440), when `isTestGenerating` is true, show a "Cancel" button instead of a disabled spinner button:

```tsx
{isTestGenerating ? (
  <button
    onClick={handleCancelTestGenerate}
    className="... bg-magenta/20 text-magenta hover:bg-magenta/30 ..."
  >
    <XIcon className="h-4 w-4" />
    Cancel
  </button>
) : (
  <button onClick={handleTestGenerate} ...>
    Test Generate (${cost})
  </button>
)}
```

**Step 2: Add `handleCancelTestGenerate` function**

```typescript
const handleCancelTestGenerate = async () => {
  if (!testVideoAsset?.id) return;

  // Stop frontend polling and timer
  if (pollRef.current) clearInterval(pollRef.current);
  if (timerRef.current) clearInterval(timerRef.current);

  // Cancel on server
  await fetch(`/api/projects/${projectId}/assets/${testVideoAsset.id}/cancel`, {
    method: 'POST',
  });

  setIsTestGenerating(false);
  setTestVideoAsset(null);
  setElapsedSeconds(0);
};
```

**Step 3: Build to verify**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/video-preview-panel.tsx
git commit -m "feat: add cancel button to test video generation"
git push
```

---

### Task 9: Add Cancel Button to Asset Card (Regeneration)

**Files:**
- Modify: `src/components/asset-card.tsx`

**Step 1: Add a cancel X button to the generating spinner overlay**

In the generating state block (lines 233-254), add a small cancel button in the top-right corner:

```tsx
{asset.status === 'generating' && (
  <div className="relative ...">
    {/* Existing spinner */}
    <button
      onClick={() => onCancelAsset?.(asset.id)}
      className="absolute top-2 right-2 rounded-full bg-surface/80 p-1 text-text-muted hover:text-magenta hover:bg-magenta/10 transition-colors"
      title="Cancel generation"
    >
      <XIcon className="h-4 w-4" />
    </button>
    {/* Existing spinner and text */}
  </div>
)}
```

**Step 2: Add `onCancelAsset` prop to the component**

Add `onCancelAsset?: (assetId: string) => void` to the component's props interface.

**Step 3: Wire the cancel handler from the parent**

In the parent that renders asset cards (likely `asset-review.tsx` or similar), add:

```typescript
const handleCancelAsset = async (assetId: string) => {
  await fetch(`/api/projects/${projectId}/assets/${assetId}/cancel`, {
    method: 'POST',
  });
  // Refetch assets to update UI
};
```

**Step 4: Build to verify**

Run: `npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add cancel button to asset card generating state"
git push
```

---

### Task 10: Handle `cancelled` Status in Asset Display

**Files:**
- Modify: `src/components/asset-card.tsx`

**Step 1: Add a cancelled state display**

After the generating state block, add handling for cancelled assets:

```tsx
if (asset.status === 'cancelled') {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/50 bg-surface/50">
      <div className="flex items-center justify-center py-8">
        <div className="flex flex-col items-center gap-2">
          <XCircleIcon className="h-6 w-6 text-text-muted" />
          <span className="text-sm text-text-muted">Cancelled</span>
        </div>
      </div>
      {/* Type badge */}
    </div>
  );
}
```

**Step 2: Ensure cancelled assets can be regenerated**

The existing regenerate button logic should treat `cancelled` like `failed` — allow the user to regenerate. Check if the regeneration handler already handles non-`completed` statuses. If it only checks for `failed`, add `cancelled` as well.

**Step 3: Build to verify**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/asset-card.tsx
git commit -m "feat: display cancelled asset state with regeneration option"
git push
```

---

### Task 11: Handle `cancelled` Status in Video Preview Panel Polling

**Files:**
- Modify: `src/components/video-preview-panel.tsx`

**Step 1: Update polling to detect `cancelled` status**

In the polling loop (lines 189-219), add a check for `cancelled` alongside `failed`:

```typescript
} else if (videoAsset.status === 'failed' || videoAsset.status === 'cancelled') {
  setTestVideoAsset({ id: videoAsset.id, url: null, status: videoAsset.status });
  setIsTestGenerating(false);
  stopTimer();
  clearInterval(pollRef.current!);
}
```

**Step 2: Build to verify**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/video-preview-panel.tsx
git commit -m "feat: handle cancelled status in test video polling"
git push
```

---

### Task 12: Wire Cancellation into Agents (CastingAgent, DirectorAgent, etc.)

**Files:**
- Modify: `src/agents/casting-agent.ts`
- Modify: `src/agents/director-agent.ts`
- Modify: `src/agents/voiceover-agent.ts`
- Modify: `src/agents/broll-agent.ts`

**Step 1: Check how agents call `pollResult()` internally**

The agents use `WaveSpeedClient` internally and call `pollResult()` in their generation loops. Each agent needs to pass `shouldCancel` to its `pollResult()` calls.

The agents already have access to `this.supabase` and `projectId`. Add a method or pass `shouldCancel` callbacks when constructing the agent or during `run()`.

The simplest approach: agents that generate assets in loops should accept a `shouldCancel` callback on their `run()` method or have a `setCancelCheck()` setter similar to the existing `setCorrelationId()` pattern.

**Step 2: Add `setCancelCheck()` to agents that generate assets**

In each agent that calls `pollResult()`:

```typescript
private shouldCancel?: () => Promise<boolean>;

setCancelCheck(fn: () => Promise<boolean>) {
  this.shouldCancel = fn;
}
```

Then pass `shouldCancel: this.shouldCancel` to their `pollResult()` calls.

**Step 3: Wire from pipeline worker**

In each handler in `pipeline.worker.ts`, after creating the agent:

```typescript
const agent = new CastingAgent(supabase);
agent.setCorrelationId(correlationId);
agent.setCancelCheck(buildShouldCancel(projectId));
```

**Step 4: Build to verify**

Run: `npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add src/agents/ src/workers/pipeline.worker.ts
git commit -m "feat: wire shouldCancel through agents for cooperative cancellation"
git push
```

---

### Task 13: Wire Cancellation into Test Generate Route

**Files:**
- Modify: `src/app/api/projects/[id]/segments/[segIdx]/test-generate/route.ts`

**Step 1: Add cancellation check to the test generate polling**

The test-generate route creates an asset and returns immediately — it does NOT poll. The polling happens on the frontend via the assets API. So no worker-side changes are needed for test generation specifically.

However, if the test-generate route does inline polling (check the actual implementation), add the `shouldCancel` callback there too.

Based on the exploration, the test-generate route calls `wavespeed.generateVideo()` and returns immediately with the `assetId`. Polling happens client-side. So the only change needed is:
- The frontend cancel button (Task 8) calls the asset cancel endpoint
- The worker's `pollResult()` for test videos won't be affected because test videos don't go through the pipeline worker

**Wait** — actually the test-generate route does NOT use the pipeline worker. It runs inline in the API route. So there's no `pollResult()` to interrupt server-side. The cancellation is purely client-side (stop polling, mark asset as cancelled).

This task is a no-op beyond what Task 8 already covers. Skip to next task.

**Step 1: Verify no additional changes needed**

Run: `npm run build`
Expected: PASS (no changes in this task)

---

### Task 14: Final Verification

**Step 1: Full build**

Run: `npm run build`
Expected: PASS with no errors.

**Step 2: Manual test checklist**

1. Start a pipeline generation → click Cancel on progress bar → verify:
   - Project rolls back to review gate
   - Completed assets preserved
   - In-flight assets marked `cancelled`
   - Worker stops processing within ~30s

2. Start a test video generation → click Cancel → verify:
   - Polling stops immediately
   - Asset marked as `cancelled`
   - Generate button re-appears

3. Start an asset regeneration → click Cancel X on card → verify:
   - Asset marked as `cancelled`
   - Card shows "Cancelled" state
   - Regenerate button available

**Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "feat: cancel generations — final polish"
git push
```
