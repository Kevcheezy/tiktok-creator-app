# Navigable Pipeline Stages — Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users click completed pipeline stages to review and optionally edit past work, with downstream impact warnings before destructive changes.

**Architecture:** Frontend-only view state. Clicking a completed stage node sets `viewingStage` in `project-detail.tsx`, rendering that stage's review component in read-only mode. An "Edit" button enables editing. On save, a backend impact API returns which downstream stages would need regeneration. A confirmation dialog shows the cost before committing.

**Tech Stack:** Next.js App Router, React state, existing review components with `readOnly` prop, new `POST /api/projects/[id]/impact` endpoint, `DOWNSTREAM_IMPACT_MAP` constant.

---

## 1. Data Dependency Map

Each review gate controls data that downstream stages consume. Edits are classified as **safe** (no regeneration) or **destructive** (invalidates later work).

### analysis_review

| Field | Type | Affected Stages |
|-------|------|-----------------|
| `product_image_url` | safe | — |
| `product_data` (name, category, selling_points, hook_angle) | destructive | scripting, broll_planning, casting, directing, voiceover, editing |
| `video_analysis` | destructive | scripting, casting, directing, editing |

### script_review

| Field | Type | Affected Stages |
|-------|------|-----------------|
| `script_text` | destructive | casting, directing, voiceover, editing |
| `energy_arc` | destructive | casting, directing, editing |
| `shot_scripts` | destructive | directing, broll_planning, editing |
| `broll_cues` | destructive | broll_planning, broll_generation, editing |
| `text_overlay` | safe | — (applied at render time by EditorAgent) |
| `hook_score` | safe | — (metadata) |
| `audio_sync` | safe | — (metadata) |

### broll_review

| Field | Type | Affected Stages |
|-------|------|-----------------|
| `prompt` | destructive | broll_generation, editing |
| `timing_seconds`, `duration_seconds` | destructive | broll_generation, editing |
| `category`, `narrative_role` | safe | — (metadata) |

### influencer_selection

| Field | Type | Affected Stages |
|-------|------|-----------------|
| `influencer_id` | destructive | casting, directing, editing |
| `product_placement` | destructive | casting, directing, editing |

### casting_review

| Field | Type | Affected Stages |
|-------|------|-----------------|
| keyframe image (upload/regenerate) | destructive | directing, editing |

### asset_review

| Field | Type | Affected Stages |
|-------|------|-----------------|
| any asset (video/audio/broll) | destructive | editing |
| `text_overlay` | safe | — (applied at render time) |

---

## 2. Backend: Downstream Impact API

### New constant: `DOWNSTREAM_IMPACT_MAP`

**File:** `src/lib/constants.ts`

```typescript
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

### New endpoint: `POST /api/projects/[id]/impact`

**File:** `src/app/api/projects/[id]/impact/route.ts`

**Request:**
```json
{
  "stage": "script_review",
  "changes": ["script_text", "text_overlay"]
}
```

**Response:**
```json
{
  "safe": [
    { "field": "text_overlay", "description": "Applied at render time" }
  ],
  "destructive": [
    {
      "field": "script_text",
      "description": "Script text drives keyframe prompts, video, and voiceover audio",
      "affectedStages": ["casting", "directing", "voiceover", "editing"]
    }
  ],
  "allAffectedStages": ["casting", "directing", "voiceover", "editing"],
  "restartFrom": "casting",
  "estimatedCost": 5.57,
  "warning": "Editing script text will require regenerating: Casting ($0.56), Directing ($4.80), Voiceover ($0.20), Editing ($0.01)."
}
```

**Logic:**
1. Look up `DOWNSTREAM_IMPACT_MAP[stage]` for each field in `changes`
2. Separate into `safe` and `destructive` lists
3. Union all `affectedStages` from destructive changes
4. Determine `restartFrom` = earliest affected stage in pipeline order
5. Calculate `estimatedCost` from `API_COSTS` for each affected stage
6. Build human-readable `warning` string

**Cost estimation per stage:**
- scripting: $0.01
- broll_planning: $0.01
- broll_generation: ~$0.84 (12 images × $0.07)
- casting: $0.56
- directing: $4.80
- voiceover: $0.20
- editing: $0.01

### Edit + regenerate flow

Safe edits are applied via existing PATCH endpoints. No restart needed.

For destructive edits confirmed by the user:
1. Apply the edits via existing PATCH endpoints
2. Call `POST /api/projects/[id]/retry` with `{ stage: restartFrom }` to restart the pipeline from the earliest affected stage
3. The retry endpoint already handles resetting status and enqueuing the job

---

## 3. Frontend: Clickable Pipeline Nodes

### pipeline-progress.tsx

- Completed stage nodes get `onClick` handler and hover styles
- New prop: `onStageClick?: (stageKey: string) => void`
- Completed nodes: `cursor-pointer` + subtle hover glow (`hover:ring-2 ring-lime/30`)
- Current and future nodes: not clickable
- Clicking a completed node calls `onStageClick(stage.key)`

### project-detail.tsx

**New state:**
```typescript
const [viewingStage, setViewingStage] = useState<string | null>(null);
const [editMode, setEditMode] = useState(false);
```

**Stage click handler:**
```typescript
function handleStageClick(stageKey: string) {
  setViewingStage(stageKey);
  setEditMode(false);
}
```

**Rendering logic change:**

Currently, components render based on `project.status`:
```tsx
{project.status === 'script_review' && <ScriptReview ... />}
```

With navigable stages, the logic becomes:
```tsx
const displayStage = viewingStage || project.status;
```

And each review component renders when `displayStage` matches:
```tsx
{displayStage === 'script_review' && (
  <ScriptReview projectId={projectId} onStatusChange={fetchProject} readOnly={viewingStage !== null && !editMode} />
)}
```

**Navigation banner (shown when viewingStage is set):**
```
┌─────────────────────────────────────────────────────────────────┐
│  📋 Viewing Script Review — Current stage: Casting Review       │
│  [Edit]                                          [Back to current] │
└─────────────────────────────────────────────────────────────────┘
```

- "Back to current" clears `viewingStage` and `editMode`
- "Edit" sets `editMode = true`, which passes `readOnly={false}` to the review component

### Review components: `readOnly` prop

Each review component receives `readOnly?: boolean`:

**ScriptReview (`script-review.tsx`):**
- `readOnly=true`: Hide ApproveControls (grade, tone, feedback, approve/regenerate buttons). Show segments as non-editable text.
- `readOnly=false`: Normal behavior (current UI)

**ApproveControls (`approve-controls.tsx`):**
- Hidden entirely when parent is in `readOnly` mode

**AssetReview (`asset-review.tsx`):**
- `readOnly=true`: Show asset grid without approve/reject/regenerate buttons
- `readOnly=false`: Normal behavior

**StoryboardView (`storyboard-view.tsx`):**
- `readOnly=true`: Show B-roll cards without edit/remove/upload/approve controls
- `readOnly=false`: Normal behavior

**InfluencerSelection (in `project-detail.tsx`):**
- `readOnly=true`: Show selected influencer highlighted, product placement read-only, no confirm button
- `readOnly=false`: Normal behavior

**AnalysisResults (in `project-detail.tsx`):**
- Already read-only by default. "Edit" enables inline editing of product data fields.

### Destructive edit confirmation

When a user saves changes in edit mode:

1. Component collects changed field names
2. Calls `POST /api/projects/[id]/impact` with `{ stage, changes }`
3. If all changes are safe: apply immediately, show success toast
4. If any destructive changes: show `ConfirmDialog`:
   - Title: "Changes require regeneration"
   - Body: warning text from the API (lists affected stages + cost)
   - Cancel: discard changes
   - "Save & Regenerate": apply changes, trigger retry from `restartFrom`
5. After confirmation, call the PATCH endpoint, then `POST /api/projects/[id]/retry` with the `restartFrom` stage
6. Clear `viewingStage` and `editMode` — the UI returns to the current (now restarted) pipeline stage

---

## 4. Stage-to-Component Mapping

Which review component renders for each stage when navigating:

| Stage Key | Component | Data Source |
|-----------|-----------|-------------|
| `analysis_review` | `AnalysisResults` + `ProductImageSection` + `ReferenceVideoAnalysis` | `project.product_data`, `project.product_image_url`, `project.video_analysis` |
| `script_review` | `ScriptReview` | `GET /api/projects/[id]/scripts` |
| `broll_review` | `StoryboardView` | `GET /api/projects/[id]/broll` |
| `influencer_selection` | `InfluencerSelection` | `project.influencer_id`, `GET /api/influencers` |
| `casting_review` | `AssetReview` | `GET /api/projects/[id]/assets` |
| `asset_review` | `AssetReview` | `GET /api/projects/[id]/assets` |

Processing stages (`analyzing`, `scripting`, `casting`, `directing`, `voiceover`, `broll_planning`, `broll_generation`, `editing`) are NOT navigable — they have no review UI. The pipeline progress nodes for these stages are not clickable.

---

## 5. Scope Boundaries

**Backend agent builds:**
- `DOWNSTREAM_IMPACT_MAP` constant in `src/lib/constants.ts`
- `POST /api/projects/[id]/impact` endpoint
- Cost estimation logic

**Frontend agent builds:**
- Clickable pipeline nodes in `pipeline-progress.tsx`
- `viewingStage` + `editMode` state in `project-detail.tsx`
- Navigation banner component
- `readOnly` prop on all review components
- Destructive edit confirmation dialog integration

---

## 6. What This Does NOT Do

- **Does not add new editing capabilities.** Uses existing PATCH endpoints. If a field isn't editable today, it isn't editable via navigation either.
- **Does not change the pipeline status.** Viewing a past stage is purely a frontend concern. The project status stays at the current stage.
- **Does not support editing processing stages.** Only review gates are navigable.
- **Does not auto-regenerate.** The user always confirms before any regeneration happens.
