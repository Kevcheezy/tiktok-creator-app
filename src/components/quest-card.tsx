'use client';

import Link from 'next/link';
import { FF7Sprite } from './ff7-sprite';
import { GilDisplay } from './gil-display';
import { getCharacterForStatus, REVIEW_GATES } from './ff7-theme';

interface Project {
  id: string;
  project_number: number | null;
  name: string | null;
  product_url: string;
  product_name: string | null;
  product_category: string | null;
  status: string;
  created_at: string | null;
  cost_usd: string | null;
  error_message: string | null;
}

interface QuestCardProps {
  project: Project;
  onDelete: (id: string) => void;
}

type CardState = 'processing' | 'review' | 'victory' | 'ko';

function getCardState(status: string): CardState {
  if (status === 'completed') return 'victory';
  if (status === 'failed') return 'ko';
  if (status in REVIEW_GATES) return 'review';
  return 'processing';
}

const REVIEW_ACTIONS: Record<string, string> = {
  analysis_review: 'Review Analysis',
  script_review: 'Review Script',
  broll_review: 'Review B-Roll',
  influencer_selection: 'Select Influencer',
  casting_review: 'Review Cast',
  asset_review: 'Review Assets',
};

function timeAgo(date: string | null): string {
  if (!date) return '';
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Pipeline stage order for ATB progress
const STAGE_ORDER = [
  'created',
  'analyzing', 'analysis_review',
  'scripting', 'script_review',
  'broll_planning', 'broll_review',
  'influencer_selection', 'casting', 'casting_review',
  'directing', 'voiceover', 'broll_generation', 'asset_review',
  'editing', 'completed',
];

function getAtbPercent(status: string): number {
  if (status === 'completed') return 100;
  if (status === 'failed') return 0;
  const idx = STAGE_ORDER.indexOf(status);
  if (idx < 0) return 0;
  return Math.round((idx / (STAGE_ORDER.length - 1)) * 100);
}

export function QuestCard({ project, onDelete }: QuestCardProps) {
  const state = getCardState(project.status);
  const character = getCharacterForStatus(project.status);
  const spriteState = state === 'victory' ? 'attack' : state === 'ko' ? 'ko' : 'idle';
  const displayName = project.product_name || project.name || 'Untitled';
  const atbPct = getAtbPercent(project.status);

  const bannerConfig = {
    review: { text: 'YOUR TURN', cls: 'bg-amber-hot/10 text-amber-hot animate-awaiting-pulse' },
    victory: { text: 'VICTORY', cls: 'bg-lime/10 text-lime' },
    ko: { text: 'KO', cls: 'bg-magenta/10 text-magenta' },
    processing: null,
  }[state];

  const borderLeftColor =
    state === 'review' ? 'rgba(255,201,51,0.5)' :
    state === 'victory' ? 'rgba(122,255,110,0.5)' :
    state === 'ko' ? 'rgba(255,45,85,0.5)' :
    character ? `${character.color}50` : 'var(--color-border)';

  const atbColor = state === 'victory' ? 'bg-lime' : state === 'ko' ? 'bg-magenta' : 'bg-electric';
  const atbTrack = state === 'victory' ? 'bg-lime/20' : state === 'ko' ? 'bg-magenta/20' : 'bg-electric/20';

  return (
    <Link href={`/projects/${project.id}`} className="group block">
      <div
        className="relative overflow-hidden rounded-lg border border-border bg-surface transition-all duration-200 hover:bg-surface-raised hover:border-border-bright"
        style={{ borderLeftWidth: 3, borderLeftColor }}
      >
        {/* Banner */}
        {bannerConfig && (
          <div className={`px-3 py-1 font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-widest ${bannerConfig.cls}`}>
            {bannerConfig.text}
          </div>
        )}

        <div className="p-3">
          {/* Header: sprite + name + delete */}
          <div className="flex items-start gap-2">
            <FF7Sprite character={project.status} state={spriteState} size="sm" />
            <div className="min-w-0 flex-1">
              {project.project_number != null && (
                <p className="font-[family-name:var(--font-mono)] text-[9px] font-bold uppercase tracking-wider text-electric/60">
                  PROJECT-{project.project_number}
                </p>
              )}
              <p className="text-xs font-medium leading-tight text-text-primary line-clamp-1">
                {displayName}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(project.id);
              }}
              className="rounded p-1 text-text-muted opacity-0 transition-all hover:bg-magenta/10 hover:text-magenta group-hover:opacity-100"
              title="Delete project"
            >
              <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                <path d="M2 3h8M4 3V2h4v1M3.5 3v6.5a.5.5 0 00.5.5h4a.5.5 0 00.5-.5V3" />
              </svg>
            </button>
          </div>

          {/* Category badge */}
          {project.product_category && (
            <span className="mt-1.5 inline-block rounded bg-surface-overlay px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[9px] text-text-secondary">
              {project.product_category}
            </span>
          )}

          {/* Error message for KO */}
          {state === 'ko' && project.error_message && (
            <p className="mt-1.5 text-[10px] leading-tight text-magenta/70 line-clamp-1">
              {project.error_message}
            </p>
          )}

          {/* ATB bar */}
          <div className="mt-2">
            <div className={`h-1.5 w-full overflow-hidden rounded-full ${atbTrack}`}>
              <div
                className={`h-full rounded-full ${atbColor} transition-all duration-500`}
                style={{ width: `${Math.max(atbPct, atbPct > 0 ? 8 : 0)}%` }}
              />
            </div>
          </div>

          {/* Footer: cost + time + action */}
          <div className="mt-2 flex items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <GilDisplay amount={project.cost_usd} />
              <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
                {timeAgo(project.created_at)}
              </span>
            </div>
            {state === 'review' && REVIEW_ACTIONS[project.status] && (
              <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold text-amber-hot">
                {REVIEW_ACTIONS[project.status]} →
              </span>
            )}
            {state === 'victory' && (
              <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold text-lime">
                View →
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
