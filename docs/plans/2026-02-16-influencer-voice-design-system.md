# Influencer Voice Design System

## Overview

Voice becomes a required attribute of the influencer entity, designed via ElevenLabs Voice Design API with preset-based selection and audio preview approval. Influencers without a designed voice are excluded from project selection (matching the image hard gate). VoiceoverAgent is simplified to pure TTS — no voice design logic. Kling video audio is muted in the final render.

**Goal:** Every influencer has a consistent, user-approved voice. Every video sounds like that influencer.

## Decisions

- **Voice timing:** Designed at influencer creation (not per-project)
- **Voice input:** Voice presets + custom description (same pattern as scene/interaction presets)
- **Preview:** User previews and approves voice before saving
- **Selection gate:** Hard gate — influencers need image AND voice to be selectable
- **Kling audio:** Completely muted. Final audio = ElevenLabs TTS only.

## Architecture

```
Influencer Creation/Edit
  → Select voice preset (or write custom description)
  → Call ElevenLabs Voice Design API → temporary preview audio
  → User plays preview → approve or regenerate
  → On approve: save voice permanently to ElevenLabs account
  → Store voice_id + preview_url + description on influencer record

Project Pipeline (VoiceoverAgent)
  → Read influencer.voice_id (guaranteed to exist via hard gate)
  → For each segment: textToSpeech(voice_id, script_text) → MP3
  → Upload to Supabase Storage
  → No voice design logic — pure TTS only

EditorAgent
  → Mute Kling video audio tracks (volume: 0 on Video-1..4)
  → Audio-1..4 = ElevenLabs TTS only
```

## Schema

### New table: `voice_preset`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| name | text | Display name ("Trusted Expert", "Energetic Creator") |
| description | text | ElevenLabs Voice Design description |
| gender | text | 'male' / 'female' |
| sample_text | text | Text used for preview generation |
| category_affinity | text[] | Product categories this voice suits best |
| is_system | boolean | true = immutable system preset |
| created_at | timestamp | |

**System presets (~8):**
- Trusted Expert (male) — "Deep, calm, authoritative, trustworthy. Like a pharmacist explaining a product you should really try."
- Energetic Creator (female) — "Upbeat, excited, youthful, fast-paced. Like a TikTok creator who just discovered something amazing."
- Calm Reviewer (male) — "Measured, thoughtful, slightly low-pitched. Like a product reviewer who's done thorough research."
- Big Sister (female) — "Warm, relatable, conversational, slightly conspiratorial. Like sharing a secret with a close friend."
- Hype Man (male) — "High-energy, enthusiastic, punchy. Like an infomercial host who genuinely loves the product."
- Wellness Guide (female) — "Soothing, gentle, nurturing. Like a yoga instructor recommending their favorite supplement."
- Street Smart (male) — "Casual, confident, slightly gravelly. Like a guy who knows all the best deals."
- Trendsetter (female) — "Youthful, crisp, slightly breathless with excitement. Like a fashion influencer at a launch event."

### Modify table: `influencer`

Add columns:
- `voice_id` text — permanent ElevenLabs voice ID (null until designed)
- `voice_preset_id` uuid FK → `voice_preset` (null if custom)
- `voice_description` text — the description used for Voice Design (from preset or custom)
- `voice_preview_url` text — Supabase Storage URL to preview audio clip

## API Endpoints

### `POST /api/influencers/[id]/voice/design`

Generate a voice preview for the influencer.

**Request:**
```json
{
  "presetId": "uuid",           // OR
  "customDescription": "string" // one of these required
}
```

**Logic:**
1. Resolve description: from preset (lookup `voice_preset.description`) or from `customDescription`
2. Resolve sample text: from preset or default ("Hey, I just tried this product and I have to tell you about it.")
3. Call `elevenlabs.designVoice(description, sampleText)` → returns `{ generatedVoiceId, audioData }`
4. Upload preview audio to Supabase Storage: `influencers/{id}/voice-preview.mp3`
5. Return `{ previewUrl, temporaryVoiceId }`

**Response:**
```json
{
  "previewUrl": "https://supabase.../influencers/{id}/voice-preview.mp3",
  "temporaryVoiceId": "generated-voice-id-xxx"
}
```

### `POST /api/influencers/[id]/voice/approve`

Save the previewed voice permanently.

**Request:**
```json
{
  "temporaryVoiceId": "generated-voice-id-xxx"
}
```

**Logic:**
1. Call `elevenlabs.saveVoice(temporaryVoiceId, "{influencer.name}-voice", description)` → returns permanent `voiceId`
2. Update influencer: `voice_id`, `voice_preset_id`, `voice_description`, `voice_preview_url`

**Response:**
```json
{
  "voiceId": "permanent-voice-id-xxx",
  "previewUrl": "https://supabase.../influencers/{id}/voice-preview.mp3"
}
```

### `DELETE /api/influencers/[id]/voice`

Remove the designed voice. Influencer becomes ineligible for project selection until a new voice is designed.

**Logic:**
1. Clear `voice_id`, `voice_preset_id`, `voice_description`, `voice_preview_url`
2. Delete preview audio from Supabase Storage
3. Do NOT delete from ElevenLabs (voice may be cached in active projects)

### `GET /api/voice-presets`

List all voice presets.

**Response:** Array of `voice_preset` records.

### `POST /api/voice-presets`

Create a custom voice preset (user-created, `is_system: false`).

### `DELETE /api/voice-presets/[id]`

Delete a custom voice preset. System presets (`is_system: true`) cannot be deleted.

## VoiceoverAgent Changes

### Remove
- `VOICE_MAPPING` constant (category → persona mapping)
- `FALLBACK_VOICES` constant (Adam/Rachel hardcoded IDs)
- `resolveVoice()` method (voice design + caching + fallback logic)
- `isVoiceValid()` check
- All `designVoice()` and `saveVoice()` calls

### Replace with
```typescript
async run(projectId: string): Promise<void> {
  const project = await this.getProject(projectId) // includes influencer join
  const voiceId = project.influencer?.voice_id

  if (!voiceId) {
    throw new Error('Influencer has no designed voice. Design a voice from the Influencer page before running the pipeline.')
  }

  for (const segIdx of SEGMENTS) {
    const scene = await this.getScene(projectId, segIdx)
    if (!scene?.script_text) continue

    const audioBuffer = await this.elevenlabs.textToSpeech(voiceId, scene.script_text)
    // ... upload, create asset (unchanged)
  }
}
```

### Keep unchanged
- Per-segment try/catch and error handling
- Audio upload to Supabase Storage
- Data URI fallback (for now)
- Asset creation and cost tracking

## EditorAgent Changes

Mute Kling video audio in Creatomate modifications:

```typescript
// For each video slot, set volume to 0
if (asset.type === 'video') {
  const slotNum = segIdx + 1
  modifications[`Video-${slotNum}`] = {
    source: asset.url,
    volume: 0  // mute Kling native audio
  }
}
```

This ensures only ElevenLabs TTS is heard in the final render.

## Frontend Changes

### Influencer creation/edit page

New "Voice" section below image upload:

1. **Voice preset card grid** — same layout as scene/interaction presets (R1.5.9)
   - Cards sorted by category affinity to influencer's typical product type
   - "Best match" badge on recommended preset
   - "+ Custom" card opens text input for description
2. **"Design Voice" button** — calls `/voice/design`, shows loading spinner
3. **Audio preview player** — inline audio element with play/pause
4. **Approve / Regenerate buttons** — approve saves permanently, regenerate re-calls design with same or different preset
5. **Voice badge** — after approved, show voice name + play button on influencer card

### Influencer selection gate (WHO section)

- API filter: `GET /api/influencers?hasImage=true&hasVoice=true`
- Influencers without voice excluded from grid
- Voice preview play button on selection cards (small speaker icon)

### Influencer list page

- Voice status indicator on each card: speaker icon (has voice) or muted icon (no voice)
- Play button to preview voice inline from list

## Influencer Selection Hard Gate

Update `POST /api/projects/[id]/select-influencer`:

```typescript
// Existing check:
if (!influencer.image_url) return 400 "Influencer has no image"

// New check:
if (!influencer.voice_id) return 400 "Influencer has no designed voice"
```

Update `GET /api/influencers?hasImage=true&hasVoice=true`:
- Add filter: `voice_id IS NOT NULL` when `hasVoice=true`

## Migration / Backward Compatibility

- Existing `ai_character` records with `voice_id`: VoiceoverAgent reads from `influencer.voice_id` first, falls back to `project.character.voice_id` for in-flight projects
- Existing projects mid-pipeline: unaffected (voice already resolved at voiceover stage)
- New projects: require influencer with voice
- Seed migration: system voice presets inserted

## Cost Impact

| Item | Cost | Frequency |
|------|------|-----------|
| Voice Design (preview) | ~$0.01 | Per design attempt (one-time per influencer) |
| Voice Save | Free | Part of ElevenLabs Voice Design flow |
| TTS per segment | $0.05 | Per segment (unchanged) |
| TTS per video | $0.20 | Per video (unchanged) |

No ongoing cost increase. Voice design cost amortized to ~$0 per video.

## Acceptance Criteria

1. User can select a voice preset or write a custom description on the influencer page
2. Voice preview plays in the browser after design
3. User can approve or regenerate the voice
4. Approved voice is stored permanently on the influencer record
5. Influencers without voice are excluded from project selection
6. VoiceoverAgent uses `influencer.voice_id` directly — no voice design logic
7. Final video has no Kling audio — only ElevenLabs TTS
8. Existing projects mid-pipeline continue working
