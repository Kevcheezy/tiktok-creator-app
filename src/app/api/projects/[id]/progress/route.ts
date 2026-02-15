import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';

/**
 * GET /api/projects/[id]/progress
 *
 * Returns granular progress info for the current processing stage
 * by counting asset statuses in the database.
 */

interface AssetProgress {
  type: string;
  segmentIndex: number | null;
  status: string;
}

const STAGE_CONFIG: Record<string, { types: string[]; expectedPerSegment: number; label: string }> = {
  casting: { types: ['keyframe_start', 'keyframe_end'], expectedPerSegment: 2, label: 'Generating Keyframes' },
  directing: { types: ['video'], expectedPerSegment: 1, label: 'Generating Videos' },
  voiceover: { types: ['audio'], expectedPerSegment: 1, label: 'Generating Voiceovers' },
  editing: { types: ['final_video'], expectedPerSegment: 0, label: 'Composing Final Video' },
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { data: proj, error: projError } = await supabase
      .from('project')
      .select('id, status, updated_at')
      .eq('id', id)
      .single();

    if (projError || !proj) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const config = STAGE_CONFIG[proj.status];
    if (!config) {
      return NextResponse.json({
        stage: proj.status,
        active: false,
        completed: 0,
        total: 0,
        label: '',
        items: [],
        startedAt: proj.updated_at,
      });
    }

    // Query assets for this project matching the current stage's types
    const { data: assets } = await supabase
      .from('asset')
      .select('type, status, scene:scene(segment_index)')
      .eq('project_id', id)
      .in('type', config.types);

    const items: AssetProgress[] = (assets || []).map((a: any) => ({
      type: a.type,
      segmentIndex: a.scene?.segment_index ?? null,
      status: a.status,
    }));

    const completed = items.filter((a) => a.status === 'completed').length;
    const generating = items.filter((a) => a.status === 'generating').length;
    const failed = items.filter((a) => a.status === 'failed').length;

    // Expected total: 4 segments × expectedPerSegment, except editing which is 1
    const total = proj.status === 'editing' ? 1 : 4 * config.expectedPerSegment;

    // Build a human-readable current step label
    let currentStep = config.label;
    if (total > 1 && completed < total) {
      currentStep = `${config.label} (${completed}/${total})`;
    }
    if (generating > 0) {
      // Find which segment is currently generating
      const genItem = items.find((a) => a.status === 'generating');
      if (genItem && genItem.segmentIndex !== null) {
        const typeLabel = genItem.type === 'keyframe_start' ? 'start keyframe'
          : genItem.type === 'keyframe_end' ? 'end keyframe'
          : genItem.type;
        currentStep = `Segment ${genItem.segmentIndex + 1} — ${typeLabel}`;
      }
    }

    return NextResponse.json({
      stage: proj.status,
      active: true,
      completed,
      total,
      generating,
      failed,
      label: config.label,
      currentStep,
      items,
      startedAt: proj.updated_at,
    });
  } catch (error) {
    console.error('Error fetching progress:', error);
    return NextResponse.json({ error: 'Failed to fetch progress' }, { status: 500 });
  }
}
