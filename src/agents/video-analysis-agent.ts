import { SupabaseClient } from '@supabase/supabase-js';
import { unlink } from 'fs/promises';
import path from 'path';
import os from 'os';
import { BaseAgent } from './base-agent';
import { GeminiClient } from '@/lib/api-clients/gemini';
import { API_COSTS } from '@/lib/constants';
import { downloadTikTokVideo } from '@/lib/tiktok-video-downloader';

// ---------------------------------------------------------------------------
// VideoAnalysis interface — SEAL method (Scene, Emotion, Angle, Lighting)
// ---------------------------------------------------------------------------

export interface VideoAnalysis {
  hook: {
    type: string;
    technique: string;
    text: string;
    durationSeconds: number;
  };
  segments: Array<{
    index: number;
    startTime: number;
    endTime: number;
    scene: {
      setting: string;
      props: string[];
      composition: string;
      productPresence: string;
    };
    emotion: {
      mood: string;
      energy: string;
      pacing: string;
      viewerIntent: string;
    };
    angle: {
      shotType: string;
      cameraMovement: string;
      transitions: string;
    };
    lighting: {
      style: string;
      colorTemp: string;
      contrast: string;
    };
    description: string;
  }>;
  overall: {
    energyArc: string;
    dominantStyle: string;
    musicPresence: boolean;
    textOverlayStyle: string;
    estimatedDuration: number;
    viralPattern: string;
  };
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert TikTok video analyst specializing in viral UGC content. Your job is to break down reference videos using the SEAL method:

- **S**cene: Setting, props, composition, product placement
- **E**motion: Mood, energy level, pacing, viewer intent
- **A**ngle: Shot type, camera movement, transitions
- **L**ighting: Style, color temperature, contrast

You MUST respond with valid JSON only. No markdown, no code fences, no explanation text. Just the raw JSON object.

The JSON MUST conform to this exact schema:

{
  "hook": {
    "type": "string — hook category (e.g. 'pattern-interrupt', 'question', 'bold-claim', 'visual-shock', 'direct-address')",
    "technique": "string — specific technique used (e.g. 'rapid zoom with text overlay', 'whispering close-up')",
    "text": "string — the actual words spoken or shown in the hook (first 3-5 seconds)",
    "durationSeconds": "number — how many seconds the hook lasts"
  },
  "segments": [
    {
      "index": 0,
      "startTime": 0,
      "endTime": 15,
      "scene": {
        "setting": "string — detailed environment description (e.g. 'bright modern bathroom with marble countertop, plant in corner')",
        "props": ["array of visible objects and products"],
        "composition": "string — how the frame is composed (e.g. 'subject centered, product on right third, negative space top')",
        "productPresence": "string — how the product appears (e.g. 'none', 'background blur', 'held in hand close-up', 'hero shot on table')"
      },
      "emotion": {
        "mood": "string — emotional tone (e.g. 'curious', 'excited', 'skeptical', 'confident')",
        "energy": "string — energy level: 'low', 'medium', 'high', 'explosive'",
        "pacing": "string — editing rhythm (e.g. 'rapid cuts every 2s', 'slow single shot', 'medium with jump cuts')",
        "viewerIntent": "string — what the viewer should feel (e.g. 'intrigued to keep watching', 'fear of missing out', 'trust building')"
      },
      "angle": {
        "shotType": "string — camera framing (e.g. 'extreme close-up', 'medium shot waist-up', 'wide establishing shot', 'over-shoulder')",
        "cameraMovement": "string — how camera moves (e.g. 'static tripod', 'handheld slight shake', 'slow pan left to right', 'quick zoom in')",
        "transitions": "string — how this segment transitions to the next (e.g. 'hard cut', 'swipe right', 'zoom through', 'match cut')"
      },
      "lighting": {
        "style": "string — lighting approach (e.g. 'natural window light', 'ring light front-facing', 'dramatic side light', 'soft diffused')",
        "colorTemp": "string — warm, neutral, or cool tone",
        "contrast": "string — 'low/flat', 'medium/balanced', 'high/dramatic'"
      },
      "description": "string — one-paragraph visual description of this segment, detailed enough to serve as an AI image generation prompt. Be specific about the person's pose, expression, clothing, what they're doing with their hands, and the background elements."
    }
  ],
  "overall": {
    "energyArc": "string — describe the energy progression across all segments (e.g. 'high-low-peak-medium: hook grabs attention, problem calms, solution peaks, CTA settles')",
    "dominantStyle": "string — overall visual style (e.g. 'clean minimalist UGC', 'raw authentic bathroom selfie', 'professional studio look')",
    "musicPresence": "boolean — whether background music is detected",
    "textOverlayStyle": "string — how text overlays are used (e.g. 'bold white Impact font with black outline, key phrases only', 'no text overlays', 'subtitles throughout')",
    "estimatedDuration": "number — total video duration in seconds",
    "viralPattern": "string — the viral content pattern used (e.g. 'problem-agitation-solution', 'before-after transformation', 'storytime with reveal', 'educational with shock stat')"
  }
}

RULES:
- Break the video into EXACTLY 4 segments of approximately 15 seconds each (adjust endTime if video is shorter/longer)
- Segments must have index values 0, 1, 2, 3
- Be extremely specific and visual in descriptions — they will be used as prompts for AI image generation
- Include colors, textures, spatial relationships, and body language details
- For the description field, write as if you're describing the scene to an AI image generator
- Identify the specific viral content pattern being used
- If the video is shorter than 60s, still break into 4 segments proportionally`;

const USER_PROMPT = `Analyze this reference TikTok video in detail.

Break the video into exactly 4 segments and provide comprehensive SEAL (Scene, Emotion, Angle, Lighting) data for each segment.

This analysis will be used for:
1. Generating AI keyframe images that match the reference video's visual style
2. Writing a script that follows the same energy arc and content pattern
3. Directing camera angles and transitions in the final production

Be as specific and visual as possible in every field. Vague descriptions are not useful — I need enough detail to recreate the visual style with AI image generation.`;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
const DOWNLOAD_TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class VideoAnalysisAgent extends BaseAgent {
  private gemini: GeminiClient;

  constructor(supabaseClient?: SupabaseClient) {
    super('VideoAnalysisAgent', supabaseClient);
    this.gemini = new GeminiClient();
  }

  async run(projectId: string): Promise<VideoAnalysis | null> {
    const stageStart = Date.now();
    await this.logEvent(projectId, 'stage_start', 'video_analysis');
    this.log(`Starting video analysis for project ${projectId}`);

    const tmpPath = path.join(os.tmpdir(), `${projectId}-reference.mp4`);

    try {
      // ---------------------------------------------------------------
      // 1. Fetch project.video_url from DB
      // ---------------------------------------------------------------
      const { data: project, error: fetchError } = await this.supabase
        .from('project')
        .select('video_url')
        .eq('id', projectId)
        .single();

      if (fetchError) {
        this.log(`Failed to fetch project: ${fetchError.message}`, { projectId });
        await this.setVideoAnalysisNull(projectId);
        return null;
      }

      // ---------------------------------------------------------------
      // 2. If no video_url, log and return null (not an error)
      // ---------------------------------------------------------------
      if (!project?.video_url) {
        this.log('No video_url set on project — skipping video analysis', { projectId });
        await this.logEvent(projectId, 'skipped', 'video_analysis', {
          reason: 'no_video_url',
        });
        return null;
      }

      const videoUrl = project.video_url;
      this.log(`Video URL found: ${videoUrl}`, { projectId });

      // ---------------------------------------------------------------
      // 3. Download video
      // ---------------------------------------------------------------
      this.log('Downloading video...', { projectId });
      await this.logEvent(projectId, 'download_start', 'video_analysis', {
        url: videoUrl,
      });

      let downloadResult: { sizeBytes: number; source: string };
      try {
        downloadResult = await downloadTikTokVideo(videoUrl, tmpPath, {
          timeoutMs: DOWNLOAD_TIMEOUT_MS,
          maxSizeBytes: MAX_FILE_SIZE_BYTES,
        });
      } catch (dlError) {
        const msg = dlError instanceof Error ? dlError.message : String(dlError);
        this.log(`Video download failed: ${msg}`, { projectId });
        await this.logEvent(projectId, 'error', 'video_analysis', {
          step: 'download',
          error: msg,
        });
        await this.setVideoAnalysisNull(projectId);
        return null;
      }

      this.log(`Video downloaded via ${downloadResult.source}: ${(downloadResult.sizeBytes / 1024 / 1024).toFixed(1)}MB`, { projectId });

      // ---------------------------------------------------------------
      // 4. Upload to Supabase Storage
      // ---------------------------------------------------------------
      this.log('Uploading video to Supabase Storage...', { projectId });
      const storagePath = `projects/${projectId}/reference.mp4`;

      const { readFile } = await import('fs/promises');
      const fileBuffer = await readFile(tmpPath);

      const { error: uploadError } = await this.supabase.storage
        .from('assets')
        .upload(storagePath, fileBuffer, {
          contentType: 'video/mp4',
          upsert: true,
        });

      if (uploadError) {
        this.log(`Supabase Storage upload failed: ${uploadError.message}`, { projectId });
        await this.logEvent(projectId, 'error', 'video_analysis', {
          step: 'storage_upload',
          error: uploadError.message,
        });
        // Non-blocking: continue with analysis even if upload fails
      } else {
        const { data: publicUrlData } = this.supabase.storage
          .from('assets')
          .getPublicUrl(storagePath);
        this.log(`Video uploaded to storage: ${publicUrlData.publicUrl}`, { projectId });
      }

      // ---------------------------------------------------------------
      // 5. Send to Gemini for analysis
      // ---------------------------------------------------------------
      this.log('Sending video to Gemini for SEAL analysis...', { projectId });
      await this.logEvent(projectId, 'gemini_start', 'video_analysis');

      let rawResponse: string;
      try {
        rawResponse = await this.gemini.analyzeVideo(tmpPath, SYSTEM_PROMPT, USER_PROMPT, {
          temperature: 0.3,
        });
      } catch (geminiError) {
        const msg = geminiError instanceof Error ? geminiError.message : String(geminiError);
        this.log(`Gemini video analysis failed: ${msg}`, { projectId });
        await this.logEvent(projectId, 'error', 'video_analysis', {
          step: 'gemini_analysis',
          error: msg,
        });
        await this.setVideoAnalysisNull(projectId);
        return null;
      }

      // ---------------------------------------------------------------
      // 6. Parse JSON response
      // ---------------------------------------------------------------
      this.log('Parsing Gemini response...', { projectId });
      let analysis: VideoAnalysis;

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
          projectId,
          responsePreview: rawResponse.substring(0, 500),
        });
        await this.logEvent(projectId, 'error', 'video_analysis', {
          step: 'json_parse',
          error: msg,
          responsePreview: rawResponse.substring(0, 500),
        });
        await this.setVideoAnalysisNull(projectId);
        return null;
      }

      // ---------------------------------------------------------------
      // 7. Validate structure — must have hook, segments, overall
      // ---------------------------------------------------------------
      if (!analysis.hook || !analysis.segments || !analysis.overall) {
        this.log('Gemini response missing required fields (hook, segments, overall)', {
          projectId,
          hasHook: !!analysis.hook,
          hasSegments: !!analysis.segments,
          hasOverall: !!analysis.overall,
        });
        await this.logEvent(projectId, 'error', 'video_analysis', {
          step: 'validation',
          error: 'missing_required_fields',
        });
        await this.setVideoAnalysisNull(projectId);
        return null;
      }

      if (!Array.isArray(analysis.segments) || analysis.segments.length === 0) {
        this.log('Gemini response has empty or non-array segments', { projectId });
        await this.logEvent(projectId, 'error', 'video_analysis', {
          step: 'validation',
          error: 'invalid_segments',
        });
        await this.setVideoAnalysisNull(projectId);
        return null;
      }

      this.log(`SEAL analysis complete: ${analysis.segments.length} segments, hook type="${analysis.hook.type}", pattern="${analysis.overall.viralPattern}"`, { projectId });

      // ---------------------------------------------------------------
      // 8. Store video_analysis JSONB on the project record
      // ---------------------------------------------------------------
      const { error: updateError } = await this.supabase
        .from('project')
        .update({
          video_analysis: analysis,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      if (updateError) {
        this.log(`Failed to save video_analysis to project: ${updateError.message}`, { projectId });
        await this.logEvent(projectId, 'error', 'video_analysis', {
          step: 'db_save',
          error: updateError.message,
        });
        // Analysis succeeded even if save fails — return it anyway
      }

      // ---------------------------------------------------------------
      // 9. Track cost
      // ---------------------------------------------------------------
      await this.trackCost(projectId, API_COSTS.geminiVideoAnalysis);

      const durationMs = Date.now() - stageStart;
      await this.logEvent(projectId, 'stage_complete', 'video_analysis', {
        durationMs,
        segmentCount: analysis.segments.length,
        hookType: analysis.hook.type,
        viralPattern: analysis.overall.viralPattern,
      });
      this.log(`Video analysis complete in ${(durationMs / 1000).toFixed(1)}s`, { projectId });

      return analysis;
    } catch (unexpectedError) {
      // Catch-all for any unexpected errors — agent is NON-BLOCKING
      const msg = unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError);
      this.log(`Unexpected error in video analysis: ${msg}`, { projectId });
      await this.logEvent(projectId, 'error', 'video_analysis', {
        step: 'unexpected',
        error: msg,
      });
      await this.setVideoAnalysisNull(projectId);
      return null;
    } finally {
      // ---------------------------------------------------------------
      // 10. Clean up temp file
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
   * Set video_analysis to null on the project record.
   * Used when analysis fails — signals downstream agents that no SEAL data is available.
   */
  private async setVideoAnalysisNull(projectId: string): Promise<void> {
    try {
      await this.supabase
        .from('project')
        .update({
          video_analysis: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);
    } catch (err) {
      // Even this can fail — don't let it propagate
      this.log(`Failed to set video_analysis=null: ${err instanceof Error ? err.message : String(err)}`, { projectId });
    }
  }
}
