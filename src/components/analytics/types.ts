export type PerformanceStatus = 'viral' | 'converting' | 'underperforming' | 'unlinked' | 'pending';

export interface AnalyticsRun {
  id: string;
  project_id: string;
  tone: string | null;
  character_name: string | null;
  influencer_name: string | null;
  hook_score: number | null;
  total_cost_usd: string | null;
  final_video_url: string | null;
  created_at: string;
  product_data: {
    product_name?: string;
    brand?: string;
    category?: string;
  } | null;
  // Performance metrics — null until TikTok post is linked and synced
  tiktok_post_url: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  units_sold: number | null;
  gmv_usd: number | null;
  conversion_rate: number | null;
  roi: number | null;
  performance_status: PerformanceStatus;
}

export interface KPISummary {
  total_runs: number;
  total_revenue_usd: number;
  avg_roi: number;
  avg_views: number;
  avg_conversion_rate: number;
  top_performer: { id: string; name: string; revenue: number } | null;
}

export interface LeaderboardEntry {
  id: string;
  product_name: string;
  tone: string | null;
  character_name: string | null;
  value: number;
  formatted: string;
}

export interface DimensionRow {
  dimension: string;
  count: number;
  avg_roi: number;
  total_revenue: number;
  avg_views: number;
}

export interface AnalyticsFilters {
  search: string;
  performanceStatus: PerformanceStatus | 'all';
  tone: string;
  category: string;
}
