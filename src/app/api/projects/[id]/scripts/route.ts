import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';

/**
 * GET /api/projects/[id]/scripts
 *
 * Lists all scripts for a project with their scenes joined.
 * Scenes are sorted by segment_index.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Verify project exists
    const { data: proj, error: projError } = await supabase
      .from('project')
      .select('id')
      .eq('id', id)
      .single();

    if (projError || !proj) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch all scripts with their scenes
    const { data: scripts, error } = await supabase
      .from('script')
      .select('*, scenes:scene(*)')
      .eq('project_id', id)
      .order('version', { ascending: false });

    if (error) {
      console.error('Error fetching scripts:', error);
      return NextResponse.json({ error: 'Failed to fetch scripts' }, { status: 500 });
    }

    // Sort scenes by segment_index within each script
    const sorted = (scripts || []).map((script) => ({
      ...script,
      scenes: (script.scenes || []).sort(
        (a: { segment_index: number }, b: { segment_index: number }) =>
          a.segment_index - b.segment_index
      ),
    }));

    return NextResponse.json(sorted);
  } catch (error) {
    console.error('Error fetching scripts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scripts' },
      { status: 500 }
    );
  }
}
