/**
 * Smoke test for the TikTok video downloader.
 * Run with: npx tsx scripts/test-tiktok-download.ts [optional-tiktok-url]
 */
import path from 'path';
import os from 'os';
import { stat, unlink } from 'fs/promises';
import { downloadTikTokVideo } from '../src/lib/tiktok-video-downloader';
import { TikTokDownloadError } from '../src/lib/errors';

const DEFAULT_URL = 'https://www.tiktok.com/@drew.review1/video/7521464528568175902';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  process.stdout.write(`  ${name}... `);
  try {
    await fn();
    console.log('\x1b[32mPASS\x1b[0m');
    passed++;
  } catch (err) {
    console.log(`\x1b[31mFAIL\x1b[0m`);
    console.log(`    ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }
}

async function cleanUp(filePath: string) {
  try { await unlink(filePath); } catch { /* ignore */ }
}

async function main() {
  const url = process.argv[2] || DEFAULT_URL;
  console.log(`\nTikTok Video Downloader Tests`);
  console.log(`URL: ${url}\n`);

  // ---------------------------------------------------------------
  // Test 1: Download a real TikTok video
  // ---------------------------------------------------------------
  const tmpPath = path.join(os.tmpdir(), `test-tiktok-${Date.now()}.mp4`);

  await test('Download real TikTok video', async () => {
    const result = await downloadTikTokVideo(url, tmpPath, {
      timeoutMs: 60_000,
      maxSizeBytes: 100 * 1024 * 1024,
    });

    // Verify result shape
    if (!result.filePath) throw new Error('Missing filePath in result');
    if (!result.sizeBytes || result.sizeBytes <= 0) throw new Error(`Invalid sizeBytes: ${result.sizeBytes}`);
    if (!result.source) throw new Error('Missing source in result');

    // Verify file exists on disk
    const fileStat = await stat(tmpPath);
    if (fileStat.size <= 0) throw new Error('Downloaded file is empty');

    console.log(`\x1b[90m(${result.source}, ${(result.sizeBytes / 1024 / 1024).toFixed(1)}MB)\x1b[0m `);
  });

  await cleanUp(tmpPath);

  // ---------------------------------------------------------------
  // Test 2: Invalid URL throws TikTokDownloadError
  // ---------------------------------------------------------------
  await test('Invalid URL throws TikTokDownloadError', async () => {
    const badPath = path.join(os.tmpdir(), `test-bad-${Date.now()}.mp4`);
    try {
      await downloadTikTokVideo('https://example.com/not-tiktok', badPath);
      throw new Error('Should have thrown');
    } catch (err) {
      if (!(err instanceof TikTokDownloadError)) {
        throw new Error(`Expected TikTokDownloadError, got: ${err instanceof Error ? err.constructor.name : typeof err}`);
      }
    } finally {
      await cleanUp(badPath);
    }
  });

  // ---------------------------------------------------------------
  // Test 3: Timeout works (very short timeout)
  // ---------------------------------------------------------------
  await test('Short timeout causes failure', async () => {
    const timeoutPath = path.join(os.tmpdir(), `test-timeout-${Date.now()}.mp4`);
    try {
      await downloadTikTokVideo(url, timeoutPath, { timeoutMs: 1 }); // 1ms — impossible
      throw new Error('Should have thrown');
    } catch (err) {
      // Any error is acceptable here — timeout or abort
      if (err instanceof Error && err.message === 'Should have thrown') {
        throw err;
      }
    } finally {
      await cleanUp(timeoutPath);
    }
  });

  // ---------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
