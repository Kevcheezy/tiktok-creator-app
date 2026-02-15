# Phase 2: ScriptingAgent + Frontend Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the ScriptingAgent (pipeline stage 2) with human-in-the-loop script review, and redesign the entire frontend using the `frontend-designer` skill.

**Architecture:** ScriptingAgent extends BaseAgent, calls WaveSpeed LLM with a structured system prompt, validates syllable counts and hook scores, saves 1 script + 4 scene rows. A new `approve` API endpoint bridges pipeline stages. The frontend gets a complete visual overhaul via the `frontend-designer` skill.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS v4, Supabase JS, BullMQ, WaveSpeed Any-LLM API

---

## Agent A: ScriptingAgent Backend

### Task A1: Update project status lifecycle

**Files:**
- Modify: `src/lib/constants.ts`

**Step 1: Add review statuses**

Add `analysis_review` and `script_review` to the status lifecycle. These are human-in-the-loop pause points.

```typescript
// In constants.ts, replace PROJECT_STATUSES:
export const PROJECT_STATUSES = [
  'created',
  'analyzing',
  'analysis_review',
  'scripting',
  'script_review',
  'casting',
  'directing',
  'editing',
  'completed',
  'failed',
] as const;
```

**Step 2: Update the worker to use `analysis_review` instead of `completed`**

In `src/workers/pipeline.worker.ts`, in `handleProductAnalysis()`, change:
```typescript
// Change this line:
status: 'completed',
// To:
status: 'analysis_review',
```

This means after product analysis, the project pauses for human review instead of going straight to "completed".

**Step 3: Update status-badge.tsx**

Add the two new statuses to `STATUS_CONFIG`:
```typescript
analysis_review: { label: 'Review Analysis', className: 'bg-emerald-100 text-emerald-700' },
script_review: { label: 'Review Script', className: 'bg-emerald-100 text-emerald-700' },
```

**Step 4: Commit**

```bash
git add src/lib/constants.ts src/workers/pipeline.worker.ts src/components/status-badge.tsx
git commit -m "feat: add analysis_review and script_review pipeline statuses"
```

---

### Task A2: Create ScriptingAgent

**Files:**
- Create: `src/agents/scripting-agent.ts`

**Step 1: Write the ScriptingAgent**

The system prompt is ported from the predecessor's Agent 1 (Script Architect). The agent:
1. Fetches project + product_data from Supabase
2. Optionally selects a matching script template
3. Calls WaveSpeed LLM
4. Parses JSON response
5. Validates syllables (programmatic counter), shot_scripts count, hook score
6. Saves 1 `script` row + 4 `scene` rows

```typescript
import { SupabaseClient } from '@supabase/supabase-js';
import { BaseAgent } from './base-agent';
import {
  API_COSTS,
  PIPELINE_CONFIG,
  ENERGY_ARC,
  PRODUCT_PLACEMENT_ARC,
} from '@/lib/constants';

// --- Types ---

interface ShotScript {
  index: number;
  text: string;
  energy: string;
}

interface AudioSync {
  shot_1_peak: { word: string; time: string; action: string };
  shot_2_peak: { word: string; time: string; action: string };
  shot_3_peak: { word: string; time: string; action: string };
}

interface ScriptSegment {
  id: number;
  section: string;
  script_text: string;
  syllable_count: number;
  energy: { start: string; middle: string; end: string };
  shot_scripts: ShotScript[];
  audio_sync: AudioSync;
  text_overlay: string;
  key_moment: string;
}

interface HookScore {
  curiosity_loop: number;
  challenges_belief: number;
  clear_context: number;
  plants_question: number;
  pattern_interrupt: number;
  emotional_trigger: number;
  specific_claim: number;
  total: number;
}

interface ScriptOutput {
  segments: ScriptSegment[];
  hook_score: HookScore;
  total_syllables: number;
}

// --- Syllable Counter (ported from predecessor validate-script) ---

function countSyllables(text: string): number {
  const word = text.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;

  let count = 0;
  const vowels = 'aeiouy';
  let prevIsVowel = false;

  for (let i = 0; i < word.length; i++) {
    const isVowel = vowels.includes(word[i]);
    if (isVowel && !prevIsVowel) count++;
    prevIsVowel = isVowel;
  }

  // Handle silent e
  if (word.endsWith('e') && count > 1) count--;
  // Handle -le endings
  if (word.endsWith('le') && word.length > 2 && !vowels.includes(word[word.length - 3])) count++;

  return Math.max(1, count);
}

function countTextSyllables(text: string): number {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  return words.reduce((sum, word) => sum + countSyllables(word), 0);
}

// --- System Prompt ---

const SYSTEM_PROMPT = `You are a Script Architect for TikTok Shop UGC videos.

CREATE A 4-SEGMENT SCRIPT for a 60-second video.

RULES:
1. Each segment = 15 seconds, 82-90 syllables
2. Each segment will be split into 3 shots of 5 seconds each for Kling 3.0 multi-shot
3. SEGMENT STRUCTURE (4 segments):
   - Segment 1 (HOOK): HIGH energy throughout, NO product, open curiosity loop
   - Segment 2 (PROBLEM): LOW→PEAK→LOW energy, subtle product mention
   - Segment 3 (SOLUTION + PRODUCT): LOW→PEAK→LOW energy, product as solution, hero moment, features
   - Segment 4 (CTA): LOW→PEAK→LOW energy, urgency, call to action

4. SHOT_SCRIPTS: For each segment, split the script into 3 roughly equal portions (one per 5s shot).
   Each shot_script maps to a Kling 3.0 multi-shot prompt.

5. AUDIO SYNC POINTS (REQUIRED for each segment):
   Identify 3 key words/phrases for gesture timing, one per shot:
   - shot_1_peak (~3s): Word where speaker makes confident opening gesture
   - shot_2_peak (~8s): Word where speaker makes emphasis gesture
   - shot_3_peak (~13s): Word where speaker transitions to calm/curious expression

6. HOOK SCORING (must score >=10/14):
   - Opens curiosity loop? (0-2)
   - Challenges common belief? (0-2)
   - Context immediately clear? (0-2)
   - Plants question in mind? (0-2)
   - Uses pattern interrupt? (0-2)
   - Emotional trigger word? (0-2)
   - Specific number/claim? (0-2)

OUTPUT FORMAT (valid JSON only, no markdown, no code fences):
{
  "segments": [
    {
      "id": 1,
      "section": "Hook",
      "script_text": "full 15s spoken words...",
      "syllable_count": 85,
      "energy": { "start": "HIGH", "middle": "HIGH", "end": "HIGH" },
      "shot_scripts": [
        { "index": 0, "text": "first 5s portion...", "energy": "HIGH" },
        { "index": 1, "text": "middle 5s portion...", "energy": "HIGH" },
        { "index": 2, "text": "final 5s portion...", "energy": "HIGH" }
      ],
      "audio_sync": {
        "shot_1_peak": { "word": "keyword", "time": "~3s", "action": "confident gesture" },
        "shot_2_peak": { "word": "keyword", "time": "~8s", "action": "hand on chest" },
        "shot_3_peak": { "word": "keyword", "time": "~13s", "action": "lean + curious" }
      },
      "text_overlay": "short caption for screen",
      "key_moment": "description of peak moment"
    }
  ],
  "hook_score": {
    "curiosity_loop": 2,
    "challenges_belief": 1,
    "clear_context": 2,
    "plants_question": 2,
    "pattern_interrupt": 1,
    "emotional_trigger": 2,
    "specific_claim": 2,
    "total": 12
  },
  "total_syllables": 345
}`;

// --- Agent ---

export class ScriptingAgent extends BaseAgent {
  constructor(supabaseClient?: SupabaseClient) {
    super('ScriptingAgent', supabaseClient);
  }

  async run(projectId: string): Promise<ScriptOutput> {
    this.log(`Starting script generation for project ${projectId}`);

    // 1. Fetch project with product data
    const { data: proj, error } = await this.supabase
      .from('project')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error || !proj) {
      throw new Error(`Project not found: ${projectId}`);
    }

    if (!proj.product_data) {
      throw new Error(`Project ${projectId} has no product analysis data`);
    }

    const productData = proj.product_data as Record<string, unknown>;

    // 2. Optionally find a matching script template
    let hookPattern = '';
    const { data: templates } = await this.supabase
      .from('script_template')
      .select('*')
      .contains('categories', [proj.product_category])
      .order('times_used', { ascending: true })
      .limit(1);

    if (templates && templates.length > 0) {
      const tmpl = templates[0];
      hookPattern = `\nUSE THIS HOOK PATTERN:\nType: ${tmpl.hook_type}\nText Template: ${tmpl.text_hook_template}\nSpoken Template: ${tmpl.spoken_hook_template}\nEnergy Arc: ${JSON.stringify(tmpl.energy_arc)}`;

      // Increment usage count
      await this.supabase
        .from('script_template')
        .update({ times_used: (tmpl.times_used || 0) + 1 })
        .eq('id', tmpl.id);

      // Link template to project
      await this.supabase
        .from('project')
        .update({ script_template_id: tmpl.id })
        .eq('id', projectId);

      this.log(`Using hook template: ${tmpl.name} (${tmpl.hook_type})`);
    }

    // 3. Build user prompt
    const sellingPoints = Array.isArray(productData.selling_points)
      ? (productData.selling_points as string[]).map((p: string, i: number) => `${i + 1}. ${p}`).join('\n')
      : '';

    const userPrompt = `PRODUCT: ${productData.product_name}
CATEGORY: ${proj.product_category}
SELLING POINTS:
${sellingPoints}
HOOK ANGLE: ${productData.hook_angle}
${hookPattern}
${proj.video_url ? `\nREFERENCE VIDEO (analyze structure): ${proj.video_url}` : '\nMODE: Generate from scratch using proven hook formula'}`;

    // 4. Call WaveSpeed LLM
    this.log('Calling WaveSpeed LLM for script generation...');
    let rawResponse: string;
    try {
      rawResponse = await this.wavespeed.chatCompletion(SYSTEM_PROMPT, userPrompt, {
        temperature: 0.7,
        maxTokens: 4096,
      });
    } catch (err) {
      throw new Error(`LLM call failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 5. Parse JSON response
    this.log('Parsing LLM response...');
    let scriptData: ScriptOutput;
    try {
      const cleaned = rawResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      scriptData = JSON.parse(cleaned);
    } catch (err) {
      throw new Error(
        `Failed to parse script JSON: ${err instanceof Error ? err.message : String(err)}\nRaw: ${rawResponse.substring(0, 500)}`
      );
    }

    // Support 'chunks' alias
    if (!scriptData.segments && (scriptData as Record<string, unknown>).chunks) {
      scriptData.segments = (scriptData as Record<string, unknown>).chunks as ScriptSegment[];
    }

    // 6. Validate
    this.log('Validating script...');
    const validationErrors: string[] = [];

    if (!scriptData.segments || scriptData.segments.length !== PIPELINE_CONFIG.segmentCount) {
      validationErrors.push(`Expected ${PIPELINE_CONFIG.segmentCount} segments, got ${scriptData.segments?.length || 0}`);
    }

    for (const seg of scriptData.segments || []) {
      const actualSyllables = countTextSyllables(seg.script_text);
      seg.syllable_count = actualSyllables; // Override LLM's count with programmatic count

      if (actualSyllables < PIPELINE_CONFIG.syllablesPerSegment.errorMin ||
          actualSyllables > PIPELINE_CONFIG.syllablesPerSegment.errorMax) {
        validationErrors.push(`Segment ${seg.id} has ${actualSyllables} syllables (must be ${PIPELINE_CONFIG.syllablesPerSegment.errorMin}-${PIPELINE_CONFIG.syllablesPerSegment.errorMax})`);
      }

      if (!seg.shot_scripts || seg.shot_scripts.length !== PIPELINE_CONFIG.shotsPerSegment) {
        validationErrors.push(`Segment ${seg.id} has ${seg.shot_scripts?.length || 0} shot_scripts (must be ${PIPELINE_CONFIG.shotsPerSegment})`);
      }
    }

    const hookTotal = scriptData.hook_score?.total || 0;
    if (hookTotal < PIPELINE_CONFIG.hookScoreMinimum) {
      validationErrors.push(`Hook score ${hookTotal} is below minimum ${PIPELINE_CONFIG.hookScoreMinimum}`);
    }

    if (validationErrors.length > 0) {
      this.log(`Validation warnings: ${validationErrors.join('; ')}`);
      // Don't throw — save with warnings, let human review
    }

    // 7. Save to database
    this.log('Saving script to database...');

    // Insert script row
    const { data: scriptRow, error: scriptError } = await this.supabase
      .from('script')
      .insert({
        project_id: projectId,
        version: 1,
        hook_score: hookTotal,
        full_text: scriptData.segments.map((s) => s.script_text).join('\n\n'),
      })
      .select()
      .single();

    if (scriptError || !scriptRow) {
      throw new Error(`Failed to save script: ${scriptError?.message}`);
    }

    // Insert 4 scene rows
    const sections = ['Hook', 'Problem', 'Solution + Product', 'CTA'];
    for (const seg of scriptData.segments) {
      const segIndex = seg.id;
      const energyArc = ENERGY_ARC[segIndex - 1];
      const placement = PRODUCT_PLACEMENT_ARC[segIndex - 1];

      const { error: sceneError } = await this.supabase
        .from('scene')
        .insert({
          script_id: scriptRow.id,
          segment_index: segIndex,
          section: sections[segIndex - 1] || seg.section,
          script_text: seg.script_text,
          syllable_count: seg.syllable_count,
          energy_arc: seg.energy || energyArc?.pattern,
          shot_scripts: seg.shot_scripts,
          audio_sync: seg.audio_sync,
          text_overlay: seg.text_overlay,
          product_visibility: placement?.visibility || null,
        });

      if (sceneError) {
        this.log(`Warning: Failed to save scene ${segIndex}: ${sceneError.message}`);
      }
    }

    // 8. Track cost
    await this.trackCost(projectId, API_COSTS.wavespeedChat);

    this.log(`Script generation complete. Hook score: ${hookTotal}/14, Total syllables: ${scriptData.total_syllables}`);
    return scriptData;
  }
}
```

**Step 2: Commit**

```bash
git add src/agents/scripting-agent.ts
git commit -m "feat: add ScriptingAgent with syllable validation and hook scoring"
```

---

### Task A3: Add scripting handler to worker

**Files:**
- Modify: `src/workers/pipeline.worker.ts`

**Step 1: Import ScriptingAgent and add handler**

Add import at top:
```typescript
import { ScriptingAgent } from '../agents/scripting-agent';
```

Add to the worker's job handler (after the `product_analysis` if-block):
```typescript
    } else if (step === 'scripting') {
      await handleScripting(projectId);
    } else {
```

Add the handler function:
```typescript
async function handleScripting(projectId: string) {
  try {
    await supabase
      .from('project')
      .update({ status: 'scripting', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    const agent = new ScriptingAgent(supabase);
    const result = await agent.run(projectId);

    await supabase
      .from('project')
      .update({
        status: 'script_review',
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    console.log(`[Worker] Script generation complete for project ${projectId}, hook score: ${result.hook_score.total}/14`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Worker] Script generation failed for project ${projectId}:`, errorMessage);

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

**Step 2: Commit**

```bash
git add src/workers/pipeline.worker.ts
git commit -m "feat: add scripting step handler to pipeline worker"
```

---

### Task A4: Create approve and script API routes

**Files:**
- Create: `src/app/api/projects/[id]/approve/route.ts`
- Create: `src/app/api/projects/[id]/scripts/route.ts`
- Create: `src/app/api/projects/[id]/scripts/[scriptId]/route.ts`
- Create: `src/app/api/projects/[id]/scripts/[scriptId]/regenerate/route.ts`

**Step 1: Create approve endpoint**

`src/app/api/projects/[id]/approve/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { getPipelineQueue } from '@/lib/queue';

// Map current review status to next pipeline step
const NEXT_STEP: Record<string, { step: string; status: string }> = {
  analysis_review: { step: 'scripting', status: 'scripting' },
  script_review: { step: 'casting', status: 'casting' },
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: proj, error } = await supabase
    .from('project')
    .select('status')
    .eq('id', id)
    .single();

  if (error || !proj) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const next = NEXT_STEP[proj.status];
  if (!next) {
    return NextResponse.json(
      { error: `Cannot approve project in "${proj.status}" status. Must be in a review state.` },
      { status: 400 }
    );
  }

  // Enqueue next pipeline step
  await getPipelineQueue().add(next.step, {
    projectId: id,
    step: next.step as 'scripting' | 'casting' | 'directing' | 'editing',
  });

  return NextResponse.json({ success: true, nextStep: next.step });
}
```

**Step 2: Create scripts list endpoint**

`src/app/api/projects/[id]/scripts/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: scripts, error } = await supabase
    .from('script')
    .select('*, scenes:scene(*)')
    .eq('project_id', id)
    .order('version', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch scripts' }, { status: 500 });
  }

  // Sort scenes by segment_index within each script
  for (const script of scripts || []) {
    if (script.scenes) {
      script.scenes.sort((a: { segment_index: number }, b: { segment_index: number }) => a.segment_index - b.segment_index);
    }
  }

  return NextResponse.json(scripts || []);
}
```

**Step 3: Create script grade/feedback endpoint**

`src/app/api/projects/[id]/scripts/[scriptId]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; scriptId: string }> }
) {
  const { scriptId } = await params;

  try {
    const body = await request.json();
    const { grade, feedback, is_favorite } = body;

    const updateData: Record<string, unknown> = {};
    if (grade !== undefined) updateData.grade = grade;
    if (feedback !== undefined) updateData.feedback = feedback;
    if (is_favorite !== undefined) updateData.is_favorite = is_favorite;

    const { data, error } = await supabase
      .from('script')
      .update(updateData)
      .eq('id', scriptId)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Script not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Error updating script:', err);
    return NextResponse.json({ error: 'Failed to update script' }, { status: 500 });
  }
}
```

**Step 4: Create regenerate endpoint**

`src/app/api/projects/[id]/scripts/[scriptId]/regenerate/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { getPipelineQueue } from '@/lib/queue';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; scriptId: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const feedback = body.feedback || '';

    // Store feedback on the current script if provided
    if (feedback) {
      const { scriptId } = await params;
      await supabase
        .from('script')
        .update({ feedback })
        .eq('id', scriptId);
    }

    // Re-enqueue scripting step
    await getPipelineQueue().add('scripting', {
      projectId: id,
      step: 'scripting',
    });

    // Update project status back to scripting
    await supabase
      .from('project')
      .update({ status: 'scripting', updated_at: new Date().toISOString() })
      .eq('id', id);

    return NextResponse.json({ success: true, message: 'Script regeneration queued' });
  } catch (err) {
    console.error('Error regenerating script:', err);
    return NextResponse.json({ error: 'Failed to regenerate script' }, { status: 500 });
  }
}
```

**Step 5: Commit**

```bash
git add src/app/api/projects/[id]/approve/route.ts \
  src/app/api/projects/[id]/scripts/route.ts \
  src/app/api/projects/[id]/scripts/[scriptId]/route.ts \
  src/app/api/projects/[id]/scripts/[scriptId]/regenerate/route.ts
git commit -m "feat: add approve, scripts list, grade, and regenerate API routes"
```

---

### Task A5: Handle script versioning in ScriptingAgent

**Files:**
- Modify: `src/agents/scripting-agent.ts`

When regenerating, the agent should increment the version number. In the `run()` method, before inserting the script row, query for the latest version:

```typescript
    // Before inserting script row, get latest version
    const { data: existingScripts } = await this.supabase
      .from('script')
      .select('version')
      .eq('project_id', projectId)
      .order('version', { ascending: false })
      .limit(1);

    const nextVersion = (existingScripts?.[0]?.version || 0) + 1;

    // Insert script row (use nextVersion instead of hardcoded 1)
    const { data: scriptRow, error: scriptError } = await this.supabase
      .from('script')
      .insert({
        project_id: projectId,
        version: nextVersion,
        // ...rest stays the same
```

**Step 2: Commit**

```bash
git add src/agents/scripting-agent.ts
git commit -m "feat: support script versioning on regeneration"
```

---

### Task A6: Build verification

**Step 1:** Run `npx tsc --noEmit` — should pass with no errors
**Step 2:** Run `npm run build` — should compile successfully
**Step 3:** Commit any fixes if needed

---

## Agent B: Frontend Overhaul

> **IMPORTANT:** This agent MUST invoke the `frontend-designer` skill before writing any code.
> The skill is at `.claude/skills/frontend-designer/SKILL.md`.

### Task B1: Critique existing frontend

**Before writing any code**, the agent should:
1. Read all existing components and pages (listed in the skill)
2. Write a critique identifying:
   - Generic/bland design choices
   - Missing design identity
   - Poor spatial composition
   - Lack of distinctive typography and color
   - Missing animations and micro-interactions
3. Propose a bold aesthetic direction for a content creation / video production tool

Save critique as a comment in the commit message.

---

### Task B2: Design system foundation

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

Establish the design foundation:
- Choose distinctive fonts (NOT Geist, Inter, Roboto, or system fonts)
- Define a cohesive color palette via `@theme inline` CSS variables
- Set up base typography, spacing, and background atmosphere
- The aesthetic should reflect video production / content creation

---

### Task B3: Redesign navigation and layout

**Files:**
- Modify: `src/components/nav.tsx`
- Modify: `src/app/layout.tsx`

Redesign the navigation:
- Distinctive app identity / logo treatment
- Navigation links with hover states and micro-interactions
- Should feel like a creative production tool, not a generic dashboard

---

### Task B4: Redesign dashboard page

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/project-list.tsx`
- Modify: `src/components/project-card.tsx`
- Modify: `src/components/status-badge.tsx`

Redesign with:
- Pipeline progress indicator showing stage visually
- Distinctive project cards (not generic rounded-corner cards)
- Bold empty state
- Status badges that feel part of the design system

---

### Task B5: Redesign create project page

**Files:**
- Modify: `src/app/projects/new/page.tsx`
- Modify: `src/components/create-project-form.tsx`

Redesign with:
- Distinctive form styling
- Clear visual hierarchy
- Memorable input interactions

---

### Task B6: Redesign project detail page + add script review

**Files:**
- Modify: `src/app/projects/[id]/page.tsx`
- Modify: `src/components/project-detail.tsx`
- Create: `src/components/pipeline-progress.tsx`
- Create: `src/components/script-review.tsx`
- Create: `src/components/segment-card.tsx`
- Create: `src/components/approve-controls.tsx`

This is the biggest frontend task. The project detail page needs to:
- Show pipeline progress (which stage the project is at)
- Display product analysis results (current behavior, redesigned)
- Show an "Approve & Generate Script" button when status is `analysis_review`
- Display the generated script in a review interface when status is `script_review`
- Script review shows 4 segment cards with:
  - Script text
  - Syllable count (with pass/warn/fail indicator)
  - Energy arc visualization (HIGH/LOW/PEAK)
  - Shot scripts (3 per segment)
  - Audio sync points
  - Text overlay
- Grade controls (S/A/B/F buttons)
- Feedback textarea
- Approve button (proceeds to Phase 3)
- Regenerate button (with optional feedback)

The `pipeline-progress.tsx` component shows the full pipeline:
`Analyze → Review → Script → Review → Cast → Direct → Edit → Done`
with the current stage highlighted.

---

### Task B7: Frontend build verification

**Step 1:** Run `npx tsc --noEmit`
**Step 2:** Run `npm run build`
**Step 3:** Visual check: `npm run dev`, visit localhost:3000
**Step 4:** Commit

---

## Agent C: Integration + End-to-End Verification

### Task C1: End-to-end flow test

**Step 1:** Start dev server and worker:
```bash
npm run dev
npm run worker
```

**Step 2:** Create a new project via API or UI:
```bash
curl -s -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"productUrl":"https://www.tiktokshop.com/product/NeoCell-Super-Collagen-Peptides-Powder-1702246054291726"}'
```

**Step 3:** Wait for analysis to complete (status should change to `analysis_review`, not `completed`)

**Step 4:** Approve the analysis:
```bash
curl -s -X POST http://localhost:3000/api/projects/{id}/approve
```

**Step 5:** Wait for script generation (status: `scripting` → `script_review`)

**Step 6:** Verify scripts exist:
```bash
curl -s http://localhost:3000/api/projects/{id}/scripts
```
Expected: Array with 1 script object containing 4 scenes, hook_score >= 10

**Step 7:** Grade the script:
```bash
curl -s -X PATCH http://localhost:3000/api/projects/{id}/scripts/{scriptId} \
  -H "Content-Type: application/json" \
  -d '{"grade":"A","feedback":"Great hook, good energy flow"}'
```

**Step 8:** Test regeneration:
```bash
curl -s -X POST http://localhost:3000/api/projects/{id}/scripts/{scriptId}/regenerate \
  -H "Content-Type: application/json" \
  -d '{"feedback":"Make the hook more provocative"}'
```
Expected: Project status goes back to `scripting`, then `script_review` with version 2

**Step 9:** Visual verification in browser — check all pages render correctly

---

### Task C2: Update PROGRESS.md and push

**Files:**
- Modify: `PROGRESS.md`
- Modify: `ROADMAP.md`

Add Phase 2 completion:
```markdown
## Phase 2: Scripting
### Agent A: ScriptingAgent Backend
- [x] Status lifecycle updated (analysis_review, script_review)
- [x] ScriptingAgent with syllable validation and hook scoring
- [x] Worker scripting handler
- [x] Approve, scripts, grade, regenerate API routes
- [x] Script versioning

### Agent B: Frontend Overhaul
- [x] Design system (fonts, colors, tokens)
- [x] Navigation redesign
- [x] Dashboard redesign
- [x] Create project redesign
- [x] Project detail + script review UI
- [x] Pipeline progress component

### Agent C: Verification
- [x] End-to-end flow tested
- [x] Build passes
```

Update ROADMAP.md to check off Phase 2 items.

**Final push:**
```bash
git push origin main
```

---

## Parallel Execution Strategy

```
Agent A (Backend)              Agent B (Frontend)
─────────────────             ──────────────────
A1: Status lifecycle    ──┐   B1: Critique existing UI
A2: ScriptingAgent        │   B2: Design system foundation
A3: Worker handler        │   B3: Nav redesign
A4: API routes            │   B4: Dashboard redesign
A5: Script versioning     │   B5: Create project redesign
A6: Build check       ───┤   B6: Detail page + script review
                          │   B7: Build check
                          │
                    Agent C (Integration)
                    ────────────────────
                    C1: End-to-end test
                    C2: Update docs + push
```

Agents A and B can run in parallel. Agent C runs after both complete.
