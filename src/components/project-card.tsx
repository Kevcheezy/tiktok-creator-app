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
  };
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

export function ProjectCard({ project }: ProjectCardProps) {
  const displayName = project.product_name || project.name || truncateUrl(project.product_url);

  return (
    <Link href={`/projects/${project.id}`} className="block">
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
            {displayName}
          </h3>
          <StatusBadge status={project.status} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          {project.product_category && (
            <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
              {project.product_category}
            </span>
          )}
          {project.cost_usd && parseFloat(project.cost_usd) > 0 && (
            <span className="text-xs text-gray-500">
              ${parseFloat(project.cost_usd).toFixed(2)}
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-400">
          {timeAgo(project.created_at)}
        </p>
      </div>
    </Link>
  );
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
