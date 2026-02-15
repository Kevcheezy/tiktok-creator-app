import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { ScriptingAgent } from '@/agents/scripting-agent';
import { logger } from '@/lib/logger';

// POST /api/projects/[id]/scripts/upload
// Body: { text: string }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { text } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    if (text.length < 100) {
      return NextResponse.json({ error: 'Script text must be at least 100 characters' }, { status: 400 });
    }

    if (text.length > 5000) {
      return NextResponse.json({ error: 'Script text must be under 5000 characters' }, { status: 400 });
    }

    // Verify project exists
    const { data: proj, error: projError } = await supabase
      .from('project')
      .select('id')
      .eq('id', id)
      .single();

    if (projError || !proj) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Analyze and split the uploaded script
    const agent = new ScriptingAgent();
    const result = await agent.analyzeUploadedScript(id, text);

    // Update project status to script_review
    await supabase
      .from('project')
      .update({ status: 'script_review', updated_at: new Date().toISOString() })
      .eq('id', id);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/scripts/upload' }, 'Error uploading script');
    return NextResponse.json(
      { error: 'Failed to analyze uploaded script' },
      { status: 500 }
    );
  }
}
