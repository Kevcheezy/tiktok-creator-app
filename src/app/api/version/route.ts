import { NextResponse } from 'next/server';
import { APP_VERSION, GIT_COMMIT, BUILD_TIME, ENVIRONMENT } from '@/lib/version';

export async function GET() {
  return NextResponse.json({
    version: APP_VERSION,
    commit: GIT_COMMIT,
    environment: ENVIRONMENT,
    buildTime: BUILD_TIME,
  });
}
