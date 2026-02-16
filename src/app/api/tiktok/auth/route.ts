import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';
import { buildAuthUrl } from '@/lib/tiktok';

export async function GET(request: NextRequest) {
  try {
    const state = crypto.randomUUID();

    const redirectUri = `${
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    }/api/tiktok/callback`;

    const authUrl = buildAuthUrl(redirectUri, state);

    return NextResponse.json({ authUrl, state });
  } catch (error) {
    logger.error({ err: error }, 'Failed to generate TikTok auth URL');
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}
