// ─── Performance Business Logic ───────────────────────────────────────────────
// Pure functions for badge computation, ROI calculation, and snapshot decisions.

export type PerformanceBadge = 'viral' | 'converting' | 'underperforming';

export function computePerformanceBadge(params: {
  views: number;
  conversionRatePct: number | null;
  gmvUsd: number;
  roi: number | null;
  daysSincePost: number;
}): PerformanceBadge | null {
  const { views, conversionRatePct, gmvUsd, roi, daysSincePost } = params;

  // Priority order: viral > converting > underperforming > null
  if (views >= 100_000) return 'viral';

  if (
    (conversionRatePct !== null && conversionRatePct >= 2.0) ||
    (gmvUsd > 0 && roi !== null && roi >= 3.0)
  ) {
    return 'converting';
  }

  if (views > 0 && views < 1_000 && daysSincePost > 7) return 'underperforming';

  return null;
}

export function computeRoi(gmvUsd: number, totalCostUsd: number): number | null {
  if (!totalCostUsd || totalCostUsd <= 0) return null;
  return Math.round((gmvUsd / totalCostUsd) * 100) / 100;
}

export function shouldCreateSnapshot(
  lastSnapshotDate: string | null,
  now: Date = new Date(),
): boolean {
  if (!lastSnapshotDate) return true;

  const lastDate = new Date(lastSnapshotDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastDay = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());

  return today.getTime() > lastDay.getTime();
}

export function computeDaysSincePost(createdAt: string, now: Date = new Date()): number {
  const created = new Date(createdAt);
  const diffMs = now.getTime() - created.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}
