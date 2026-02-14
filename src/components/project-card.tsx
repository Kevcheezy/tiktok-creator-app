import Link from 'next/link';
import { StatusBadge } from './status-badge';

interface ProjectCardProps {
  project: {
    id: string;
    name: string | null;
    productUrl: string;
    productName: string | null;
    productCategory: string | null;
    status: string;
    createdAt: string | Date | null;
    costUsd: string | null;
  };
}

function timeAgo(date: string | Date | null): string {
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
  const displayName = project.productName || project.name || truncateUrl(project.productUrl);

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
          {project.productCategory && (
            <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
              {project.productCategory}
            </span>
          )}
          {project.costUsd && parseFloat(project.costUsd) > 0 && (
            <span className="text-xs text-gray-500">
              ${parseFloat(project.costUsd).toFixed(2)}
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-400">
          {timeAgo(project.createdAt)}
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
