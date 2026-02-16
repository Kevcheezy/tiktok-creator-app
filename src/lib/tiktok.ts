import { createLogger } from '@/lib/logger';
import { supabase } from '@/db';

const logger = createLogger({ agentName: 'TikTokClient' });

// ─── Constants ────────────────────────────────────────────────────────────────

const TIKTOK_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const TIKTOK_VIDEO_QUERY_URL = 'https://open.tiktokapis.com/v2/video/query/';
const TIKTOK_USERINFO_URL = 'https://open.tiktokapis.com/v2/user/info/';

const VIDEO_FIELDS = 'id,title,video_description,duration,cover_image_url,like_count,comment_count,share_count,view_count';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TikTokTokenResponse {
  access_token: string;
  refresh_token: string;
  open_id: string;
  expires_in: number;
  token_type: string;
}

export interface TikTokVideoMetrics {
  id: string;
  title: string;
  video_description: string;
  duration: number;
  cover_image_url: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
}

export interface TikTokUserInfo {
  open_id: string;
  display_name: string;
  avatar_url: string;
}

// ─── Video ID Extraction ──────────────────────────────────────────────────────

/**
 * Extract the numeric video ID from a TikTok URL.
 * Handles: https://www.tiktok.com/@user/video/7123456789012345678
 * Returns null for short URLs (vm.tiktok.com) which don't contain the ID.
 */
export function extractVideoId(url: string): string | null {
  try {
    const match = url.match(/\/video\/(\d+)/);
    if (match) return match[1];

    if (url.includes('vm.tiktok.com')) {
      logger.warn({ url }, 'Short TikTok URL detected — cannot extract video ID. Use the full URL.');
    }
    return null;
  } catch {
    return null;
  }
}

// ─── OAuth Helpers ────────────────────────────────────────────────────────────

export function buildAuthUrl(redirectUri: string, csrfState: string): string {
  const clientKey = process.env.TIKTOK_CLIENT_KEY || '';
  const params = new URLSearchParams({
    client_key: clientKey,
    scope: 'user.info.basic,video.list',
    response_type: 'code',
    redirect_uri: redirectUri,
    state: csrfState,
  });
  return `${TIKTOK_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<TikTokTokenResponse> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY || '';
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET || '';

  const start = Date.now();
  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  const latencyMs = Date.now() - start;
  const data = await response.json();

  if (!response.ok || data.error) {
    logger.error({ statusCode: response.status, latencyMs, error: data }, 'Token exchange failed');
    throw new Error(`TikTok token exchange failed: ${data.error_description || data.error || response.status}`);
  }

  logger.info({ latencyMs, openId: data.open_id }, 'Token exchange successful');
  return data as TikTokTokenResponse;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<TikTokTokenResponse> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY || '';
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET || '';

  const start = Date.now();
  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const latencyMs = Date.now() - start;
  const data = await response.json();

  if (!response.ok || data.error) {
    logger.error({ statusCode: response.status, latencyMs, error: data }, 'Token refresh failed');
    throw new Error(`TikTok token refresh failed: ${data.error_description || data.error || response.status}`);
  }

  logger.info({ latencyMs }, 'Token refresh successful');
  return data as TikTokTokenResponse;
}

// ─── Display API Calls ────────────────────────────────────────────────────────

export async function fetchVideoMetrics(
  accessToken: string,
  videoIds: string[],
): Promise<TikTokVideoMetrics[]> {
  const results: TikTokVideoMetrics[] = [];

  // Batch into groups of 20 (TikTok API limit)
  for (let i = 0; i < videoIds.length; i += 20) {
    const batch = videoIds.slice(i, i + 20);
    const start = Date.now();

    const response = await fetch(`${TIKTOK_VIDEO_QUERY_URL}?fields=${VIDEO_FIELDS}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filters: { video_ids: batch },
      }),
    });

    const latencyMs = Date.now() - start;
    const data = await response.json();

    if (!response.ok || data.error?.code) {
      logger.error({ statusCode: response.status, latencyMs, error: data.error, batch: batch.length }, 'Video query failed');
      throw new Error(`TikTok video query failed: ${data.error?.message || response.status}`);
    }

    const videos = data.data?.videos || [];
    results.push(...videos);

    logger.info({ latencyMs, requested: batch.length, returned: videos.length }, 'Video metrics fetched');
  }

  return results;
}

export async function fetchUserInfo(accessToken: string): Promise<TikTokUserInfo> {
  const start = Date.now();
  const response = await fetch(`${TIKTOK_USERINFO_URL}?fields=open_id,display_name,avatar_url`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  const latencyMs = Date.now() - start;
  const data = await response.json();

  if (!response.ok || data.error?.code) {
    logger.error({ statusCode: response.status, latencyMs, error: data.error }, 'User info fetch failed');
    throw new Error(`TikTok user info failed: ${data.error?.message || response.status}`);
  }

  logger.info({ latencyMs }, 'User info fetched');
  return data.data?.user as TikTokUserInfo;
}

// ─── Token Management ─────────────────────────────────────────────────────────

/**
 * Get a valid access token from the DB. Auto-refreshes if expired.
 * Throws if no connection exists or refresh fails.
 */
export async function getValidAccessToken(): Promise<string> {
  const { data: conn, error } = await supabase
    .from('tiktok_connection')
    .select('*')
    .limit(1)
    .single();

  if (error || !conn) {
    throw new Error('NO_TIKTOK_CONNECTION');
  }

  const expiresAt = new Date(conn.token_expires_at);
  if (expiresAt > new Date()) {
    return conn.access_token;
  }

  // Token expired — try to refresh
  if (!conn.refresh_token) {
    throw new Error('TIKTOK_TOKEN_EXPIRED_NO_REFRESH');
  }

  logger.info('Access token expired, refreshing...');
  const tokens = await refreshAccessToken(conn.refresh_token);

  await supabase
    .from('tiktok_connection')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', conn.id);

  return tokens.access_token;
}
