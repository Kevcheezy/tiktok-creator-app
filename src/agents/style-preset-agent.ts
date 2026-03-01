import { SupabaseClient } from '@supabase/supabase-js';
import { unlink, readFile } from 'fs/promises';
import path from 'path';
import os from 'os';
import { BaseAgent } from './base-agent';
import { GeminiClient } from '@/lib/api-clients/gemini';
import { API_COSTS } from '@/lib/constants';
import { downloadTikTokVideo } from '@/lib/tiktok-video-downloader';

// ---------------------------------------------------------------------------
// StylePresetAnalysis interface
// ---------------------------------------------------------------------------

export interface StylePresetAnalysis {
  transcript: {
    full_text: string;
    segments: Array<{
      index: number;
      section: string;
      text: string;
      start_time: number;
      end_time: number;
    }>;
  };
  segment_scores: {
    hook: Record<string, number>;
    problem: Record<string, number>;
    solution: Record<string, number>;
    cta: Record<string, number>;
  };
  total_score: number;
  patterns: {
    hook_technique: string;
    energy_arc: Record<string, unknown>;
    product_integration_style: string;
    cta_formula: string;
    pacing: string;
  };
  visual_style: {
    segments: Array<{
      scene: { setting: string; props: string[]; composition: string; productPresence: string };
      emotion: { mood: string; energy: string; pacing: string; viewerIntent: string };
      angle: { shotType: string; cameraMovement: string; transitions: string };
      lighting: { style: string; colorTemp: string; contrast: string };
    }>;
    overall: Record<string, unknown>;
  };
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert TikTok UGC video analyst. Your job is to analyze a reference TikTok UGC review video, extract its scriptwriting formula, and return comprehensive structured data.

You MUST respond with valid JSON only. No markdown, no code fences, no explanation text. Just the raw JSON object.`;

const USER_PROMPT = `Analyze this TikTok UGC review video. Perform ALL of the following in one pass:

1. TRANSCRIBE the spoken audio word-for-word.

2. SEGMENT the transcript into 4 segments (~10 seconds each):
   - Segment 0 (Hook): The attention-grabbing opener
   - Segment 1 (Problem): The pain point or problem setup
   - Segment 2 (Solution + Product): Product introduction and benefits
   - Segment 3 (CTA): Call to action / closing

3. SCORE each segment on these criteria (0 = absent, 1 = present but weak, 2 = strong):

   Hook (Segment 0):
   - curiosity_loop: Opens an unanswered question
   - challenges_belief: Contradicts a common assumption
   - clear_context: Setup is immediately obvious
   - plants_question: Creates doubt in viewer's mind
   - pattern_interrupt: Uses visual/verbal pattern interrupt
   - emotional_trigger: Contains emotional word/phrase
   - specific_claim: Includes specific number or claim

   Problem (Segment 1):
   - relatability: Viewer immediately recognizes this problem
   - pain_amplification: Makes the problem feel urgent/unbearable
   - credibility: References real experiences/common frustrations
   - emotional_depth: Triggers empathy/frustration/fear
   - transition_setup: Naturally leads to the solution

   Solution + Product (Segment 2):
   - product_integration: Product introduced naturally, not forced
   - proof_evidence: Includes specific claims/stats/results
   - transformation_narrative: Clear before->after story
   - differentiation: Why THIS product over alternatives
   - authenticity: Delivery feels genuine, not salesy

   CTA (Segment 3):
   - urgency: Reason to act NOW
   - value_stack: Reinforces what you get
   - social_proof: References others' success/popularity
   - clear_action: Next step is obvious
   - scarcity_exclusivity: Limited time/stock/offer

4. EXTRACT PATTERNS:
   - hook_technique: The dominant hook type (e.g., "curiosity_gap", "challenge_belief", "pattern_interrupt", "direct_address", "controversial_take")
   - energy_arc: Per-segment energy levels { start, middle, end } for each segment
   - product_integration_style: How product appears across segments (e.g., "subtle_to_hero", "hero_throughout", "late_reveal")
   - cta_formula: Primary CTA technique (e.g., "urgency_scarcity", "social_proof_stack", "value_anchor", "fomo")
   - pacing: Overall pacing style (e.g., "fast_cuts", "steady_build", "slow_reveal")

5. SEAL VISUAL ANALYSIS (per segment):
   For each segment, analyze:
   - scene: { setting, props, composition, productPresence }
   - emotion: { mood, energy, pacing, viewerIntent }
   - angle: { shotType, cameraMovement, transitions }
   - lighting: { style, colorTemp, contrast }

Return as JSON:
{
  "transcript": {
    "full_text": "...",
    "segments": [
      { "index": 0, "section": "Hook", "text": "...", "start_time": 0, "end_time": 15 },
      { "index": 1, "section": "Problem", "text": "...", "start_time": 15, "end_time": 30 },
      { "index": 2, "section": "Solution + Product", "text": "...", "start_time": 30, "end_time": 45 },
      { "index": 3, "section": "CTA", "text": "...", "start_time": 45, "end_time": 60 }
    ]
  },
  "segment_scores": {
    "hook": { "curiosity_loop": 2, "challenges_belief": 1, "clear_context": 2, "plants_question": 1, "pattern_interrupt": 2, "emotional_trigger": 1, "specific_claim": 2, "total": 11 },
    "problem": { "relatability": 2, "pain_amplification": 1, "credibility": 2, "emotional_depth": 1, "transition_setup": 2, "total": 8 },
    "solution": { "product_integration": 2, "proof_evidence": 1, "transformation_narrative": 2, "differentiation": 1, "authenticity": 2, "total": 8 },
    "cta": { "urgency": 1, "value_stack": 2, "social_proof": 1, "clear_action": 2, "scarcity_exclusivity": 1, "total": 7 }
  },
  "total_score": 34,
  "patterns": {
    "hook_technique": "curiosity_gap",
    "energy_arc": {
      "segment_0": { "start": "HIGH", "middle": "HIGH", "end": "HIGH" },
      "segment_1": { "start": "LOW", "middle": "PEAK", "end": "LOW" },
      "segment_2": { "start": "LOW", "middle": "PEAK", "end": "LOW" },
      "segment_3": { "start": "LOW", "middle": "PEAK", "end": "LOW" }
    },
    "product_integration_style": "subtle_to_hero",
    "cta_formula": "urgency_scarcity",
    "pacing": "steady_build"
  },
  "visual_style": {
    "segments": [
      {
        "scene": { "setting": "...", "props": ["..."], "composition": "...", "productPresence": "..." },
        "emotion": { "mood": "...", "energy": "...", "pacing": "...", "viewerIntent": "..." },
        "angle": { "shotType": "...", "cameraMovement": "...", "transitions": "..." },
        "lighting": { "style": "...", "colorTemp": "...", "contrast": "..." }
      }
    ],
    "overall": { "dominantStyle": "...", "energyArc": "...", "musicPresence": true, "textOverlayStyle": "..." }
  }
}`;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
const DOWNLOAD_TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class StylePresetAgent extends BaseAgent {
  private gemini: GeminiClient;

  constructor(supabaseClient?: SupabaseClient) {
    super('StylePresetAgent', supabaseClient);
    this.gemini = new GeminiClient();
  }

  async run(presetId: string): Promise<StylePresetAnalysis | null> {
    const stageStart = Date.now();
    this.log(`Starting style preset analysis for preset ${presetId}`);

    const tmpPath = path.join(os.tmpdir(), `${presetId}-style-reference.mp4`);

    try {
      // ---------------------------------------------------------------
      // 1. Fetch style_preset record from DB
      // ---------------------------------------------------------------
      const { data: preset, error: fetchError } = await this.supabase
        .from('style_preset')
        .select('id, video_url')
        .eq('id', presetId)
        .single();

      if (fetchError) {
        this.log(`Failed to fetch style_preset: ${fetchError.message}`, { presetId });
        await this.setFailed(presetId, `Failed to fetch style_preset: ${fetchError.message}`);
        return null;
      }

      if (!preset?.video_url) {
        this.log('No video_url set on style_preset — cannot analyze', { presetId });
        await this.setFailed(presetId, 'No video_url provided');
        return null;
      }

      const videoUrl = preset.video_url;
      this.log(`Video URL found: ${videoUrl}`, { presetId });

      // ---------------------------------------------------------------
      // 2. Download video
      // ---------------------------------------------------------------
      await this.setStep(presetId, 'downloading');
      let stepStart = Date.now();
      this.log('Downloading video...', { presetId });

      let downloadResult: { sizeBytes: number; source: string };
      try {
        downloadResult = await downloadTikTokVideo(videoUrl, tmpPath, {
          timeoutMs: DOWNLOAD_TIMEOUT_MS,
          maxSizeBytes: MAX_FILE_SIZE_BYTES,
        });
      } catch (dlError) {
        const msg = dlError instanceof Error ? dlError.message : String(dlError);
        this.log(`Video download failed: ${msg}`, { presetId });
        await this.setFailed(presetId, `Video download failed: ${msg}`);
        return null;
      }

      this.log(`Video downloaded via ${downloadResult.source}: ${(downloadResult.sizeBytes / 1024 / 1024).toFixed(1)}MB in ${((Date.now() - stepStart) / 1000).toFixed(1)}s`, { presetId, step: 'downloading' });

      // ---------------------------------------------------------------
      // 3. Upload to Supabase Storage
      // ---------------------------------------------------------------
      await this.setStep(presetId, 'uploading');
      stepStart = Date.now();
      this.log('Uploading video to Supabase Storage...', { presetId });
      const storagePath = `style-presets/${presetId}/reference.mp4`;

      const fileBuffer = await readFile(tmpPath);

      const { error: uploadError } = await this.supabase.storage
        .from('assets')
        .upload(storagePath, fileBuffer, {
          contentType: 'video/mp4',
          upsert: true,
        });

      if (uploadError) {
        this.log(`Supabase Storage upload failed: ${uploadError.message}`, { presetId });
        // Non-blocking: continue with analysis even if upload fails
      } else {
        const { data: publicUrlData } = this.supabase.storage
          .from('assets')
          .getPublicUrl(storagePath);
        this.log(`Video uploaded to storage in ${((Date.now() - stepStart) / 1000).toFixed(1)}s: ${publicUrlData.publicUrl}`, { presetId, step: 'uploading' });

        // Save storage path to record
        await this.supabase
          .from('style_preset')
          .update({
            video_storage_path: storagePath,
            updated_at: new Date().toISOString(),
          })
          .eq('id', presetId);
      }

      // ---------------------------------------------------------------
      // 4. Send to Gemini for analysis
      // ---------------------------------------------------------------
      await this.setStep(presetId, 'analyzing');
      stepStart = Date.now();
      this.log('Sending video to Gemini for style preset analysis...', { presetId });

      let rawResponse: string;
      try {
        rawResponse = await this.gemini.analyzeVideo(tmpPath, SYSTEM_PROMPT, USER_PROMPT, {
          temperature: 0.3,
        });
      } catch (geminiError) {
        const msg = geminiError instanceof Error ? geminiError.message : String(geminiError);
        this.log(`Gemini video analysis failed after ${((Date.now() - stepStart) / 1000).toFixed(1)}s: ${msg}`, { presetId, step: 'analyzing' });
        await this.setFailed(presetId, `Gemini analysis failed: ${msg}`);
        return null;
      }

      this.log(`Gemini analysis completed in ${((Date.now() - stepStart) / 1000).toFixed(1)}s, response length=${rawResponse.length}`, { presetId, step: 'analyzing' });

      // ---------------------------------------------------------------
      // 5. Parse JSON response
      // ---------------------------------------------------------------
      await this.setStep(presetId, 'parsing');
      this.log('Parsing Gemini response...', { presetId });
      let analysis: StylePresetAnalysis;

      try {
        // Strip markdown code fences if present
        const cleaned = rawResponse
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        analysis = JSON.parse(cleaned);
      } catch (parseError) {
        const msg = parseError instanceof Error ? parseError.message : String(parseError);
        this.log(`Failed to parse Gemini response as JSON: ${msg}`, {
          presetId,
          responsePreview: rawResponse.substring(0, 500),
        });
        await this.setFailed(presetId, `Failed to parse Gemini response: ${msg}`);
        return null;
      }

      // ---------------------------------------------------------------
      // 6. Validate structure
      // ---------------------------------------------------------------
      if (!analysis.transcript || !analysis.segment_scores || !analysis.patterns || !analysis.visual_style) {
        this.log('Gemini response missing required fields', {
          presetId,
          hasTranscript: !!analysis.transcript,
          hasSegmentScores: !!analysis.segment_scores,
          hasPatterns: !!analysis.patterns,
          hasVisualStyle: !!analysis.visual_style,
        });
        await this.setFailed(presetId, 'Gemini response missing required fields (transcript, segment_scores, patterns, visual_style)');
        return null;
      }

      if (!analysis.transcript.segments || !Array.isArray(analysis.transcript.segments) || analysis.transcript.segments.length === 0) {
        this.log('Gemini response has empty or non-array transcript segments', { presetId });
        await this.setFailed(presetId, 'Gemini response has invalid transcript segments');
        return null;
      }

      this.log(`Style preset analysis complete: ${analysis.transcript.segments.length} segments, total_score=${analysis.total_score}, hook_technique="${analysis.patterns.hook_technique}"`, { presetId });

      // ---------------------------------------------------------------
      // 7. Update style_preset record with results
      // ---------------------------------------------------------------
      await this.setStep(presetId, 'saving');
      const { error: updateError } = await this.supabase
        .from('style_preset')
        .update({
          transcript: analysis.transcript,
          segment_scores: analysis.segment_scores,
          total_score: analysis.total_score,
          patterns: analysis.patterns,
          visual_style: analysis.visual_style,
          status: 'ready',
          current_step: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', presetId);

      if (updateError) {
        this.log(`Failed to save analysis to style_preset: ${updateError.message}`, { presetId });
        await this.setFailed(presetId, `Failed to save analysis results: ${updateError.message}`);
        return null;
      }

      // ---------------------------------------------------------------
      // 8. Track cost
      // ---------------------------------------------------------------
      // Style presets are not tied to a project, but we still want to
      // track Gemini usage. Use presetId as a pseudo-project-id for cost
      // tracking. The trackCost method will gracefully handle this.
      try {
        await this.trackCost(presetId, API_COSTS.geminiVideoAnalysis);
      } catch {
        // Cost tracking failure is non-blocking for style presets
        this.log('Cost tracking skipped (style preset has no project)', { presetId });
      }

      const durationMs = Date.now() - stageStart;
      this.log(`Style preset analysis complete in ${(durationMs / 1000).toFixed(1)}s`, {
        presetId,
        segmentCount: analysis.transcript.segments.length,
        totalScore: analysis.total_score,
        hookTechnique: analysis.patterns.hook_technique,
      });

      return analysis;
    } catch (unexpectedError) {
      const msg = unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError);
      this.log(`Unexpected error in style preset analysis: ${msg}`, { presetId });
      await this.setFailed(presetId, `Unexpected error: ${msg}`);
      return null;
    } finally {
      // ---------------------------------------------------------------
      // 9. Clean up temp file
      // ---------------------------------------------------------------
      try {
        await unlink(tmpPath);
        this.log('Temp file cleaned up', { tmpPath });
      } catch {
        // File may not exist if download failed — ignore
      }
    }
  }

  /**
   * Update the current_step field so the frontend can show real progress.
   */
  private async setStep(presetId: string, step: string): Promise<void> {
    try {
      await this.supabase
        .from('style_preset')
        .update({
          current_step: step,
          updated_at: new Date().toISOString(),
        })
        .eq('id', presetId);
    } catch (err) {
      this.log(`Failed to set current_step=${step}: ${err instanceof Error ? err.message : String(err)}`, { presetId });
    }
  }

  /**
   * Set the style_preset status to 'failed' with an error message.
   */
  private async setFailed(presetId: string, errorMessage: string): Promise<void> {
    try {
      await this.supabase
        .from('style_preset')
        .update({
          status: 'failed',
          error_message: errorMessage,
          current_step: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', presetId);
    } catch (err) {
      this.log(`Failed to set status=failed: ${err instanceof Error ? err.message : String(err)}`, { presetId });
    }
  }
}
