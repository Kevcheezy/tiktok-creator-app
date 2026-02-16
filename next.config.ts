import type { NextConfig } from "next";
import { version } from "./package.json";
import { execSync } from "child_process";

function getGitInfo(cmd: string, fallback: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8' }).trim();
  } catch {
    return fallback;
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_GIT_COMMIT:
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.RAILWAY_GIT_COMMIT_SHA ||
      getGitInfo('git rev-parse --short HEAD', 'dev'),
    NEXT_PUBLIC_GIT_MESSAGE:
      process.env.VERCEL_GIT_COMMIT_MESSAGE ||
      getGitInfo('git log -1 --pretty=%s', ''),
    NEXT_PUBLIC_GIT_DATE:
      getGitInfo('git log -1 --pretty=%cI', new Date().toISOString()),
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
};

export default nextConfig;
