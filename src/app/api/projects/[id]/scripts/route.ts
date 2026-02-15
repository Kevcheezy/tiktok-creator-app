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

    // For each script, deduplicate scenes to only the latest version per segment_index
    const sorted = (scripts || []).map((script) => {
      const allScenes = (script.scenes || []) as { segment_index: number; version: number }[];
      // Sort by segment_index asc, then version desc
      allScenes.sort((a, b) =>
        a.segment_index !== b.segment_index
          ? a.segment_index - b.segment_index
          : (b.version ?? 1) - (a.version ?? 1)
      );
      // Keep only the latest version per segment_index
      const latest = new Map<number, typeof allScenes[0]>();
      for (const scene of allScenes) {
        if (!latest.has(scene.segment_index)) {
          latest.set(scene.segment_index, scene);
        }
      }
      return {
        ...script,
        scenes: Array.from(latest.values()),
      };
    });

    return NextResponse.json(sorted);
  } catch (error) {
    console.error('Error fetching scripts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scripts' },
      { status: 500 }
    );
  }
}
