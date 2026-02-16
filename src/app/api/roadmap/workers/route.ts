import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseRoadmap, WORKER_INFO } from '@/lib/roadmap-parser';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

/**
 * GET /api/roadmap/workers
 *
 * Returns FF7 worker list with task counts and assignments.
 */
export async function GET() {
  try {
    const roadmapPath = join(process.cwd(), 'docs', 'ENGINEERING_ROADMAP.md');
    const markdown = readFileSync(roadmapPath, 'utf-8');
    const tasks = parseRoadmap(markdown);

    // Fetch overrides
    const { data: overrides } = await supabase
      .from('roadmap_worker')
      .select('task_id, worker');

    const overrideMap = new Map(
      (overrides || []).map((o: { task_id: string; worker: string }) => [o.task_id, o.worker])
    );

    // Apply overrides
    for (const task of tasks) {
      const override = overrideMap.get(task.id);
      if (override) task.worker = override;
    }

    // Build worker stats
    const workers = Object.entries(WORKER_INFO).map(([key, info]) => {
      const workerTasks = tasks.filter(t => t.worker === key);
      return {
        key,
        ...info,
        tasks: {
          total: workerTasks.length,
          backlog: workerTasks.filter(t => t.status === 'backlog').length,
          in_progress: workerTasks.filter(t => t.status === 'in_progress').length,
          done: workerTasks.filter(t => t.status === 'done').length,
        },
        assignments: workerTasks.map(t => t.id),
      };
    });

    return NextResponse.json({ workers });
  } catch (err) {
    logger.error({ err, route: '/api/roadmap/workers' }, 'Error fetching workers');
    return NextResponse.json({ error: 'Failed to fetch workers' }, { status: 500 });
  }
}
