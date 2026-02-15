import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { ScriptingAgent } from '@/agents/scripting-agent';
import { logger } from '@/lib/logger';

// POST /api/projects/[id]/scripts/[scriptId]/segments/[segmentIndex]/regenerate
// Body: { tone?: string, feedback?: string }
export async function POST(
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

    let body: { tone?: string; feedback?: string } = {};
    try {
      body = await request.json();
    } catch {
      // No body is fine
    }

    const agent = new ScriptingAgent();
    const result = await agent.regenerateSegment(
      id,
      scriptId,
      segmentIndex,
      body.tone,
      body.feedback
    );

    return NextResponse.json(result);
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/scripts/[scriptId]/segments/[segmentIndex]/regenerate' }, 'Error regenerating segment');
    return NextResponse.json(
      { error: 'Failed to regenerate segment' },
      { status: 500 }
    );
  }
}
