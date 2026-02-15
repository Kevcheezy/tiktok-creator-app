import Link from 'next/link';
import { ProjectCard } from './project-card';

interface Project {
  id: string;
  name: string | null;
  product_url: string;
  product_name: string | null;
  product_category: string | null;
  status: string;
  created_at: string | null;
  cost_usd: string | null;
}

export function ProjectList({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-dashed border-border-bright bg-surface/50 px-8 py-20 text-center">
        {/* Decorative background */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-electric/5 blur-3xl" />
        </div>

        <div className="relative">
          {/* Icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-raised">
            <svg
              viewBox="0 0 32 32"
              fill="none"
              className="h-8 w-8 text-text-muted"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="4" y="6" width="24" height="20" rx="3" />
              <circle cx="16" cy="16" r="4" />
              <polygon points="14.5 14 18.5 16 14.5 18" fill="currentColor" stroke="none" />
            </svg>
          </div>

          <h3 className="mt-5 font-[family-name:var(--font-display)] text-lg font-semibold text-text-primary">
            No projects yet
          </h3>
          <p className="mt-2 text-sm text-text-secondary">
            Create your first AI-generated TikTok video in minutes.
          </p>
          <Link
            href="/projects/new"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-electric px-5 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_24px_rgba(0,240,255,0.3)]"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              className="h-4 w-4"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <line x1="8" y1="3" x2="8" y2="13" />
              <line x1="3" y1="8" x2="13" y2="8" />
            </svg>
            Create First Project
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
