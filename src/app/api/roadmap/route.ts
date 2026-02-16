import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseRoadmap, WORKER_INFO } from '@/lib/roadmap-parser';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

/**
 * GET /api/roadmap
 *
 * Parses ENGINEERING_ROADMAP.md and returns structured tasks with worker assignments.
 */
export async function GET() {
  try {
    // Read the roadmap markdown file
    const roadmapPath = join(process.cwd(), 'docs', 'ENGINEERING_ROADMAP.md');
    let markdown: string;
    try {
      markdown = readFileSync(roadmapPath, 'utf-8');
    } catch {
      return NextResponse.json(
        { error: 'ENGINEERING_ROADMAP.md not found' },
        { status: 404 }
      );
    }

    // Parse markdown into tasks
    const tasks = parseRoadmap(markdown);

    // Fetch manual worker overrides from DB
    const { data: overrides } = await supabase
      .from('roadmap_worker')
      .select('task_id, worker, assigned_by');

    const overrideMap = new Map(
      (overrides || []).map((o: { task_id: string; worker: string; assigned_by: string }) => [o.task_id, { worker: o.worker, assignedBy: o.assigned_by }])
    );

    // Apply overrides — manual takes precedence over auto
    for (const task of tasks) {
      const override = overrideMap.get(task.id);
      if (override) {
        task.worker = override.worker;
      }
    }

    // Build summary
    const summary = {
      total: tasks.length,
      backlog: tasks.filter(t => t.status === 'backlog').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      done: tasks.filter(t => t.status === 'done').length,
      byTier: {} as Record<string, number>,
      byWorker: {} as Record<string, { total: number; in_progress: number; done: number }>,
    };

    for (const task of tasks) {
      summary.byTier[task.tier] = (summary.byTier[task.tier] || 0) + 1;
    }

    for (const workerKey of Object.keys(WORKER_INFO)) {
      const workerTasks = tasks.filter(t => t.worker === workerKey);
      summary.byWorker[workerKey] = {
        total: workerTasks.length,
        in_progress: workerTasks.filter(t => t.status === 'in_progress').length,
        done: workerTasks.filter(t => t.status === 'done').length,
      };
    }

    const lastCommit = {
      hash: process.env.NEXT_PUBLIC_GIT_COMMIT || 'unknown',
      message: process.env.NEXT_PUBLIC_GIT_MESSAGE || '',
      date: process.env.NEXT_PUBLIC_GIT_DATE || '',
    };

    return NextResponse.json({ tasks, summary, lastCommit });
  } catch (err) {
    logger.error({ err, route: '/api/roadmap' }, 'Error parsing roadmap');
    return NextResponse.json({ error: 'Failed to parse roadmap' }, { status: 500 });
  }
}
