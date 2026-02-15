# Tier 1 MVP Completion — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a working end-to-end pipeline: product URL in, finished 60-second composed video out.

**Architecture:** Flip all agents to process 4 segments, add retry logic to DirectorAgent, build a Creatomate API client and EditorAgent to stitch segments + audio into a final video, update the pipeline worker to run the editing stage, add a final review UI with video player + download, and create a `completed_run` table for archiving finished runs.

**Tech Stack:** Creatomate REST API (`https://api.creatomate.com/v2/renders`), Next.js 16, Supabase, BullMQ

**Design Doc:** `docs/plans/2026-02-15-tier1-mvp-completion-design.md`

---

### Task 1: Enable full 4-segment production mode

Change `TEST_SEGMENTS` from `[0]` to `[0, 1, 2, 3]` in all three agent files.

**Files:**
- Modify: `src/agents/casting-agent.ts:8`
- Modify: `src/agents/director-agent.ts:6`
- Modify: `src/agents/voiceover-agent.ts:7`

**Step 1: Update casting-agent.ts**

Change line 8 from:
```typescript
const TEST_SEGMENTS = [0];
```
to:
```typescript
const SEGMENTS = [0, 1, 2, 3];
```

Also rename all references from `TEST_SEGMENTS` to `SEGMENTS` in the file (line 66: `for (const segIdx of SEGMENTS)`).

**Step 2: Update director-agent.ts**

Same change at line 6, and rename reference at line 43.

**Step 3: Update voiceover-agent.ts**

Same change at line 7, and rename reference in the for loop.

**Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 5: Commit**

```bash
git add src/agents/casting-agent.ts src/agents/director-agent.ts src/agents/voiceover-agent.ts
git commit -m "feat: enable full 4-segment production mode"
```

---

### Task 2: Add retry logic to DirectorAgent

Wrap the video generation + poll in a retry loop. On failure after retries, mark the asset as `failed` and continue with remaining segments.

**Files:**
- Modify: `src/agents/director-agent.ts`

**Step 1: Add retry wrapper**

Replace the video generation block (lines 81-115, the section from `this.log('Generating video...')` through the poll and asset update) with a retry loop:

```typescript
      // Generate video with retry logic
      const maxRetries = 2;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            this.log(`Retry ${attempt}/${maxRetries} for segment ${segIdx} after 10s delay...`);
            await new Promise(resolve => setTimeout(resolve, 10000));
          }

          this.log(`Generating video for segment ${segIdx} (attempt ${attempt + 1})`);

          const result = await this.wavespeed.generateVideo({
            image: startKeyframe.url,
            tailImage: endKeyframe?.url,
            prompt: mainPrompt,
            negativePrompt,
            multiPrompt,
            duration: 15,
            cfgScale: 0.5,
          });

          // Create asset row
          await this.supabase.from('asset').insert({
            project_id: projectId,
            scene_id: scene.id,
            type: 'video',
            provider: 'kling-3.0-pro',
            provider_task_id: result.taskId,
            status: 'generating',
            cost_usd: API_COSTS.klingVideo,
          });

          // Poll until complete (up to 5 minutes)
          this.log(`Polling video task ${result.taskId} (up to 5 min)...`);
          const pollResult = await this.wavespeed.pollResult(result.taskId);

          // Update asset with URL
          await this.supabase
            .from('asset')
            .update({ url: pollResult.url || '', status: 'completed' })
            .eq('provider_task_id', result.taskId);

          await this.trackCost(projectId, API_COSTS.klingVideo);
          this.log(`Video complete for segment ${segIdx}: ${pollResult.url}`);
          lastError = null;
          break; // Success, exit retry loop

        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          this.log(`Video generation failed for segment ${segIdx}: ${lastError.message}`);
        }
      }

      // If all retries failed, mark asset as failed and continue
      if (lastError) {
        this.log(`All retries exhausted for segment ${segIdx}, marking as failed`);
        await this.supabase.from('asset').insert({
          project_id: projectId,
          scene_id: scene.id,
          type: 'video',
          provider: 'kling-3.0-pro',
          status: 'failed',
          cost_usd: 0,
        });
      }
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/agents/director-agent.ts
git commit -m "feat: add retry logic to DirectorAgent (max 2 retries)"
```

---

### Task 3: Create Creatomate API client

**Files:**
- Create: `src/lib/api-clients/creatomate.ts`
- Modify: `src/lib/constants.ts` (add `creatomateRender` to API_COSTS)

**Step 1: Create the Creatomate client**

Create `src/lib/api-clients/creatomate.ts`:

```typescript
export interface RenderOptions {
  templateId: string;
  modifications: Record<string, string>;
  maxWidth?: number;
  maxHeight?: number;
}

export interface RenderResult {
  id: string;
  status: string;
  url?: string;
}

export class CreatomateClient {
  private apiKey: string;
  private baseUrl = 'https://api.creatomate.com/v2';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.CREATOMATE_API_KEY || '';
    if (!this.apiKey) {
      console.warn('CreatomateClient: No API key provided');
    }
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Creatomate API error (${response.status}): ${error}`);
    }

    return response.json();
  }

  async renderVideo(options: RenderOptions): Promise<RenderResult> {
    const body: Record<string, unknown> = {
      template_id: options.templateId,
      modifications: options.modifications,
    };

    if (options.maxWidth) body.max_width = options.maxWidth;
    if (options.maxHeight) body.max_height = options.maxHeight;

    const data = await this.request('/renders', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    // Creatomate returns an array of renders
    const render = Array.isArray(data) ? data[0] : data;
    return {
      id: render.id,
      status: render.status,
      url: render.url,
    };
  }

  async getRenderStatus(renderId: string): Promise<RenderResult> {
    const data = await this.request(`/renders/${renderId}`);
    return {
      id: data.id,
      status: data.status,
      url: data.url,
    };
  }

  async pollRender(
    renderId: string,
    options?: { maxWait?: number; interval?: number }
  ): Promise<RenderResult> {
    const maxWait = options?.maxWait ?? 300000; // 5 minutes
    const interval = options?.interval ?? 5000;  // 5 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const result = await this.getRenderStatus(renderId);

      if (result.status === 'succeeded') {
        return result;
      }

      if (result.status === 'failed') {
        throw new Error(`Creatomate render ${renderId} failed`);
      }

      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(`Creatomate render ${renderId} timed out after ${maxWait / 1000}s`);
  }
}
```

**Step 2: Add cost constant**

In `src/lib/constants.ts`, add `creatomateRender` to `API_COSTS`:

```typescript
export const API_COSTS = {
  wavespeedChat: 0.01,
  nanoBananaPro: 0.07,
  nanoBananaProEdit: 0.07,
  klingVideo: 1.20,
  elevenLabsTts: 0.05,
  creatomateRender: 0.50,
} as const;
```

**Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/lib/api-clients/creatomate.ts src/lib/constants.ts
git commit -m "feat: add Creatomate API client for video rendering"
```

---

### Task 4: Create EditorAgent

The EditorAgent fetches all completed video + audio assets for a project, maps them to Creatomate template slots, renders the final composed video, and stores it as a `final_video` asset.

**Files:**
- Create: `src/agents/editor-agent.ts`

**Step 1: Create the agent**

Create `src/agents/editor-agent.ts`:

```typescript
import { SupabaseClient } from '@supabase/supabase-js';
import { BaseAgent } from './base-agent';
import { CreatomateClient } from '@/lib/api-clients/creatomate';
import { CREATOMATE_TEMPLATE_ID, API_COSTS } from '@/lib/constants';

export class EditorAgent extends BaseAgent {
  private creatomate: CreatomateClient;

  constructor(supabaseClient?: SupabaseClient) {
    super('EditorAgent', supabaseClient);
    this.creatomate = new CreatomateClient();
  }

  async run(projectId: string): Promise<void> {
    this.log(`Starting editing for project ${projectId}`);

    // 1. Fetch all completed video and audio assets
    const { data: assets, error } = await this.supabase
      .from('asset')
      .select('*, scene:scene(segment_index)')
      .eq('project_id', projectId)
      .in('type', ['video', 'audio'])
      .eq('status', 'completed');

    if (error) throw new Error(`Failed to fetch assets: ${error.message}`);
    if (!assets || assets.length === 0) throw new Error('No completed assets found');

    // 2. Build modifications map for Creatomate template
    const modifications: Record<string, string> = {};

    for (const asset of assets) {
      const segIdx = asset.scene?.segment_index;
      if (segIdx === null || segIdx === undefined) continue;
      if (!asset.url) continue;

      const slotNum = segIdx + 1; // Template uses 1-based numbering

      if (asset.type === 'video') {
        modifications[`Video-${slotNum}`] = asset.url;
      } else if (asset.type === 'audio') {
        modifications[`Audio-${slotNum}`] = asset.url;
      }
    }

    this.log(`Template modifications: ${JSON.stringify(Object.keys(modifications))}`);

    // Verify we have at least 1 video
    const videoCount = Object.keys(modifications).filter(k => k.startsWith('Video-')).length;
    if (videoCount === 0) throw new Error('No video assets to compose');

    // 3. Start Creatomate render
    this.log('Starting Creatomate render...');
    const render = await this.creatomate.renderVideo({
      templateId: CREATOMATE_TEMPLATE_ID,
      modifications,
    });

    // 4. Create asset row for final video
    await this.supabase.from('asset').insert({
      project_id: projectId,
      type: 'final_video',
      provider: 'creatomate',
      provider_task_id: render.id,
      status: 'generating',
      cost_usd: API_COSTS.creatomateRender,
    });

    // 5. Poll until complete
    this.log(`Polling Creatomate render ${render.id}...`);
    const result = await this.creatomate.pollRender(render.id);

    // 6. Update asset with final URL
    await this.supabase
      .from('asset')
      .update({ url: result.url || '', status: 'completed' })
      .eq('provider_task_id', render.id);

    await this.trackCost(projectId, API_COSTS.creatomateRender);
    this.log(`Editing complete for project ${projectId}: ${result.url}`);
  }
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/agents/editor-agent.ts
git commit -m "feat: add EditorAgent for final video composition via Creatomate"
```

---

### Task 5: Wire EditorAgent into pipeline worker + approve route

The pipeline worker needs an `editing` handler that runs EditorAgent. The approve route needs to enqueue the editing job instead of just setting status.

**Files:**
- Modify: `src/workers/pipeline.worker.ts`
- Modify: `src/app/api/projects/[id]/approve/route.ts`

**Step 1: Add editing handler to pipeline worker**

In `src/workers/pipeline.worker.ts`:

Add import at top (after VoiceoverAgent import):
```typescript
import { EditorAgent } from '../agents/editor-agent';
```

Add `editing` case in the worker job handler (after the voiceover else-if, before the else):
```typescript
    } else if (step === 'editing') {
      await handleEditing(projectId);
    } else {
```

Add the handler function (after `handleVoiceover`):
```typescript
async function handleEditing(projectId: string) {
  try {
    await supabase
      .from('project')
      .update({ status: 'editing', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    const agent = new EditorAgent(supabase);
    await agent.run(projectId);

    await supabase
      .from('project')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    console.log(`[Worker] Editing complete for project ${projectId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Worker] Editing failed for project ${projectId}:`, errorMessage);

    await supabase
      .from('project')
      .update({
        status: 'failed',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    throw error;
  }
}
```

**Step 2: Update approve route to enqueue editing**

In `src/app/api/projects/[id]/approve/route.ts`, replace the `asset_review` special case (lines 42-58) so it enqueues an editing job instead of just setting status:

Replace:
```typescript
    // Handle asset_review as a special case (Phase 4 placeholder -- no job to enqueue yet)
    if (proj.status === 'asset_review') {
      const { error: updateError } = await supabase
        .from('project')
        .update({ status: 'editing' })
        .eq('id', id);

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({
        message: 'Approved. Status set to "editing".',
        projectId: id,
        previousStatus: proj.status,
        nextStep: 'editing',
      });
    }
```

With:
```typescript
    // Handle asset_review -> enqueue editing job
    if (proj.status === 'asset_review') {
      await getPipelineQueue().add('editing', {
        projectId: id,
        step: 'editing',
      });

      return NextResponse.json({
        message: 'Approved. Enqueued "editing" step.',
        projectId: id,
        previousStatus: proj.status,
        nextStep: 'editing',
      });
    }
```

**Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/workers/pipeline.worker.ts src/app/api/projects/[id]/approve/route.ts
git commit -m "feat: wire EditorAgent into pipeline worker and approve route"
```

---

### Task 6: Create `completed_run` table

**Database migration via Supabase MCP.**

**Step 1: Create the table**

Apply migration via `mcp__supabase__apply_migration`:

```sql
CREATE TABLE completed_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES project(id),
  product_data jsonb,
  script_snapshot jsonb,
  tone text,
  character_name text,
  influencer_name text,
  hook_score integer,
  asset_urls jsonb,
  final_video_url text,
  total_cost_usd numeric(10,4),
  created_at timestamptz DEFAULT now()
);
```

---

### Task 7: Create archive API route

**Files:**
- Create: `src/app/api/projects/[id]/archive/route.ts`

**Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';

/**
 * POST /api/projects/[id]/archive
 *
 * Snapshots a completed project as an immutable run record.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // 1. Fetch project with relations
    const { data: project, error: projError } = await supabase
      .from('project')
      .select('*, character:ai_character(name), influencer:influencer(name)')
      .eq('id', id)
      .single();

    if (projError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.status !== 'completed') {
      return NextResponse.json(
        { error: 'Project must be completed before archiving' },
        { status: 400 }
      );
    }

    // 2. Fetch the latest script with scenes
    const { data: scripts } = await supabase
      .from('script')
      .select('*, scenes:scene(*)')
      .eq('project_id', id)
      .order('version', { ascending: false })
      .limit(1);

    const script = scripts?.[0];

    // 3. Fetch all assets
    const { data: assets } = await supabase
      .from('asset')
      .select('type, url, cost_usd')
      .eq('project_id', id)
      .eq('status', 'completed');

    // Build asset URLs map
    const assetUrls: Record<string, string[]> = {};
    let finalVideoUrl = '';
    for (const asset of assets || []) {
      if (asset.type === 'final_video') {
        finalVideoUrl = asset.url || '';
      }
      if (!assetUrls[asset.type]) assetUrls[asset.type] = [];
      if (asset.url) assetUrls[asset.type].push(asset.url);
    }

    // 4. Build script snapshot
    const scriptSnapshot = script ? {
      version: script.version,
      tone: script.tone,
      hook_score: script.hook_score,
      segments: (script.scenes || []).map((s: any) => ({
        segment_index: s.segment_index,
        section: s.section,
        script_text: s.script_text,
        text_overlay: s.text_overlay,
      })),
    } : null;

    // 5. Insert completed_run
    const { data: run, error: insertError } = await supabase
      .from('completed_run')
      .insert({
        project_id: id,
        product_data: project.product_data,
        script_snapshot: scriptSnapshot,
        tone: script?.tone,
        character_name: project.character?.name || null,
        influencer_name: project.influencer?.name || null,
        hook_score: script?.hook_score,
        asset_urls: assetUrls,
        final_video_url: finalVideoUrl,
        total_cost_usd: project.cost_usd,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json(run, { status: 201 });
  } catch (error) {
    console.error('Error archiving project:', error);
    return NextResponse.json(
      { error: 'Failed to archive project' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/api/projects/[id]/archive/route.ts
git commit -m "feat: add archive API route for completed runs"
```

---

### Task 8: Final review UI in project detail

When the project status is `completed`, show a final review section with: video player for the composed video, download button, recipe summary, and archive button.

**IMPORTANT:** This task touches `.tsx` files. You MUST use the `frontend-designer` skill per CLAUDE.md.

**Files:**
- Modify: `src/components/project-detail.tsx`

**Step 1: Add completed status rendering**

In `project-detail.tsx`, find where statuses are rendered (the status-based conditional blocks). Add a new block for `completed` status that renders:

1. **Video player** — fetch the `final_video` asset URL, display in a `<video>` element with controls, 9:16 aspect ratio
2. **Download button** — `<a href={videoUrl} download>` styled as primary button
3. **Recipe summary** — product name, tone, character/influencer, hook score, total cost
4. **Archive button** — POSTs to `/api/projects/{id}/archive`, shows success message

The component needs to:
- Fetch assets from `/api/projects/${id}/assets` and find the `final_video` type
- Add `'editing'` to the processingStatuses array for polling (it's already there from the audit)
- Show a loading spinner while in `editing` status
- Show the final review when status is `completed`

**Key UI elements:**
```tsx
{/* Final Review - when status is 'completed' */}
{project.status === 'completed' && (
  <div className="space-y-6">
    <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-text-primary">
      Final Video
    </h2>

    {/* Video player */}
    {finalVideoUrl ? (
      <div className="mx-auto max-w-sm">
        <video
          src={finalVideoUrl}
          controls
          className="w-full rounded-xl border border-border aspect-[9/16]"
        />
      </div>
    ) : (
      <p className="text-text-muted">No final video found.</p>
    )}

    {/* Actions */}
    <div className="flex gap-3">
      {finalVideoUrl && (
        <a
          href={finalVideoUrl}
          download
          className="inline-flex items-center gap-2 rounded-lg bg-electric px-4 py-2 font-[family-name:var(--font-display)] text-sm font-semibold text-void"
        >
          Download Video
        </a>
      )}
      <button
        onClick={handleArchive}
        disabled={archived}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 font-[family-name:var(--font-display)] text-sm font-medium text-text-secondary hover:text-electric disabled:opacity-50"
      >
        {archived ? 'Archived' : 'Archive Run'}
      </button>
    </div>

    {/* Recipe summary */}
    <div className="glass rounded-xl border border-border p-6">
      <h3 className="mb-4 font-[family-name:var(--font-display)] text-sm font-semibold text-text-secondary uppercase tracking-wider">
        Recipe
      </h3>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-text-muted">Product</dt>
          <dd className="text-text-primary">{project.product_name || '—'}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Tone</dt>
          <dd className="text-text-primary">{project.tone || '—'}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Total Cost</dt>
          <dd className="text-electric">${parseFloat(project.cost_usd || '0').toFixed(2)}</dd>
        </div>
      </dl>
    </div>
  </div>
)}
```

Add state and handler for archiving:
```tsx
const [archived, setArchived] = useState(false);
const [finalVideoUrl, setFinalVideoUrl] = useState('');

// Fetch final video URL when status is completed
useEffect(() => {
  if (project?.status === 'completed') {
    fetch(`/api/projects/${project.id}/assets`)
      .then(r => r.json())
      .then(data => {
        const segments = data.segments || [];
        for (const seg of segments) {
          for (const asset of seg.assets || []) {
            if (asset.type === 'final_video' && asset.url) {
              setFinalVideoUrl(asset.url);
            }
          }
        }
        // Also check ungrouped assets
        if (data.assets) {
          for (const asset of data.assets) {
            if (asset.type === 'final_video' && asset.url) {
              setFinalVideoUrl(asset.url);
            }
          }
        }
      });
  }
}, [project?.status, project?.id]);

async function handleArchive() {
  const res = await fetch(`/api/projects/${project.id}/archive`, { method: 'POST' });
  if (res.ok) setArchived(true);
}
```

**Step 2: Add editing status processing indicator**

Make sure the `editing` status shows a processing indicator (similar to casting/directing/voiceover). Check if this is already handled — if not, add it.

**Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/components/project-detail.tsx
git commit -m "feat: add final review UI with video player, download, and archive"
```

---

## Verification Checklist

| # | Test | Expected |
|---|------|----------|
| 1 | `npm run build` | Compiles cleanly |
| 2 | All 3 agents process segments 0-3 | `SEGMENTS = [0,1,2,3]` in each |
| 3 | DirectorAgent retries on failure | Max 2 retries with 10s delay |
| 4 | DirectorAgent continues after segment failure | Other segments still process |
| 5 | Creatomate client renders video | POST to `/v2/renders`, polls status |
| 6 | EditorAgent stitches segments | Maps to template slots, polls render |
| 7 | Pipeline worker handles `editing` step | Runs EditorAgent, sets `completed` |
| 8 | Approve at `asset_review` enqueues editing | Not just status change |
| 9 | `completed_run` table exists | Migration applied |
| 10 | Archive API snapshots recipe | POST `/api/projects/[id]/archive` |
| 11 | Final review shows video player | When status is `completed` |
| 12 | Download button works | Direct link to video URL |
| 13 | Archive button creates record | Inserts into `completed_run` |
