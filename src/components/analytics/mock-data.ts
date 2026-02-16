import { SCRIPT_TONES, PRODUCT_CATEGORIES } from '@/lib/constants';
import type { AnalyticsRun, KPISummary, PerformanceStatus } from './types';

export const USE_MOCK_DATA = true;

const TONE_IDS = Object.keys(SCRIPT_TONES);
const CATEGORIES = [...PRODUCT_CATEGORIES];
const CHARACTERS = ['Cloud', 'Tifa', 'Barret', 'Aerith', 'Red XIII', 'Yuffie', 'Cid'];
const PRODUCT_NAMES = [
  'Vitamin C Serum', 'Collagen Peptides', 'Resistance Bands', 'LED Face Mask',
  'Protein Powder', 'Hair Growth Oil', 'Posture Corrector', 'Sleep Gummies',
  'Jade Roller Set', 'Teeth Whitening Kit', 'Yoga Mat', 'Kitchen Scale',
  'Blue Light Glasses', 'Dry Brush', 'Detox Tea',
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function deriveStatus(views: number | null, cvr: number | null, url: string | null): PerformanceStatus {
  if (!url) return 'unlinked';
  if (views === null) return 'pending';
  if (views >= 100000) return 'viral';
  if (cvr !== null && cvr >= 0.02) return 'converting';
  return 'underperforming';
}

export function generateMockRuns(count: number): AnalyticsRun[] {
  const runs: AnalyticsRun[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const hasUrl = Math.random() > 0.25;
    const hasMetrics = hasUrl && Math.random() > 0.15;
    const views = hasMetrics ? randomBetween(500, 250000) : null;
    const likes = views ? Math.floor(views * (Math.random() * 0.08 + 0.02)) : null;
    const comments = views ? Math.floor(views * (Math.random() * 0.01)) : null;
    const shares = views ? Math.floor(views * (Math.random() * 0.005)) : null;
    const unitsSold = hasMetrics ? randomBetween(0, 120) : null;
    const cost = parseFloat((Math.random() * 3 + 4).toFixed(2));
    const gmv = unitsSold ? parseFloat((unitsSold * (Math.random() * 30 + 10)).toFixed(2)) : null;
    const cvr = views && unitsSold ? unitsSold / views : null;
    const roi = gmv ? parseFloat((gmv / cost).toFixed(2)) : null;
    const tiktokUrl = hasUrl ? `https://www.tiktok.com/@creator/video/${1e18 + i}` : null;

    runs.push({
      id: `run-${i.toString().padStart(3, '0')}`,
      project_id: `proj-${i.toString().padStart(3, '0')}`,
      tone: randomFrom(TONE_IDS),
      character_name: randomFrom(CHARACTERS),
      influencer_name: `Influencer ${randomBetween(1, 20)}`,
      hook_score: randomBetween(6, 14),
      total_cost_usd: cost.toFixed(2),
      final_video_url: `https://storage.example.com/videos/run-${i}.mp4`,
      created_at: new Date(now - randomBetween(1, 90) * 86400000).toISOString(),
      product_data: {
        product_name: randomFrom(PRODUCT_NAMES),
        brand: `Brand ${randomBetween(1, 10)}`,
        category: randomFrom(CATEGORIES),
      },
      tiktok_post_url: tiktokUrl,
      views,
      likes,
      comments,
      shares,
      units_sold: unitsSold,
      gmv_usd: gmv,
      conversion_rate: cvr ? parseFloat(cvr.toFixed(4)) : null,
      roi,
      performance_status: deriveStatus(views, cvr, tiktokUrl),
    });
  }

  return runs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function computeSummary(runs: AnalyticsRun[]): KPISummary {
  const linked = runs.filter((r) => r.views !== null);
  const totalRevenue = runs.reduce((sum, r) => sum + (r.gmv_usd || 0), 0);
  const avgRoi = linked.length > 0
    ? linked.reduce((sum, r) => sum + (r.roi || 0), 0) / linked.length
    : 0;
  const avgViews = linked.length > 0
    ? linked.reduce((sum, r) => sum + (r.views || 0), 0) / linked.length
    : 0;
  const withCvr = linked.filter((r) => r.conversion_rate !== null);
  const avgCvr = withCvr.length > 0
    ? withCvr.reduce((sum, r) => sum + (r.conversion_rate || 0), 0) / withCvr.length
    : 0;

  let topPerformer: KPISummary['top_performer'] = null;
  if (linked.length > 0) {
    const best = linked.reduce((a, b) => ((a.gmv_usd || 0) > (b.gmv_usd || 0) ? a : b));
    if (best.gmv_usd) {
      topPerformer = {
        id: best.id,
        name: best.product_data?.product_name || 'Unknown',
        revenue: best.gmv_usd,
      };
    }
  }

  return {
    total_runs: runs.length,
    total_revenue_usd: totalRevenue,
    avg_roi: parseFloat(avgRoi.toFixed(2)),
    avg_views: Math.round(avgViews),
    avg_conversion_rate: parseFloat(avgCvr.toFixed(4)),
    top_performer: topPerformer,
  };
}

export const EMPTY_SUMMARY: KPISummary = {
  total_runs: 0,
  total_revenue_usd: 0,
  avg_roi: 0,
  avg_views: 0,
  avg_conversion_rate: 0,
  top_performer: null,
};
