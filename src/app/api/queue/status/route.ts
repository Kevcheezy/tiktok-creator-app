import { NextRequest, NextResponse } from 'next/server';
import { getPipelineQueue } from '@/lib/queue';

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json(
      { error: 'projectId query parameter is required' },
      { status: 400 }
    );
  }

  // Find the most recent job for this project
  const jobs = await getPipelineQueue().getJobs(
    ['waiting', 'active', 'completed', 'failed', 'delayed'],
    0,
    50
  );

  const projectJob = jobs.find((job) => job.data?.projectId === projectId);

  if (!projectJob) {
    return NextResponse.json({ state: 'unknown', projectId });
  }

  const state = await projectJob.getState();
  const failedReason = projectJob.failedReason;

  return NextResponse.json({
    state,
    projectId,
    jobId: projectJob.id,
    failedReason: failedReason || null,
  });
}
