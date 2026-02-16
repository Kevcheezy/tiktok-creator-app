'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { QuestStats, type StatFilter } from './quest-stats';
import { QuestCard } from './quest-card';
import { QuestColumn } from './quest-column';
import { QuestPath } from './quest-path';
import { ConfirmDialog } from './confirm-dialog';
import { REVIEW_GATES } from './ff7-theme';
import { FF7Sprite } from './ff7-sprite';

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
  failed_at_status: string | null;
}

const COLUMN_DEFS = [
  {
    id: 'midgar',
    name: 'Midgar',
    subtitle: 'Sector 7 Slums',
    character: 'analyzing',
    color: '#00e5a0',
    statuses: ['created', 'analyzing', 'analysis_review'],
  },
  {
    id: 'kalm',
    name: 'Kalm',
    subtitle: 'Kalm Inn',
    character: 'scripting',
    color: '#ffc933',
    statuses: ['scripting', 'script_review'],
  },
  {
    id: 'cosmo_canyon',
    name: 'Cosmo Canyon',
    subtitle: 'Observatory',
    character: 'broll_planning',
    color: '#7aff6e',
    statuses: ['broll_planning', 'broll_review'],
  },
  {
    id: 'junon',
    name: 'Junon',
    subtitle: 'Military Port',
    character: 'casting',
    color: '#ff8c42',
    statuses: ['influencer_selection', 'casting', 'casting_review'],
  },
  {
    id: 'gold_saucer',
    name: 'Gold Saucer',
    subtitle: 'Event Square',
    character: 'directing',
    color: '#ff2d55',
    statuses: ['directing', 'voiceover', 'broll_generation', 'asset_review'],
  },
  {
    id: 'northern_crater',
    name: 'Northern Crater',
    subtitle: 'Victory Throne',
    character: 'editing',
    color: '#7aff6e',
    statuses: ['editing', 'completed'],
  },
] as const;

// Build status → column lookup
const STATUS_TO_COLUMN: Record<string, string> = {};
for (const col of COLUMN_DEFS) {
  for (const s of col.statuses) {
    STATUS_TO_COLUMN[s] = col.id;
  }
}

function getColumnForProject(project: Project): string {
  if (project.status === 'failed') {
    const failedAt = project.failed_at_status;
    if (failedAt && STATUS_TO_COLUMN[failedAt]) return STATUS_TO_COLUMN[failedAt];
    return 'midgar';
  }
  return STATUS_TO_COLUMN[project.status] || 'midgar';
}

export function QuestBoard({ projects: initialProjects }: { projects: Project[] }) {
  const [projects, setProjects] = useState(initialProjects);
  const [searchQuery, setSearchQuery] = useState('');
  const [statFilter, setStatFilter] = useState<StatFilter>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const deleteTarget = projects.find((p) => p.id === deleteTargetId);

  // Stats from full project list (not filtered)
  const stats = useMemo(() => {
    let inBattle = 0;
    let awaitingOrders = 0;
    let victories = 0;
    let ko = 0;
    let totalGil = 0;

    for (const p of projects) {
      const cost = p.cost_usd ? parseFloat(p.cost_usd) : 0;
      if (!isNaN(cost)) totalGil += cost;

      if (p.status === 'completed') { victories++; continue; }
      if (p.status === 'failed') { ko++; continue; }
      if (p.status in REVIEW_GATES) { awaitingOrders++; continue; }
      inBattle++;
    }

    return { inBattle, awaitingOrders, victories, ko, totalGil };
  }, [projects]);

  // Filtered projects: search + stat filter (AND logic)
  const filteredProjects = useMemo(() => {
    let result = projects;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const numMatch = q.replace(/^project-?/i, '');
      const searchNum = /^\d+$/.test(numMatch) ? parseInt(numMatch, 10) : null;
      result = result.filter(
        (p) =>
          (searchNum !== null && p.project_number === searchNum) ||
          (p.product_name && p.product_name.toLowerCase().includes(q)) ||
          (p.name && p.name.toLowerCase().includes(q)) ||
          p.product_url.toLowerCase().includes(q)
      );
    }

    if (statFilter === 'battle') {
      result = result.filter((p) => p.status !== 'completed' && p.status !== 'failed' && !(p.status in REVIEW_GATES));
    } else if (statFilter === 'review') {
      result = result.filter((p) => p.status in REVIEW_GATES);
    } else if (statFilter === 'victory') {
      result = result.filter((p) => p.status === 'completed');
    } else if (statFilter === 'ko') {
      result = result.filter((p) => p.status === 'failed');
    }

    return result;
  }, [projects, searchQuery, statFilter]);

  // Group filtered projects into columns
  const groupedColumns = useMemo(() => {
    return COLUMN_DEFS.map((col) => {
      const colProjects = filteredProjects.filter((p) => getColumnForProject(p) === col.id);
      return { ...col, projects: colProjects };
    });
  }, [filteredProjects]);

  // Path decoration data
  const pathColumns = useMemo(() => {
    return groupedColumns.map((col) => ({
      color: col.color,
      hasProjects: col.projects.length > 0,
    }));
  }, [groupedColumns]);

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

  // True empty: no projects at all
  if (projects.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-dashed border-border-bright bg-surface/50 px-8 py-20 text-center">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-electric/5 blur-3xl" />
        </div>
        <div className="relative">
          <FF7Sprite character="analyzing" state="idle" size="lg" className="mx-auto" />
          <h3 className="mt-5 font-[family-name:var(--font-display)] text-lg font-semibold text-text-primary">
            No quests active
          </h3>
          <p className="mt-2 text-sm text-text-secondary">
            Start your first encounter to begin the journey.
          </p>
          <Link
            href="/projects/new"
            className="mt-6 inline-flex items-center gap-2 rounded border-2 border-electric bg-transparent px-5 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-electric transition-all hover:bg-electric/10 hover:shadow-[0_0_24px_rgba(0,229,160,0.2)]"
          >
            <svg viewBox="0 0 8 10" fill="currentColor" className="h-2.5 w-2.5">
              <polygon points="0,0 8,5 0,10" />
            </svg>
            Start Encounter
          </Link>
          {/* Muted column names */}
          <div className="mt-10 flex justify-center gap-6">
            {COLUMN_DEFS.map((col) => (
              <span key={col.id} className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted/40">
                {col.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Search */}
      <div className="mb-4">
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
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, product, or PROJECT-N..."
            className="w-full rounded-lg border border-border bg-surface-raised py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted/50 outline-none transition-colors focus:border-electric/40 focus:ring-1 focus:ring-electric/20"
          />
        </div>
      </div>

      {/* Stats bar */}
      <QuestStats
        inBattle={stats.inBattle}
        awaitingOrders={stats.awaitingOrders}
        victories={stats.victories}
        ko={stats.ko}
        totalGil={stats.totalGil}
        activeFilter={statFilter}
        onFilterChange={setStatFilter}
      />

      {/* Path + Columns (scrollable) */}
      <div className="mt-4 overflow-x-auto pb-4">
        <QuestPath columns={pathColumns} />

        <div className="flex gap-4 mt-2">
          {groupedColumns.map((col) => (
            <QuestColumn
              key={col.id}
              name={col.name}
              subtitle={col.subtitle}
              character={col.character}
              color={col.color}
              count={col.projects.length}
            >
              {col.projects.map((project) => (
                <QuestCard
                  key={project.id}
                  project={project}
                  onDelete={setDeleteTargetId}
                />
              ))}
            </QuestColumn>
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTargetId}
        title="Delete Project"
        description={`Are you sure you want to delete "${deleteTarget?.product_name || deleteTarget?.name || 'this project'}"? All generated content will be permanently removed.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTargetId(null)}
        loading={deleting}
      />
    </div>
  );
}
