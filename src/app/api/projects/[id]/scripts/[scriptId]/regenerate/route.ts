import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { getPipelineQueue } from '@/lib/queue';
import { logger } from '@/lib/logger';

/**
 * POST /api/projects/[id]/scripts/[scriptId]/regenerate
 *
 * Stores feedback on the current script (if provided),
 * re-enqueues the 'scripting' step, and sets project status back to 'scripting'.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; scriptId: string }> }
) {
  const { id, scriptId } = await params;

  try {
    // Verify the script belongs to this project
    const { data: script, error: scriptError } = await supabase
      .from('script')
      .select('id, project_id')
      .eq('id', scriptId)
      .eq('project_id', id)
      .single();

    if (scriptError || !script) {
      return NextResponse.json(
        { error: 'Script not found for this project' },
        { status: 404 }
      );
    }

    // Store feedback on current script if provided, and optionally update tone
    let body: { feedback?: string; tone?: string } = {};
    try {
      body = await request.json();
    } catch {
      // No body is fine
    }

    if (body.feedback) {
      await supabase
        .from('script')
        .update({ feedback: body.feedback })
        .eq('id', scriptId);
    }

    // Update project tone if a new tone was specified for regeneration
    const projectUpdate: Record<string, string> = {
      status: 'scripting',
      updated_at: new Date().toISOString(),
    };
    if (body.tone) {
      projectUpdate.tone = body.tone;
    }

    // Set project status back to scripting (and optionally update tone)
    await supabase
      .from('project')
      .update(projectUpdate)
      .eq('id', id);

    // Re-enqueue scripting step
    await getPipelineQueue().add('scripting', {
      projectId: id,
      step: 'scripting',
    });

    return NextResponse.json({
      message: 'Script regeneration enqueued',
      projectId: id,
      previousScriptId: scriptId,
    });
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/scripts/[scriptId]/regenerate' }, 'Error regenerating script');
    return NextResponse.json(
      { error: 'Failed to regenerate script' },
      { status: 500 }
    );
  }
}
