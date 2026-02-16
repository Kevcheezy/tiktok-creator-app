import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';
import { refreshAccessToken } from '@/lib/tiktok';

export async function GET(request: NextRequest) {
  try {
    const { data: conn, error } = await supabase
      .from('tiktok_connection')
      .select('*')
      .limit(1)
      .single();

    if (error || !conn) {
      return NextResponse.json({ connected: false });
    }

    // Check if token is expired
    const isExpired = new Date(conn.token_expires_at) < new Date();

    if (isExpired) {
      if (conn.refresh_token) {
        try {
          const newTokens = await refreshAccessToken(conn.refresh_token);

          const { error: updateError } = await supabase
            .from('tiktok_connection')
            .update({
              access_token: newTokens.access_token,
              refresh_token: newTokens.refresh_token,
              token_expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', conn.id);

          if (updateError) {
            logger.error({ error: updateError }, 'Failed to update refreshed tokens');
            return NextResponse.json({ connected: false, expired: true });
          }

          return NextResponse.json({
            connected: true,
            username: conn.tiktok_username,
            avatarUrl: conn.tiktok_avatar_url,
            expiresAt: Date.now() + newTokens.expires_in * 1000,
          });
        } catch (refreshError) {
          logger.error({ error: refreshError }, 'Failed to refresh TikTok access token');
          return NextResponse.json({ connected: false, expired: true });
        }
      }

      return NextResponse.json({ connected: false, expired: true });
    }

    return NextResponse.json({
      connected: true,
      username: conn.tiktok_username,
      avatarUrl: conn.tiktok_avatar_url,
      expiresAt: conn.token_expires_at,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to check TikTok connection status');
    return NextResponse.json(
      { error: 'Failed to check connection status' },
      { status: 500 }
    );
  }
}
