import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import {
  DOWNSTREAM_IMPACT_MAP,
  PIPELINE_STAGE_ORDER,
  STAGE_COST_ESTIMATES,
  RESTART_STAGE_MAP,
} from '@/lib/constants';
import { logger } from '@/lib/logger';

/**
 * POST /api/projects/[id]/impact
 *
 * Given a stage and list of changed fields, returns the downstream impact:
 * which fields are safe vs destructive, affected stages, restart point, and cost.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { stage, changes } = body as { stage?: string; changes?: string[] };

    if (!stage || !changes || !Array.isArray(changes) || changes.length === 0) {
      return NextResponse.json(
        { error: 'Request body must include "stage" (string) and "changes" (string[])' },
        { status: 400 }
      );
    }

    // Verify project exists
    const { data: proj, error } = await supabase
      .from('project')
      .select('id, status')
      .eq('id', id)
      .single();

    if (error || !proj) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Look up impact map for the given stage
    const stageMap = DOWNSTREAM_IMPACT_MAP[stage];
    if (!stageMap) {
      return NextResponse.json(
        { error: `Unknown stage '${stage}'. Valid stages: ${Object.keys(DOWNSTREAM_IMPACT_MAP).join(', ')}` },
        { status: 400 }
      );
    }

    const safe: { field: string; description: string }[] = [];
    const destructive: { field: string; description: string; affectedStages: string[] }[] = [];
    const allAffectedSet = new Set<string>();

    for (const field of changes) {
      const impact = stageMap[field];
      if (!impact) {
        // Unknown field — treat as safe (no downstream impact known)
        safe.push({ field, description: 'No known downstream impact' });
        continue;
      }

      if (impact.type === 'safe') {
        safe.push({ field, description: impact.description });
      } else {
        destructive.push({
          field,
          description: impact.description,
          affectedStages: impact.affectedStages,
        });
        for (const s of impact.affectedStages) {
          allAffectedSet.add(s);
        }
      }
    }

    const allAffectedStages = PIPELINE_STAGE_ORDER.filter(s => allAffectedSet.has(s));

    // Determine restart point: earliest affected stage that has a RESTART_STAGE_MAP entry
    let restartFrom: string | null = null;
    for (const s of allAffectedStages) {
      if (RESTART_STAGE_MAP[s]) {
        restartFrom = s;
        break;
      }
    }

    // Calculate estimated cost
    let estimatedCost = 0;
    const costBreakdown: string[] = [];
    for (const s of allAffectedStages) {
      const estimate = STAGE_COST_ESTIMATES[s];
      if (estimate) {
        estimatedCost += estimate.cost;
        costBreakdown.push(`${estimate.label} ($${estimate.cost.toFixed(2)})`);
      }
    }

    // Build warning string
    let warning = '';
    if (destructive.length > 0 && costBreakdown.length > 0) {
      const fieldNames = destructive.map(d => d.field).join(', ');
      warning = `Editing ${fieldNames} will require regenerating: ${costBreakdown.join(', ')}.`;
    }

    return NextResponse.json({
      safe,
      destructive,
      allAffectedStages,
      restartFrom,
      estimatedCost: Math.round(estimatedCost * 100) / 100,
      warning,
    });
  } catch (err) {
    logger.error({ err, route: '/api/projects/[id]/impact' }, 'Error computing impact');
    return NextResponse.json({ error: 'Failed to compute impact' }, { status: 500 });
  }
}
