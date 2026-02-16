import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { WORKER_INFO } from '@/lib/roadmap-parser';
import { logger } from '@/lib/logger';

const VALID_WORKERS = Object.keys(WORKER_INFO);

/**
 * PATCH /api/roadmap/assign
 *
 * Manually assign or reassign a roadmap task to an FF7 worker.
 * Body: { taskId: string, worker: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, worker } = body as { taskId?: string; worker?: string };

    if (!taskId || typeof taskId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "taskId" (string required)' },
        { status: 400 }
      );
    }

    if (!worker || !VALID_WORKERS.includes(worker)) {
      return NextResponse.json(
        { error: `Invalid "worker". Must be one of: ${VALID_WORKERS.join(', ')}` },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('roadmap_worker')
      .upsert(
        {
          task_id: taskId,
          worker,
          assigned_at: new Date().toISOString(),
          assigned_by: 'manual',
        },
        { onConflict: 'task_id' }
      )
      .select()
      .single();

    if (error) {
      logger.error({ err: error, route: '/api/roadmap/assign' }, 'Error assigning worker');
      return NextResponse.json({ error: 'Failed to assign worker' }, { status: 500 });
    }

    return NextResponse.json({
      message: `Assigned ${WORKER_INFO[worker].name} to ${taskId}`,
      assignment: data,
    });
  } catch (err) {
    logger.error({ err, route: '/api/roadmap/assign' }, 'Error assigning worker');
    return NextResponse.json({ error: 'Failed to assign worker' }, { status: 500 });
  }
}
