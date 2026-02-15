import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { getPipelineQueue } from '@/lib/queue';

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

    // Store feedback on current script if provided
    let body: { feedback?: string } = {};
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

    // Set project status back to scripting
    await supabase
      .from('project')
      .update({ status: 'scripting', updated_at: new Date().toISOString() })
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
    console.error('Error regenerating script:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate script' },
      { status: 500 }
    );
  }
}
