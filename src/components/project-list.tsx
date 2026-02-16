'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ProjectCard } from './project-card';
import { ConfirmDialog } from './confirm-dialog';

interface Project {
  id: string;
  name: string | null;
  product_url: string;
  product_name: string | null;
  product_category: string | null;
  status: string;
  created_at: string | null;
  cost_usd: string | null;
  error_message: string | null;
}

const STATUS_FILTERS: { label: string; key: string; statuses: string[] }[] = [
  { label: 'All', key: 'all', statuses: [] },
  {
    label: 'Active',
    key: 'active',
    statuses: ['analyzing', 'scripting', 'casting', 'directing', 'editing'],
  },
  {
    label: 'Review',
    key: 'review',
    statuses: ['analysis_review', 'script_review', 'influencer_selection', 'casting_review'],
  },
  { label: 'Completed', key: 'completed', statuses: ['completed'] },
  { label: 'Failed', key: 'failed', statuses: ['failed'] },
];

const PAGE_SIZE = 12;

export function ProjectList({ projects: initialProjects }: { projects: Project[] }) {
  const [projects, setProjects] = useState(initialProjects);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const deleteTarget = projects.find((p) => p.id === deleteTargetId);

  // Filter projects by search + status
  const filteredProjects = useMemo(() => {
    let result = projects;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          (p.product_name && p.product_name.toLowerCase().includes(q)) ||
          (p.name && p.name.toLowerCase().includes(q)) ||
          p.product_url.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (activeFilter !== 'all') {
      const filterDef = STATUS_FILTERS.find((f) => f.key === activeFilter);
      if (filterDef && filterDef.statuses.length > 0) {
        result = result.filter((p) => filterDef.statuses.includes(p.status));
      }
    }

    return result;
  }, [projects, searchQuery, activeFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedProjects = filteredProjects.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );
  const showPagination = filteredProjects.length > PAGE_SIZE;

  // Reset page when filters change
  function handleSearchChange(value: string) {
    setSearchQuery(value);
    setCurrentPage(1);
  }
  function handleFilterChange(key: string) {
    setActiveFilter(key);
    setCurrentPage(1);
  }
  function clearFilters() {
    setSearchQuery('');
    setActiveFilter('all');
    setCurrentPage(1);
  }

  async function handleDelete() {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${deleteTargetId}`, { method: 'DELETE' });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== deleteTargetId));
      }
    } finally {
      setDeleting(false);
      setDeleteTargetId(null);
    }
  }

  // True empty state: no projects at all
  if (projects.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-dashed border-border-bright bg-surface/50 px-8 py-20 text-center">
        {/* Decorative background */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-electric/5 blur-3xl" />
        </div>

        <div className="relative">
          {/* Buster Sword icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-raised">
            <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-text-muted">
              <rect x="10.5" y="2" width="3" height="14" rx="0.5" fill="currentColor" opacity="0.9" />
              <rect x="6" y="16" width="12" height="2.5" rx="0.5" fill="currentColor" />
              <rect x="10.5" y="18.5" width="3" height="4" rx="0.5" fill="currentColor" opacity="0.6" />
            </svg>
          </div>

          <h3 className="mt-5 font-[family-name:var(--font-display)] text-lg font-semibold text-text-primary">
            No encounters yet
          </h3>
          <p className="mt-2 text-sm text-text-secondary">
            Start a new battle.
          </p>
          <Link
            href="/projects/new"
            className="mt-6 inline-flex items-center gap-2 overflow-hidden rounded border-2 border-electric bg-transparent px-5 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-electric transition-all hover:bg-electric/10 hover:shadow-[0_0_24px_rgba(0,229,160,0.2)]"
          >
            <svg viewBox="0 0 8 10" fill="currentColor" className="h-2.5 w-2.5">
              <polygon points="0,0 8,5 0,10" />
            </svg>
            Start Encounter
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Search & Filter Bar */}
      <div className="mb-6 space-y-3">
        {/* Search input */}
        <div className="relative">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted/60"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="9" cy="9" r="6" />
            <path d="M13.5 13.5L18 18" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name, product, or URL..."
            className="w-full rounded-lg border border-border bg-surface-raised py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted/50 outline-none transition-colors focus:border-electric/40 focus:ring-1 focus:ring-electric/20"
          />
        </div>

        {/* Status filter pills + count */}
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => handleFilterChange(filter.key)}
              className={`rounded-full border px-3.5 py-1 font-[family-name:var(--font-display)] text-xs font-medium transition-colors ${
                activeFilter === filter.key
                  ? 'border-electric/30 bg-electric/10 text-electric'
                  : 'border-border bg-surface-overlay text-text-muted hover:text-text-secondary'
              }`}
            >
              {filter.label}
            </button>
          ))}

          {/* Project count badge */}
          <span className="ml-auto font-[family-name:var(--font-mono)] text-xs text-text-muted">
            {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Filtered empty state */}
      {filteredProjects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/50 px-8 py-16 text-center">
          <p className="text-sm text-text-secondary">No projects match your filters</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-3 rounded-lg border border-border px-4 py-1.5 font-[family-name:var(--font-display)] text-xs font-medium text-text-secondary transition-colors hover:border-electric/40 hover:text-electric"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={setDeleteTargetId}
              />
            ))}
          </div>

          {/* Pagination */}
          {showPagination && (
            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-border px-3 py-1.5 font-[family-name:var(--font-display)] text-xs font-medium text-text-secondary transition-colors hover:border-electric/40 hover:text-electric disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="font-[family-name:var(--font-mono)] text-xs text-text-muted">
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-border px-3 py-1.5 font-[family-name:var(--font-display)] text-xs font-medium text-text-secondary transition-colors hover:border-electric/40 hover:text-electric disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!deleteTargetId}
        title="Delete Project"
        description={`Are you sure you want to delete "${deleteTarget?.product_name || deleteTarget?.name || 'this project'}"? All scripts, assets, and generated content will be permanently removed.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTargetId(null)}
        loading={deleting}
      />
    </>
  );
}
