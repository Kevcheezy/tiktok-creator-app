import { createWriteStream } from 'fs';
import { stat } from 'fs/promises';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { createLogger } from '@/lib/logger';
import { TikTokDownloadError } from '@/lib/errors';

const logger = createLogger({ agentName: 'TikTokDownloader' });

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

interface DownloadOptions {
  timeoutMs?: number;
  maxSizeBytes?: number;
}

interface DownloadResult {
  filePath: string;
  sizeBytes: number;
  source: 'tikwm' | 'direct';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Download a TikTok video to a local file using pure Node.js (no system binaries).
 * Strategy 1: tikwm.com API (resolves TikTok URL to CDN link)
 * Strategy 2: Direct fetch with mobile User-Agent (fallback)
 */
export async function downloadTikTokVideo(
  url: string,
  outputPath: string,
  options?: DownloadOptions,
): Promise<DownloadResult> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxSizeBytes = options?.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;

  if (!/^https?:\/\/(www\.|vm\.|vt\.)?tiktok\.com\//i.test(url)) {
    throw new TikTokDownloadError(`Invalid TikTok URL: ${url}`, 'all');
  }

  // Strategy 1: tikwm.com
  let tikwmError: Error | undefined;
  try {
    logger.info({ url }, 'Attempting download via tikwm.com');
    const sizeBytes = await downloadViaTikwm(url, outputPath, timeoutMs, maxSizeBytes);
    logger.info({ url, sizeBytes, source: 'tikwm' }, 'Download complete');
    return { filePath: outputPath, sizeBytes, source: 'tikwm' };
  } catch (err) {
    tikwmError = err instanceof Error ? err : new Error(String(err));
    logger.warn({ url, error: tikwmError.message }, 'tikwm.com strategy failed, trying direct fetch');
  }

  // Strategy 2: Direct fetch fallback
  let directError: Error | undefined;
  try {
    const sizeBytes = await downloadDirect(url, outputPath, timeoutMs, maxSizeBytes);
    logger.info({ url, sizeBytes, source: 'direct' }, 'Download complete via direct fetch');
    return { filePath: outputPath, sizeBytes, source: 'direct' };
  } catch (err) {
    directError = err instanceof Error ? err : new Error(String(err));
    logger.error({ url, tikwmError: tikwmError?.message, directError: directError.message }, 'All download strategies failed');
  }

  throw new TikTokDownloadError(
    `All download strategies failed. tikwm: ${tikwmError?.message}. direct: ${directError?.message}`,
    'all',
    tikwmError,
  );
}

// ---------------------------------------------------------------------------
// Strategy 1: tikwm.com API
// ---------------------------------------------------------------------------

async function downloadViaTikwm(
  tiktokUrl: string,
  outputPath: string,
  timeoutMs: number,
  maxSizeBytes: number,
): Promise<number> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Resolve TikTok URL to CDN download link
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(tiktokUrl)}&hd=1`;
    const apiRes = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!apiRes.ok) {
      throw new TikTokDownloadError(`tikwm API returned ${apiRes.status}`, 'tikwm');
    }

    const json = await apiRes.json();

    if (json.code !== 0 || !json.data) {
      throw new TikTokDownloadError(`tikwm API error: ${json.msg || 'unknown'}`, 'tikwm');
    }

    // Prefer HD, fall back to standard
    const videoUrl: string = json.data.hdplay || json.data.play;
    if (!videoUrl) {
      throw new TikTokDownloadError('tikwm returned no video URL', 'tikwm');
    }

    logger.info({ videoUrl: videoUrl.substring(0, 100) + '...' }, 'Got CDN URL from tikwm');

    // Download the video file
    return await streamToFile(videoUrl, outputPath, maxSizeBytes, controller.signal);
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Strategy 2: Direct fetch (fallback)
// ---------------------------------------------------------------------------

async function downloadDirect(
  tiktokUrl: string,
  outputPath: string,
  timeoutMs: number,
  maxSizeBytes: number,
): Promise<number> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Fetch TikTok page with mobile User-Agent to get simpler page
    const pageRes = await fetch(tiktokUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'TikTok 26.2.0 rv:262018 (iPhone; iOS 14.4.2; en_US)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    });

    if (!pageRes.ok) {
      throw new TikTokDownloadError(`TikTok page returned ${pageRes.status}`, 'direct');
    }

    const html = await pageRes.text();

    // Try to extract video URL from page data
    const videoUrl = extractVideoUrl(html);
    if (!videoUrl) {
      throw new TikTokDownloadError('Could not extract video URL from TikTok page', 'direct');
    }

    logger.info({ videoUrl: videoUrl.substring(0, 100) + '...' }, 'Extracted video URL from page');

    return await streamToFile(videoUrl, outputPath, maxSizeBytes, controller.signal);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extract a direct video URL from TikTok page HTML.
 */
function extractVideoUrl(html: string): string | null {
  // Try common patterns in TikTok's embedded JSON
  const patterns = [
    /"downloadAddr":"([^"]+)"/,
    /"playAddr":"([^"]+)"/,
    /"play_addr":\s*\{\s*"url_list":\s*\["([^"]+)"/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      // Decode unicode escapes and URL encoding
      return match[1]
        .replace(/\\u002F/g, '/')
        .replace(/\\u0026/g, '&')
        .replace(/\\\//g, '/');
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Shared: Stream download to file
// ---------------------------------------------------------------------------

async function streamToFile(
  url: string,
  outputPath: string,
  maxSizeBytes: number,
  signal: AbortSignal,
): Promise<number> {
  const res = await fetch(url, {
    signal,
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Referer': 'https://www.tiktok.com/',
    },
  });

  if (!res.ok) {
    throw new TikTokDownloadError(`CDN returned ${res.status}`, 'tikwm');
  }

  // Check Content-Length before downloading
  const contentLength = res.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
    throw new TikTokDownloadError(
      `Video too large: ${(parseInt(contentLength, 10) / 1024 / 1024).toFixed(1)}MB exceeds ${(maxSizeBytes / 1024 / 1024).toFixed(0)}MB limit`,
      'all',
    );
  }

  if (!res.body) {
    throw new TikTokDownloadError('Response has no body', 'tikwm');
  }

  // Stream to file
  const nodeReadable = Readable.fromWeb(res.body as import('stream/web').ReadableStream);
  const ws = createWriteStream(outputPath);
  await pipeline(nodeReadable, ws);

  // Verify file size
  const fileStat = await stat(outputPath);
  if (fileStat.size > maxSizeBytes) {
    throw new TikTokDownloadError(
      `Downloaded file too large: ${(fileStat.size / 1024 / 1024).toFixed(1)}MB`,
      'all',
    );
  }

  return fileStat.size;
}
