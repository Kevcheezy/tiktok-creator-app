'use client';

import Link from 'next/link';
import { StatusBadge } from './status-badge';

interface ProjectCardProps {
  project: {
    id: string;
    name: string | null;
    product_url: string;
    product_name: string | null;
    product_category: string | null;
    status: string;
    created_at: string | null;
    cost_usd: string | null;
    error_message: string | null;
  };
  onDelete?: (id: string) => void;
}

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

function truncateUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    if (path.length > 40) return path.substring(0, 37) + '...';
    return parsed.hostname + path;
  } catch {
    return url.substring(0, 40) + (url.length > 40 ? '...' : '');
  }
}

const STATUS_ACCENT: Record<string, string> = {
  analyzing: 'group-hover:border-electric/40',
  analysis_review: 'group-hover:border-amber-hot/40',
  scripting: 'group-hover:border-electric/40',
  script_review: 'group-hover:border-amber-hot/40',
  casting: 'group-hover:border-magenta/40',
  directing: 'group-hover:border-magenta/40',
  editing: 'group-hover:border-electric/40',
  completed: 'group-hover:border-lime/40',
  failed: 'group-hover:border-magenta/40',
};

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const displayName = project.product_name || project.name || truncateUrl(project.product_url);
  const accent = STATUS_ACCENT[project.status] || 'group-hover:border-border-bright';

  return (
    <Link href={`/projects/${project.id}`} className="group block">
      <div
        className={`relative overflow-hidden rounded-xl border border-border bg-surface p-5 transition-all duration-300 hover:bg-surface-raised hover:shadow-lg hover:shadow-black/20 ${accent}`}
      >
        {/* Top gradient line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border-bright to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold leading-tight text-text-primary line-clamp-2">
            {displayName}
          </h3>
          <div className="flex-shrink-0">
            <StatusBadge status={project.status} />
          </div>
        </div>

        {/* Meta */}
        <div className="mt-4 flex items-center gap-3">
          {project.product_category && (
            <span className="rounded-md bg-surface-overlay px-2 py-0.5 font-[family-name:var(--font-mono)] text-[11px] text-text-secondary">
              {project.product_category}
            </span>
          )}
          {project.cost_usd && parseFloat(project.cost_usd) > 0 && (
            <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
              ${parseFloat(project.cost_usd).toFixed(2)}
            </span>
          )}
        </div>

        {/* Error message for failed projects */}
        {project.status === 'failed' && project.error_message && (
          <p className="text-[11px] text-magenta/80 line-clamp-1 mt-1">
            {project.error_message}
          </p>
        )}

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between">
          <p className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
            {timeAgo(project.created_at)}
          </p>
          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(project.id);
                }}
                className="rounded-md p-1.5 text-text-muted opacity-0 transition-all hover:bg-magenta/10 hover:text-magenta group-hover:opacity-100"
                title="Delete project"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 4h12" />
                  <path d="M5 4V2.5A.5.5 0 015.5 2h5a.5.5 0 01.5.5V4" />
                  <path d="M12.5 4v9.5a1 1 0 01-1 1h-7a1 1 0 01-1-1V4" />
                </svg>
              </button>
            )}
            <svg
              viewBox="0 0 16 16"
              fill="none"
              className="h-3.5 w-3.5 text-text-muted transition-all group-hover:translate-x-0.5 group-hover:text-text-secondary"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="8" x2="13" y2="8" />
              <polyline points="9 4 13 8 9 12" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}
