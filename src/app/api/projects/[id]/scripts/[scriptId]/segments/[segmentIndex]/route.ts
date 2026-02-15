import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { countTextSyllables } from '@/lib/syllables';

// PATCH /api/projects/[id]/scripts/[scriptId]/segments/[segmentIndex]
// Body: { script_text?: string, text_overlay?: string }
// Creates a new versioned scene row (per-segment history)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; scriptId: string; segmentIndex: string }> }
) {
  const { id, scriptId, segmentIndex: segmentIndexStr } = await params;
  const segmentIndex = parseInt(segmentIndexStr, 10);

  if (isNaN(segmentIndex) || segmentIndex < 0 || segmentIndex > 3) {
    return NextResponse.json(
      { error: 'segmentIndex must be 0-3' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();

    // Validate at least one field to update
    const hasScriptText = 'script_text' in body && typeof body.script_text === 'string';
    const hasTextOverlay = 'text_overlay' in body && typeof body.text_overlay === 'string';

    if (!hasScriptText && !hasTextOverlay) {
      return NextResponse.json(
        { error: 'No valid fields to update. Allowed: script_text, text_overlay' },
        { status: 400 }
      );
    }

    // Verify script belongs to project
    const { data: script, error: scriptError } = await supabase
      .from('script')
      .select('id')
      .eq('id', scriptId)
      .eq('project_id', id)
      .single();

    if (scriptError || !script) {
      return NextResponse.json(
        { error: 'Script not found for this project' },
        { status: 404 }
      );
    }

    // Get the current latest scene for this segment
    const { data: currentScene, error: currentError } = await supabase
      .from('scene')
      .select('*')
      .eq('script_id', scriptId)
      .eq('segment_index', segmentIndex)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (currentError || !currentScene) {
      return NextResponse.json(
        { error: 'Scene not found' },
        { status: 404 }
      );
    }

    // INSERT new versioned row with edits applied
    const newVersion = (currentScene.version ?? 1) + 1;
    const { data: newScene, error: insertError } = await supabase
      .from('scene')
      .insert({
        script_id: scriptId,
        segment_index: segmentIndex,
        section: currentScene.section,
        script_text: hasScriptText ? body.script_text : currentScene.script_text,
        syllable_count: hasScriptText ? countTextSyllables(body.script_text) : currentScene.syllable_count,
        energy_arc: currentScene.energy_arc,
        shot_scripts: currentScene.shot_scripts,
        audio_sync: currentScene.audio_sync,
        text_overlay: hasTextOverlay ? body.text_overlay : currentScene.text_overlay,
        product_visibility: currentScene.product_visibility,
        tone: currentScene.tone,
        version: newVersion,
      })
      .select()
      .single();

    if (insertError || !newScene) {
      return NextResponse.json(
        { error: 'Failed to create scene version' },
        { status: 500 }
      );
    }

    // Recalculate script.full_text from latest version of each segment
    const { data: allScenes } = await supabase
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
      await supabase.from('script').update({ full_text: newFullText }).eq('id', scriptId);
    }

    return NextResponse.json(newScene);
  } catch (error) {
    console.error('Error editing segment:', error);
    return NextResponse.json(
      { error: 'Failed to edit segment' },
      { status: 500 }
    );
  }
}

// GET /api/projects/[id]/scripts/[scriptId]/segments/[segmentIndex]
// Returns version history for a specific segment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; scriptId: string; segmentIndex: string }> }
) {
  const { id, scriptId, segmentIndex: segmentIndexStr } = await params;
  const segmentIndex = parseInt(segmentIndexStr, 10);

  if (isNaN(segmentIndex) || segmentIndex < 0 || segmentIndex > 3) {
    return NextResponse.json(
      { error: 'segmentIndex must be 0-3' },
      { status: 400 }
    );
  }

  try {
    // Verify script belongs to project
    const { data: script, error: scriptError } = await supabase
      .from('script')
      .select('id')
      .eq('id', scriptId)
      .eq('project_id', id)
      .single();

    if (scriptError || !script) {
      return NextResponse.json(
        { error: 'Script not found for this project' },
        { status: 404 }
      );
    }

    // Get all versions of this segment
    const { data: versions, error } = await supabase
      .from('scene')
      .select('*')
      .eq('script_id', scriptId)
      .eq('segment_index', segmentIndex)
      .order('version', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch segment history' },
        { status: 500 }
      );
    }

    return NextResponse.json(versions || []);
  } catch (error) {
    console.error('Error fetching segment history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch segment history' },
      { status: 500 }
    );
  }
}
