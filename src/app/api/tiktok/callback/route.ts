import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';
import { exchangeCodeForTokens, fetchUserInfo } from '@/lib/tiktok';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      return NextResponse.redirect(
        new URL('/?tiktok_error=missing_code', request.url)
      );
    }

    const redirectUri = `${
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    }/api/tiktok/callback`;

    const tokens = await exchangeCodeForTokens(code, redirectUri);

    const userInfo = await fetchUserInfo(tokens.access_token);

    // Delete any existing connection rows
    await supabase
      .from('tiktok_connection')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    // Insert new connection
    const { error: insertError } = await supabase
      .from('tiktok_connection')
      .insert({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        tiktok_open_id: tokens.open_id,
        tiktok_username: userInfo.display_name,
        tiktok_avatar_url: userInfo.avatar_url,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      });

    if (insertError) {
      logger.error({ error: insertError }, 'Failed to save TikTok connection');
      return NextResponse.redirect(
        new URL('/?tiktok_error=auth_failed', request.url)
      );
    }

    return NextResponse.redirect(
      new URL('/?tiktok_connected=true', request.url)
    );
  } catch (error) {
    logger.error({ err: error }, 'TikTok callback failed');
    return NextResponse.redirect(
      new URL('/?tiktok_error=auth_failed', request.url)
    );
  }
}
