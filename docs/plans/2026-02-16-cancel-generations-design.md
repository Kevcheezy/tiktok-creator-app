# Cancel Generations Design

## Problem

Users cannot cancel in-progress generations. Once a pipeline stage or test video starts, they must wait for it to complete or fail. External API calls (Kling, ElevenLabs) continue running and accumulating costs even after the existing cancel route rolls back the project status.

## Approach: Cooperative Cancellation via Database Flag

The worker checks a cancellation flag between poll iterations and before starting new sub-tasks. If cancelled, it stops early, marks in-flight assets as `cancelled`, and exits the job gracefully. Already-completed assets are preserved.

## Database Changes

- **Project table**: Add `cancel_requested_at` timestamp column (nullable). Set when cancel is triggered, cleared after rollback.
- **Asset status**: Add `cancelled` as a valid status. Assets in `generating` or `pending` get flipped to `cancelled`. Completed assets are untouched.

## Worker Cancellation Logic

### Check points

1. **Between sub-tasks within a stage.** Before starting each segment's generation in a loop, check if `cancel_requested_at` is set. Bail out early if so.
2. **During `pollResult()` loops.** Accept an optional `shouldCancel` callback. Each poll iteration calls it (queries asset status from DB). If cancelled, throw `CancellationError`.

### CancellationError handling

- New custom error class, distinct from regular errors
- Worker catches it and does NOT mark the project as `failed`
- Marks remaining `generating` assets from that stage as `cancelled`
- Leaves `completed` assets untouched
- Exits the job handler cleanly (no BullMQ retry)

### Check frequency

One DB query per poll cycle (~10-30s). Cheap: `SELECT cancel_requested_at FROM project WHERE id = $1`.

## API Changes

### Enhanced `POST /api/projects/[id]/cancel`

1. Set `cancel_requested_at = now()` on the project
2. Flip all `generating` and `pending` assets for the current stage to `cancelled`
3. Roll back project status to previous review gate (existing behavior)
4. Clear `cancel_requested_at` after rollback

### New `POST /api/projects/[id]/assets/[assetId]/cancel`

1. Verify asset exists and is in `generating` status
2. Set asset status to `cancelled`
3. Return updated asset

The worker's `shouldCancel` callback picks up both signals: project-level via `cancel_requested_at`, asset-level via `asset.status === 'cancelled'`.

## UI Changes

### Pipeline progress cancel button

When a pipeline stage is actively processing, show a cancel button next to the progress indicator. Calls `POST /api/projects/[id]/cancel`. UI immediately shows the rollback to the review gate.

### Test video cancel button

In `video-preview-panel`, when `isTestGenerating` is true, the "Generating..." button becomes a "Cancel" button. Calls `POST /api/projects/[id]/assets/[assetId]/cancel`, stops polling, returns to generate state.

### Asset card cancel button

In `asset-card`, when an asset shows the "Generating..." spinner, add a small cancel/X button. Calls the asset cancel endpoint, flips the card back to pre-generation state.

### Soft "go back" escape

Already works — user can navigate away from pipeline progress. Generation continues in background. No extra UI work needed.

## Limitations

- External API tasks (Kling/WaveSpeed) still run on the provider's side after cancel. We stop waiting/polling but the provider still bills.
- Cancel is not instant — up to one poll cycle delay (~10-30s) before worker notices.
- Real cost savings come from preventing the *next* batch of work (e.g., cancelling during casting prevents directing, voiceover, broll from starting).
