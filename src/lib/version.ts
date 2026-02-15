/**
 * Version module for the TikTok Creator App.
 *
 * Works in both contexts:
 * - Next.js (build-time env injection via next.config.ts)
 * - Standalone worker process (runtime env or package.json fallback)
 */

// Read version from env (injected at build time by Next.js, or set in deployment)
// Falls back to reading package.json at runtime for the worker process
function getAppVersion(): string {
  if (process.env.NEXT_PUBLIC_APP_VERSION) {
    return process.env.NEXT_PUBLIC_APP_VERSION;
  }
  if (process.env.APP_VERSION) {
    return process.env.APP_VERSION;
  }
  // Runtime fallback: read from package.json (works in worker process via tsx)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('../../package.json');
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function getGitCommit(): string {
  return (
    process.env.NEXT_PUBLIC_GIT_COMMIT ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    'dev'
  );
}

function getBuildTime(): string {
  return process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString();
}

function getEnvironment(): string {
  return process.env.NODE_ENV || 'development';
}

export const APP_VERSION = getAppVersion();
export const GIT_COMMIT = getGitCommit();
export const BUILD_TIME = getBuildTime();
export const ENVIRONMENT = getEnvironment();
