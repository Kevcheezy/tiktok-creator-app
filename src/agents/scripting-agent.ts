import { SupabaseClient } from '@supabase/supabase-js';
import { BaseAgent } from './base-agent';
import { API_COSTS, PIPELINE_CONFIG, SCRIPT_TONES, DEFAULT_TONE, type ScriptTone } from '@/lib/constants';
import { countTextSyllables } from '@/lib/syllables';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ShotScript {
  index: number;
  text: string;
  energy: string;
}

interface AudioSyncPeak {
  word: string;
  time: string;
  action: string;
}

interface AudioSync {
  shot_1_peak: AudioSyncPeak;
  shot_2_peak: AudioSyncPeak;
  shot_3_peak: AudioSyncPeak;
}

interface EnergyPattern {
  start: string;
  middle: string;
  end: string;
}

interface BrollCue {
  shot_script_index: number;
  offset_seconds: number;
  duration_seconds: number;
  intent: string;
  spoken_text_during: string;
}

interface Segment {
  id: number;
  section: string;
  script_text: string;
  syllable_count: number;
  energy: EnergyPattern;
  shot_scripts: ShotScript[];
  audio_sync: AudioSync;
  text_overlay: string;
  key_moment: string;
  broll_cues?: BrollCue[];
  props_needed?: string[];
  interaction_type?: string;
  camera_specs?: {
    angle: string;
    movement: string;
    lighting: string;
  };
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

interface ScriptResponse {
  segments: Segment[];
  hook_score: HookScore;
  total_syllables: number;
}

interface ScriptResult {
  scriptId: string;
  version: number;
  hookScore: number;
  totalSyllables: number;
  segments: Segment[];
}

// ─── System Prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(tone: ScriptTone): string {
  const toneConfig = SCRIPT_TONES[tone];
  return `You are a Script Architect for TikTok Shop UGC videos.

${toneConfig.promptBlock}

CREATE A 4-SEGMENT SCRIPT for a 60-second video.

RULES:
1. Each segment = 15 seconds, 82-90 syllables
2. Each segment will be split into 3 shots of 5 seconds each for Kling 3.0 multi-shot
3. SEGMENT STRUCTURE (4 segments):
   - Segment 1 (HOOK): HIGH energy throughout (exception - sustained), NO product, open curiosity loop
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

7. B-ROLL TIMING CUES (REQUIRED for each segment):
   Identify 2-5 moments where a B-roll cutaway image would strengthen the argument.
   Each cue marks when a supplementary image should appear on screen:
   - shot_script_index: which 5s shot block (0, 1, or 2)
   - offset_seconds: offset within the 15s segment (e.g., 1.5, 6.0, 11.5)
   - duration_seconds: how long the B-roll stays on screen (2-3s)
   - intent: what the B-roll should communicate (e.g., "show clinical evidence", "negative contrast")
   - spoken_text_during: the exact script text being spoken while B-roll is on screen
   Target: visual refresh every ~2-3 seconds. Place cues on claims, proof points, product mentions, emotional beats.

8. SEGMENT TAGGING (REQUIRED for each segment):
   Tag each segment with production metadata:
   - props_needed: array of physical props visible in this segment (e.g., ["product bottle", "cotton pad", "mirror"])
   - interaction_type: how the creator interacts with the product. One of: hold_and_show, apply_to_skin, stir_mix, demonstrate, pour_drink, unbox, compare, try_on, set_down_point, none
   - camera_specs: shot composition details:
     - angle: one of close-up, medium, wide, over-shoulder
     - movement: one of static, slow_zoom_in, slow_zoom_out, pan_left, pan_right, tracking
     - lighting: one of ring_light_front, natural_window, warm_ambient, dramatic_side, soft_diffused

9. SEGMENT TAGGING RULES:
   - Segment 1 (Hook): interaction_type MUST be "none" (no product visible)
   - Segment 3 (Solution): interaction_type MUST NOT be "none" (product is the hero)
   - Props should include the product name when product_visibility is not "none"
   - Camera should progress: medium/wide for hook → close-up for product hero → medium for CTA

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
        "shot_1_peak": { "word": "keyword at ~3s", "time": "~3s", "action": "confident gesture" },
        "shot_2_peak": { "word": "keyword at ~8s", "time": "~8s", "action": "hand on chest" },
        "shot_3_peak": { "word": "keyword at ~13s", "time": "~13s", "action": "lean + curious" }
      },
      "broll_cues": [
        { "shot_script_index": 0, "offset_seconds": 1.0, "duration_seconds": 2.5, "intent": "negative contrast — show cheap generic alternatives", "spoken_text_during": "the exact words being spoken" },
        { "shot_script_index": 1, "offset_seconds": 5.5, "duration_seconds": 2.0, "intent": "transformation proof — subtle before/after", "spoken_text_during": "the exact words being spoken" }
      ],
      "props_needed": ["product bottle", "cotton pad"],
      "interaction_type": "none",
      "camera_specs": { "angle": "medium", "movement": "static", "lighting": "ring_light_front" },
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
}

// ─── ScriptingAgent ────────────────────────────────────────────────────────────

export class ScriptingAgent extends BaseAgent {
  constructor(supabaseClient?: SupabaseClient) {
    super('ScriptingAgent', supabaseClient);
  }

  async run(projectId: string): Promise<ScriptResult> {
    const stageStart = Date.now();
    await this.logEvent(projectId, 'stage_start', 'scripting');
    this.log(`Starting scripting for project ${projectId}`);

    // 1. Fetch project + product_data
    const { data: proj, error: projError } = await this.supabase
      .from('project')
      .select('*, character:ai_character(*)')
      .eq('id', projectId)
      .single();

    if (projError || !proj) {
      throw new Error(`Project not found: ${projectId}`);
    }

    if (!proj.product_data) {
      throw new Error(`Project ${projectId} has no product_data — run analysis first`);
    }

    // Read tone from project (falls back to default)
    const tone = (proj.tone as ScriptTone) in SCRIPT_TONES
      ? (proj.tone as ScriptTone)
      : DEFAULT_TONE;
    this.log(`Using tone: ${tone}`);

    const productData = proj.product_data as {
      product_name: string;
      category: string;
      selling_points: string[];
      hook_angle: string;
    };

    // 2. Optionally select a matching script_template (least used first)
    const template = await this.selectTemplate(productData.category);

    // 3. Build user prompt
    const userPrompt = this.buildUserPrompt(productData, template, proj.video_url, proj.video_analysis);

    // 4. Call WaveSpeed LLM
    this.log('Calling WaveSpeed LLM for script generation...');
    let rawResponse: string;
    try {
      rawResponse = await this.wavespeed.chatCompletion(buildSystemPrompt(tone), userPrompt, {
        temperature: 0.7,
        maxTokens: 8192,
      });
    } catch (err) {
      throw new Error(`LLM call failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 5. Parse JSON response
    this.log('Parsing LLM response...');
    let script: ScriptResponse;
    try {
      const cleaned = rawResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      script = JSON.parse(cleaned);
    } catch (err) {
      throw new Error(
        `Failed to parse LLM response as JSON: ${err instanceof Error ? err.message : String(err)}\nRaw response: ${rawResponse.substring(0, 500)}`
      );
    }

    // 6. Validate and override syllable counts
    this.validateAndFix(script);

    // 7. Determine version (A5: script versioning)
    const version = await this.getNextVersion(projectId);

    // 8. Save script row
    const fullText = script.segments.map((s) => s.script_text).join('\n\n');

    const { data: savedScript, error: scriptError } = await this.supabase
      .from('script')
      .insert({
        project_id: projectId,
        version,
        hook_score: script.hook_score.total,
        full_text: fullText,
        tone,
      })
      .select()
      .single();

    if (scriptError || !savedScript) {
      throw new Error(`Failed to save script: ${scriptError?.message}`);
    }

    // 9. Save scene rows
    const vm = this.videoModel;
    const sceneRows = script.segments.map((seg, idx) => ({
      script_id: savedScript.id,
      segment_index: idx,
      section: seg.section,
      script_text: seg.script_text,
      syllable_count: seg.syllable_count,
      energy_arc: seg.energy,
      shot_scripts: seg.shot_scripts,
      audio_sync: seg.audio_sync,
      text_overlay: seg.text_overlay,
      product_visibility: vm.product_placement_arc[idx]?.visibility ?? 'none',
      broll_cues: seg.broll_cues || [],
      props_needed: seg.props_needed || [],
      interaction_type: seg.interaction_type || null,
      camera_specs: seg.camera_specs || null,
    }));

    const { error: sceneError } = await this.supabase
      .from('scene')
      .insert(sceneRows);

    if (sceneError) {
      throw new Error(`Failed to save scenes: ${sceneError.message}`);
    }

    // 10. Track cost
    await this.trackCost(projectId, API_COSTS.wavespeedChat);

    const durationMs = Date.now() - stageStart;
    await this.logEvent(projectId, 'stage_complete', 'scripting', { durationMs });
    this.log(`Script v${version} saved (id=${savedScript.id}, hook_score=${script.hook_score.total}, syllables=${script.total_syllables})`);

    return {
      scriptId: savedScript.id,
      version,
      hookScore: script.hook_score.total,
      totalSyllables: script.total_syllables,
      segments: script.segments,
    };
  }

  // ─── Uploaded Script Analysis ─────────────────────────────────────────────

  async analyzeUploadedScript(projectId: string, rawText: string): Promise<ScriptResult> {
    this.log(`Analyzing uploaded script for project ${projectId}`);

    // 1. Fetch project + product_data
    const { data: proj, error: projError } = await this.supabase
      .from('project')
      .select('*, character:ai_character(*)')
      .eq('id', projectId)
      .single();

    if (projError || !proj) {
      throw new Error(`Project not found: ${projectId}`);
    }

    if (!proj.product_data) {
      throw new Error(`Project ${projectId} has no product_data — run analysis first`);
    }

    // Resolve tone
    const tone = (proj.tone as ScriptTone) in SCRIPT_TONES
      ? (proj.tone as ScriptTone)
      : DEFAULT_TONE;
    this.log(`Using tone: ${tone}`);

    const productData = proj.product_data as {
      product_name: string;
      category: string;
      selling_points: string[];
      hook_angle: string;
    };

    // 2. Build analysis-specific system prompt
    const analysisSystemPrompt = `You are a Script Analyst for TikTok Shop UGC videos.

You will receive raw script text that a creator has written or uploaded. Your job is to SPLIT this text into exactly 4 segments: Hook, Problem, Solution + Product, CTA.

RULES:
1. Each segment = 15 seconds, 82-90 syllables
2. Each segment will be split into 3 shots of 5 seconds each for Kling 3.0 multi-shot
3. SEGMENT STRUCTURE (4 segments):
   - Segment 1 (HOOK): HIGH energy throughout (exception - sustained), NO product, open curiosity loop
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

7. B-ROLL TIMING CUES (REQUIRED for each segment):
   Identify 2-5 moments where a B-roll cutaway image would strengthen the argument.
   Each cue marks when a supplementary image should appear on screen:
   - shot_script_index: which 5s shot block (0, 1, or 2)
   - offset_seconds: offset within the 15s segment (e.g., 1.5, 6.0, 11.5)
   - duration_seconds: how long the B-roll stays on screen (2-3s)
   - intent: what the B-roll should communicate
   - spoken_text_during: the exact script text being spoken while B-roll is on screen

8. SEGMENT TAGGING (REQUIRED for each segment):
   Tag each segment with production metadata:
   - props_needed: array of physical props visible in this segment (e.g., ["product bottle", "cotton pad", "mirror"])
   - interaction_type: how the creator interacts with the product. One of: hold_and_show, apply_to_skin, stir_mix, demonstrate, pour_drink, unbox, compare, try_on, set_down_point, none
   - camera_specs: shot composition details:
     - angle: one of close-up, medium, wide, over-shoulder
     - movement: one of static, slow_zoom_in, slow_zoom_out, pan_left, pan_right, tracking
     - lighting: one of ring_light_front, natural_window, warm_ambient, dramatic_side, soft_diffused

9. SEGMENT TAGGING RULES:
   - Segment 1 (Hook): interaction_type MUST be "none" (no product visible)
   - Segment 3 (Solution): interaction_type MUST NOT be "none" (product is the hero)
   - Props should include the product name when product_visibility is not "none"
   - Camera should progress: medium/wide for hook → close-up for product hero → medium for CTA

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
        "shot_1_peak": { "word": "keyword at ~3s", "time": "~3s", "action": "confident gesture" },
        "shot_2_peak": { "word": "keyword at ~8s", "time": "~8s", "action": "hand on chest" },
        "shot_3_peak": { "word": "keyword at ~13s", "time": "~13s", "action": "lean + curious" }
      },
      "broll_cues": [
        { "shot_script_index": 0, "offset_seconds": 1.0, "duration_seconds": 2.5, "intent": "negative contrast", "spoken_text_during": "exact words" }
      ],
      "props_needed": ["product bottle", "cotton pad"],
      "interaction_type": "none",
      "camera_specs": { "angle": "medium", "movement": "static", "lighting": "ring_light_front" },
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
}

Split the provided text faithfully into the 4 segments. Preserve the creator's wording as much as possible while fitting the structure.`;

    // 3. Build user prompt with raw text + product context
    const userPrompt = `UPLOADED SCRIPT TEXT:
${rawText}

PRODUCT CONTEXT:
Product: ${productData.product_name}
Category: ${productData.category}

Split this script into 4 segments following the output format.`;

    // 4. Call WaveSpeed LLM with lower temperature for analysis
    this.log('Calling WaveSpeed LLM for script analysis...');
    let rawResponse: string;
    try {
      rawResponse = await this.wavespeed.chatCompletion(analysisSystemPrompt, userPrompt, {
        temperature: 0.3,
        maxTokens: 8192,
      });
    } catch (err) {
      throw new Error(`LLM call failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 5. Parse JSON response
    this.log('Parsing LLM response...');
    let script: ScriptResponse;
    try {
      const cleaned = rawResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      script = JSON.parse(cleaned);
    } catch (err) {
      throw new Error(
        `Failed to parse LLM response as JSON: ${err instanceof Error ? err.message : String(err)}\nRaw response: ${rawResponse.substring(0, 500)}`
      );
    }

    // 6. Validate and override syllable counts
    this.validateAndFix(script);

    // 7. Determine version
    const version = await this.getNextVersion(projectId);

    // 8. Save script row with source: 'uploaded'
    const fullText = script.segments.map((s) => s.script_text).join('\n\n');

    const { data: savedScript, error: scriptError } = await this.supabase
      .from('script')
      .insert({
        project_id: projectId,
        version,
        hook_score: script.hook_score.total,
        full_text: fullText,
        source: 'uploaded',
        tone,
      })
      .select()
      .single();

    if (scriptError || !savedScript) {
      throw new Error(`Failed to save script: ${scriptError?.message}`);
    }

    // 9. Save scene rows
    const sceneRows = script.segments.map((seg, idx) => ({
      script_id: savedScript.id,
      segment_index: idx,
      section: seg.section,
      script_text: seg.script_text,
      syllable_count: seg.syllable_count,
      energy_arc: seg.energy,
      shot_scripts: seg.shot_scripts,
      audio_sync: seg.audio_sync,
      text_overlay: seg.text_overlay,
      product_visibility: this.videoModel.product_placement_arc[idx]?.visibility ?? 'none',
      broll_cues: seg.broll_cues || [],
      props_needed: seg.props_needed || [],
      interaction_type: seg.interaction_type || null,
      camera_specs: seg.camera_specs || null,
    }));

    const { error: sceneError } = await this.supabase
      .from('scene')
      .insert(sceneRows);

    if (sceneError) {
      throw new Error(`Failed to save scenes: ${sceneError.message}`);
    }

    // 10. Track cost
    await this.trackCost(projectId, API_COSTS.wavespeedChat);

    this.log(`Uploaded script analyzed v${version} (id=${savedScript.id}, hook_score=${script.hook_score.total}, syllables=${script.total_syllables})`);

    return {
      scriptId: savedScript.id,
      version,
      hookScore: script.hook_score.total,
      totalSyllables: script.total_syllables,
      segments: script.segments,
    };
  }

  // ─── Segment Regeneration ───────────────────────────────────────────────────

  async regenerateSegment(
    projectId: string,
    scriptId: string,
    segmentIndex: number,
    tone?: string,
    feedback?: string
  ): Promise<{ sceneId: string; segment: Segment }> {
    this.log(`Regenerating segment ${segmentIndex} for script ${scriptId}`);

    // 1. Fetch the script by ID
    const { data: scriptRecord, error: scriptError } = await this.supabase
      .from('script')
      .select('*')
      .eq('id', scriptId)
      .single();

    if (scriptError || !scriptRecord) {
      throw new Error(`Script not found: ${scriptId}`);
    }

    // 2. Fetch all scenes for this script, then get latest version per segment
    const { data: allSceneRows, error: scenesError } = await this.supabase
      .from('scene')
      .select('*')
      .eq('script_id', scriptId)
      .order('segment_index')
      .order('version', { ascending: false });

    if (scenesError || !allSceneRows || allSceneRows.length === 0) {
      throw new Error(`No scenes found for script ${scriptId}`);
    }

    // Deduplicate: keep only the latest version per segment_index
    const scenesMap = new Map<number, typeof allSceneRows[0]>();
    for (const s of allSceneRows) {
      if (!scenesMap.has(s.segment_index)) {
        scenesMap.set(s.segment_index, s);
      }
    }
    const scenes = Array.from(scenesMap.values()).sort((a, b) => a.segment_index - b.segment_index);

    // 3. Fetch project for product_data
    const { data: proj, error: projError } = await this.supabase
      .from('project')
      .select('*, character:ai_character(*)')
      .eq('id', projectId)
      .single();

    if (projError || !proj) {
      throw new Error(`Project not found: ${projectId}`);
    }

    if (!proj.product_data) {
      throw new Error(`Project ${projectId} has no product_data — run analysis first`);
    }

    const productData = proj.product_data as {
      product_name: string;
      category: string;
      selling_points: string[];
      hook_angle: string;
    };

    // 4. Resolve tone
    const resolvedTone: ScriptTone =
      tone && (tone as ScriptTone) in SCRIPT_TONES
        ? (tone as ScriptTone)
        : (scriptRecord.tone as ScriptTone) in SCRIPT_TONES
          ? (scriptRecord.tone as ScriptTone)
          : (proj.tone as ScriptTone) in SCRIPT_TONES
            ? (proj.tone as ScriptTone)
            : DEFAULT_TONE;
    this.log(`Using tone: ${resolvedTone}`);

    // 5. Get target scene
    const targetScene = scenes[segmentIndex];
    if (!targetScene) {
      throw new Error(`Segment index ${segmentIndex} not found — script has ${scenes.length} scenes`);
    }

    // 6. Get section name
    const sectionName = this.videoModel.section_names[segmentIndex] ?? targetScene.section;

    // 7. Build system prompt
    const systemPrompt = buildSystemPrompt(resolvedTone);

    // 8. Build focused user prompt with surrounding context
    const sellingPointsList = productData.selling_points
      .map((p: string, i: number) => `${i + 1}. ${p}`)
      .join('\n');

    const surroundingContext = scenes
      .filter((_: unknown, idx: number) => idx !== segmentIndex)
      .map((s: { segment_index: number; section: string; script_text: string }) =>
        `Segment ${s.segment_index + 1} (${s.section}): ${s.script_text}`
      )
      .join('\n\n');

    const energyPattern = this.videoModel.energy_arc[segmentIndex]
      ? JSON.stringify(this.videoModel.energy_arc[segmentIndex].pattern)
      : '{ "start": "LOW", "middle": "PEAK", "end": "LOW" }';

    const productVisibility = this.videoModel.product_placement_arc[segmentIndex]?.visibility ?? 'none';

    let userPrompt = `PRODUCT: ${productData.product_name}
CATEGORY: ${productData.category}
SELLING POINTS:
${sellingPointsList}

SURROUNDING CONTEXT (do NOT modify these segments):
${surroundingContext}

REGENERATE ONLY Segment ${segmentIndex + 1} (${sectionName}).
Target: 82-90 syllables, 3 shot_scripts of ~5s each.
Energy pattern: ${energyPattern}
Product visibility: ${productVisibility}`;

    if (feedback) {
      userPrompt += `\n\nUSER FEEDBACK: ${feedback}`;
    }

    userPrompt += `

OUTPUT: Return ONLY a single segment object (not wrapped in segments array):
{
  "id": ${segmentIndex + 1},
  "section": "${sectionName}",
  "script_text": "...",
  "syllable_count": 85,
  "energy": { "start": "...", "middle": "...", "end": "..." },
  "shot_scripts": [
    { "index": 0, "text": "...", "energy": "..." },
    { "index": 1, "text": "...", "energy": "..." },
    { "index": 2, "text": "...", "energy": "..." }
  ],
  "audio_sync": {
    "shot_1_peak": { "word": "...", "time": "~3s", "action": "..." },
    "shot_2_peak": { "word": "...", "time": "~8s", "action": "..." },
    "shot_3_peak": { "word": "...", "time": "~13s", "action": "..." }
  },
  "props_needed": ["..."],
  "interaction_type": "...",
  "camera_specs": { "angle": "...", "movement": "...", "lighting": "..." },
  "text_overlay": "...",
  "key_moment": "..."
}
${segmentIndex === 0 ? 'Also include a "hook_score" object with curiosity_loop, challenges_belief, clear_context, plants_question, pattern_interrupt, emotional_trigger, specific_claim, and total fields.' : 'Do NOT include hook_score.'}`;

    // 9. Call WaveSpeed LLM
    this.log(`Calling WaveSpeed LLM to regenerate segment ${segmentIndex}...`);
    let rawResponse: string;
    try {
      rawResponse = await this.wavespeed.chatCompletion(systemPrompt, userPrompt, {
        temperature: 0.7,
        maxTokens: 8192,
      });
    } catch (err) {
      throw new Error(`LLM call failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 10. Parse JSON response — expect single segment object
    this.log('Parsing LLM response...');
    let parsed: Segment & { hook_score?: HookScore };
    try {
      const cleaned = rawResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (err) {
      throw new Error(
        `Failed to parse LLM response as JSON: ${err instanceof Error ? err.message : String(err)}\nRaw response: ${rawResponse.substring(0, 500)}`
      );
    }

    const segment: Segment = {
      id: parsed.id,
      section: parsed.section,
      script_text: parsed.script_text,
      syllable_count: parsed.syllable_count,
      energy: parsed.energy,
      shot_scripts: parsed.shot_scripts,
      audio_sync: parsed.audio_sync,
      text_overlay: parsed.text_overlay,
      key_moment: parsed.key_moment,
      props_needed: parsed.props_needed,
      interaction_type: parsed.interaction_type,
      camera_specs: parsed.camera_specs,
    };

    // 11. Validate the segment: override syllable_count, check shot_scripts
    const programmaticCount = countTextSyllables(segment.script_text);
    if (programmaticCount !== segment.syllable_count) {
      this.log(
        `[Validation] Segment ${segment.id} "${segment.section}": LLM reported ${segment.syllable_count} syllables, programmatic count is ${programmaticCount}. Overriding.`
      );
      segment.syllable_count = programmaticCount;
    }

    if (!segment.shot_scripts || segment.shot_scripts.length !== this.videoModel.shots_per_segment) {
      this.log(
        `[Validation] WARNING: Segment ${segment.id} has ${segment.shot_scripts?.length ?? 0} shot_scripts, expected ${this.videoModel.shots_per_segment}`
      );
    }

    // 12. INSERT new versioned scene row (per-segment history)
    const nextVersion = (targetScene.version ?? 1) + 1;
    const { data: newScene } = await this.supabase
      .from('scene')
      .insert({
        script_id: scriptId,
        segment_index: segmentIndex,
        section: targetScene.section,
        script_text: segment.script_text,
        syllable_count: segment.syllable_count,
        energy_arc: segment.energy,
        shot_scripts: segment.shot_scripts,
        audio_sync: segment.audio_sync,
        text_overlay: segment.text_overlay,
        product_visibility: targetScene.product_visibility,
        props_needed: segment.props_needed || [],
        interaction_type: segment.interaction_type || null,
        camera_specs: segment.camera_specs || null,
        tone: resolvedTone,
        version: nextVersion,
      })
      .select()
      .single();

    if (!newScene) {
      throw new Error(`Failed to insert scene version ${nextVersion} for segment ${segmentIndex}`);
    }

    // 13. Recalculate script full_text from latest version of each segment
    const { data: allScenes } = await this.supabase
      .from('scene')
      .select('segment_index, script_text, version')
      .eq('script_id', scriptId)
      .order('segment_index')
      .order('version', { ascending: false });

    if (allScenes) {
      const latest = new Map<number, string>();
      for (const s of allScenes) {
        if (!latest.has(s.segment_index)) {
          latest.set(s.segment_index, s.script_text);
        }
      }
      const newFullText = Array.from(latest.entries())
        .sort(([a], [b]) => a - b)
        .map(([, text]) => text)
        .join('\n\n');
      await this.supabase.from('script').update({ full_text: newFullText }).eq('id', scriptId);
    }

    // 14. If segment 1 (Hook) and hook_score provided, update script.hook_score
    if (segmentIndex === 0 && parsed.hook_score) {
      // Recalculate total from components
      const recalculated =
        parsed.hook_score.curiosity_loop +
        parsed.hook_score.challenges_belief +
        parsed.hook_score.clear_context +
        parsed.hook_score.plants_question +
        parsed.hook_score.pattern_interrupt +
        parsed.hook_score.emotional_trigger +
        parsed.hook_score.specific_claim;

      const hookTotal = recalculated !== parsed.hook_score.total ? recalculated : parsed.hook_score.total;

      await this.supabase
        .from('script')
        .update({ hook_score: hookTotal })
        .eq('id', scriptId);

      this.log(`Updated hook_score to ${hookTotal}`);
    }

    // 15. Track cost
    await this.trackCost(projectId, API_COSTS.wavespeedChat);

    this.log(`Segment ${segmentIndex} regenerated for script ${scriptId} (scene=${targetScene.id})`);

    return { sceneId: newScene.id, segment };
  }

  // ─── Template Selection ────────────────────────────────────────────────────

  private async selectTemplate(category: string): Promise<{
    hook_type: string;
    text_hook_template: string;
    spoken_hook_template: string;
    energy_arc: unknown;
  } | null> {
    // Find templates matching the product category, ordered by least-used (use_count ascending)
    const { data: templates } = await this.supabase
      .from('script_template')
      .select('*')
      .contains('categories', [category])
      .order('use_count', { ascending: true, nullsFirst: true })
      .limit(1);

    if (!templates || templates.length === 0) {
      this.log(`No script template found for category "${category}", generating from scratch`);
      return null;
    }

    const tmpl = templates[0];
    this.log(`Selected template: "${tmpl.name}" (hook_type=${tmpl.hook_type})`);

    // Increment use_count
    await this.supabase
      .from('script_template')
      .update({ use_count: (tmpl.use_count || 0) + 1 })
      .eq('id', tmpl.id);

    return {
      hook_type: tmpl.hook_type,
      text_hook_template: tmpl.text_hook_template,
      spoken_hook_template: tmpl.spoken_hook_template,
      energy_arc: tmpl.energy_arc,
    };
  }

  // ─── User Prompt Builder ───────────────────────────────────────────────────

  private buildUserPrompt(
    productData: {
      product_name: string;
      category: string;
      selling_points: string[];
      hook_angle: string;
    },
    template: {
      hook_type: string;
      text_hook_template: string;
      spoken_hook_template: string;
      energy_arc: unknown;
    } | null,
    videoUrl?: string | null,
    videoAnalysis?: any | null,
  ): string {
    const sellingPointsList = productData.selling_points
      .map((p: string, i: number) => `${i + 1}. ${p}`)
      .join('\n');

    let prompt = `PRODUCT: ${productData.product_name}
CATEGORY: ${productData.category}
SELLING POINTS:
${sellingPointsList}
HOOK ANGLE: ${productData.hook_angle}`;

    if (template) {
      prompt += `

USE THIS HOOK PATTERN:
Type: ${template.hook_type}
Text Template: ${template.text_hook_template}
Spoken Template: ${template.spoken_hook_template}
Energy Arc: ${JSON.stringify(template.energy_arc)}`;
    }

    if (videoAnalysis) {
      const sealBlock = this.buildSEALBlock(videoAnalysis);
      prompt += `\n\n${sealBlock}`;
    } else if (videoUrl) {
      prompt += `\n\nREFERENCE VIDEO (analyze structure): ${videoUrl}`;
    } else {
      prompt += `\n\nMODE: Generate from scratch using proven hook formula`;
    }

    return prompt;
  }

  // ─── SEAL Block Builder ──────────────────────────────────────────────────

  private buildSEALBlock(analysis: any): string {
    const hook = analysis.hook;
    const segments = analysis.segments || [];
    const overall = analysis.overall;

    let block = `REFERENCE VIDEO ANALYSIS (STRONG INFLUENCE — match this video's style):

HOOK: ${hook?.type || 'unknown'} — ${hook?.technique || 'N/A'}
Hook text: "${hook?.text || 'N/A'}" (${hook?.durationSeconds || 3}s)
Overall energy arc: ${overall?.energyArc || 'build-to-peak'}
Dominant style: ${overall?.dominantStyle || 'N/A'}
Viral pattern: ${overall?.viralPattern || 'N/A'}
Text overlays: ${overall?.textOverlayStyle || 'none'}`;

    for (const seg of segments) {
      block += `\n\nSEGMENT ${seg.index + 1} (${seg.startTime}s-${seg.endTime}s):
  Scene: ${seg.scene?.setting || 'N/A'} — ${seg.scene?.composition || 'N/A'}
  Props: ${(seg.scene?.props || []).join(', ') || 'none'}
  Product: ${seg.scene?.productPresence || 'none'}
  Emotion: ${seg.emotion?.mood || 'neutral'} mood, ${seg.emotion?.energy || 'medium'} energy, ${seg.emotion?.pacing || 'moderate'} pacing
  Viewer intent: ${seg.emotion?.viewerIntent || 'curiosity'}
  Camera: ${seg.angle?.shotType || 'medium'} shot, ${seg.angle?.cameraMovement || 'static'}
  Transitions: ${seg.angle?.transitions || 'hard-cut'}
  Lighting: ${seg.lighting?.style || 'natural'}, ${seg.lighting?.colorTemp || 'neutral'} temp, ${seg.lighting?.contrast || 'medium'} contrast
  What happens: ${seg.description || 'N/A'}`;
    }

    block += `\n\nINSTRUCTION: Your script MUST strongly match this reference video's:
- Hook style and opening technique (use "${hook?.type || 'similar'}" hook approach)
- Energy arc and pacing progression (${overall?.energyArc || 'build-to-peak'})
- Segment structure and timing
- Product reveal pattern (${segments.map((s: any) => s.scene?.productPresence || 'none').join(' → ')})
Adapt the CONTENT for the current product while preserving the reference's proven viral STRUCTURE and ENERGY.`;

    return block;
  }

  // ─── Validation ────────────────────────────────────────────────────────────

  private validateAndFix(script: ScriptResponse): void {
    const { min, max, warnMin, warnMax } = this.videoModel.syllables_per_segment;

    let totalSyllables = 0;

    for (const seg of script.segments) {
      // Override LLM's syllable count with programmatic count
      const programmaticCount = countTextSyllables(seg.script_text);
      if (programmaticCount !== seg.syllable_count) {
        this.log(
          `[Validation] Segment ${seg.id} "${seg.section}": LLM reported ${seg.syllable_count} syllables, programmatic count is ${programmaticCount}. Overriding.`
        );
        seg.syllable_count = programmaticCount;
      }

      totalSyllables += programmaticCount;

      // Warn on syllable range (don't throw)
      if (programmaticCount < warnMin || programmaticCount > warnMax) {
        this.log(
          `[Validation] WARNING: Segment ${seg.id} "${seg.section}" has ${programmaticCount} syllables (target: ${min}-${max})`
        );
      }

      // Validate shot_scripts count
      if (!seg.shot_scripts || seg.shot_scripts.length !== this.videoModel.shots_per_segment) {
        this.log(
          `[Validation] WARNING: Segment ${seg.id} has ${seg.shot_scripts?.length ?? 0} shot_scripts, expected ${this.videoModel.shots_per_segment}`
        );
      }
    }

    // Override total syllables
    script.total_syllables = totalSyllables;

    // Validate segment count
    if (script.segments.length !== this.videoModel.segment_count) {
      this.log(
        `[Validation] WARNING: Expected ${this.videoModel.segment_count} segments, got ${script.segments.length}`
      );
    }

    // Validate hook score (>= 10)
    if (script.hook_score.total < PIPELINE_CONFIG.hookScoreMinimum) {
      this.log(
        `[Validation] WARNING: Hook score ${script.hook_score.total} is below minimum ${PIPELINE_CONFIG.hookScoreMinimum}`
      );
    }

    // Recalculate hook total from components
    const recalculated =
      script.hook_score.curiosity_loop +
      script.hook_score.challenges_belief +
      script.hook_score.clear_context +
      script.hook_score.plants_question +
      script.hook_score.pattern_interrupt +
      script.hook_score.emotional_trigger +
      script.hook_score.specific_claim;

    if (recalculated !== script.hook_score.total) {
      this.log(
        `[Validation] Hook score total mismatch: reported ${script.hook_score.total}, calculated ${recalculated}. Overriding.`
      );
      script.hook_score.total = recalculated;
    }

    this.log(`[Validation] Total syllables: ${totalSyllables}, Hook score: ${script.hook_score.total}`);
  }

  // ─── Versioning (A5) ──────────────────────────────────────────────────────

  private async getNextVersion(projectId: string): Promise<number> {
    const { data: latest } = await this.supabase
      .from('script')
      .select('version')
      .eq('project_id', projectId)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    const nextVersion = (latest?.version ?? 0) + 1;
    this.log(`Script version: ${nextVersion}`);
    return nextVersion;
  }
}
