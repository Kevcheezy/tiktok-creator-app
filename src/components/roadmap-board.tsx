'use client';

import { useState, useEffect, useCallback } from 'react';
import { WorkerBar } from './roadmap-worker-bar';
import { TaskCard } from './roadmap-task-card';
import { TaskDetailModal } from './roadmap-task-detail';

// ─── Types ────────────────────────────────────────────

interface RoadmapTask {
  id: string;
  title: string;
  tier: string;
  status: 'backlog' | 'in_progress' | 'done';
  priority: string;
  effort: string;
  dependsOn: string[];
  specPath: string | null;
  checkboxes: { total: number; completed: number };
  description: string;
  costImpact: string | null;
  worker: string | null;
  body: string;
}

interface Summary {
  total: number;
  backlog: number;
  in_progress: number;
  done: number;
  byTier: Record<string, number>;
  byWorker: Record<string, { total: number; in_progress: number; done: number }>;
}

interface LastCommit {
  hash: string;
  message: string;
  date: string;
}

interface WorkerStat {
  key: string;
  name: string;
  color: string;
  role: string;
  tasks: { total: number; backlog: number; in_progress: number; done: number };
  assignments: string[];
}

// ─── Constants ────────────────────────────────────────

const POLL_INTERVAL = 30_000;
const TIER_OPTIONS = ['all', '0', '1', '1.5', '2', '3', '4'];
const COLUMN_CONFIG = [
  { key: 'backlog' as const, label: 'BACKLOG', color: 'text-text-secondary', dotColor: 'bg-text-muted' },
  { key: 'in_progress' as const, label: 'IN PROGRESS', color: 'text-electric', dotColor: 'bg-electric' },
  { key: 'done' as const, label: 'DONE', color: 'text-lime', dotColor: 'bg-lime' },
];

// ─── Main Component ───────────────────────────────────

export function RoadmapBoard() {
  const [tasks, setTasks] = useState<RoadmapTask[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [lastCommit, setLastCommit] = useState<LastCommit | null>(null);
  const [workers, setWorkers] = useState<WorkerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Detail modal
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [roadmapRes, workersRes] = await Promise.all([
        fetch('/api/roadmap'),
        fetch('/api/roadmap/workers'),
      ]);

      if (!roadmapRes.ok || !workersRes.ok) {
        throw new Error('Failed to fetch roadmap data');
      }

      const roadmapData = await roadmapRes.json();
      const workersData = await workersRes.json();

      setTasks(roadmapData.tasks);
      setSummary(roadmapData.summary);
      setLastCommit(roadmapData.lastCommit);
      setWorkers(workersData.workers);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roadmap');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Worker reassignment handler
  async function handleReassign(taskId: string, worker: string) {
    try {
      const res = await fetch('/api/roadmap/assign', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, worker }),
      });
      if (!res.ok) throw new Error('Failed to reassign');
      fetchData();
    } catch {
      // Silently fail — next poll will correct
    }
  }

  // Filtering
  const filteredTasks = tasks.filter((t) => {
    if (selectedWorker && t.worker !== selectedWorker) return false;
    if (tierFilter !== 'all' && t.tier !== tierFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!t.id.toLowerCase().includes(q) && !t.title.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const columns = {
    backlog: filteredTasks.filter((t) => t.status === 'backlog'),
    in_progress: filteredTasks.filter((t) => t.status === 'in_progress'),
    done: filteredTasks.filter((t) => t.status === 'done'),
  };

  // Build worker lookup
  const workerMap = new Map(workers.map((w) => [w.key, w]));

  // Expanded task
  const expandedTask = expandedTaskId ? tasks.find((t) => t.id === expandedTaskId) : null;

  // ─── Loading state ───────────────────────────────────

  if (loading) {
    return (
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-electric border-t-transparent" />
          <span className="font-[family-name:var(--font-display)] text-sm text-text-secondary">
            Loading roadmap...
          </span>
        </div>
      </div>
    );
  }

  // ─── Error state ─────────────────────────────────────

  if (error) {
    return (
      <div className="animate-fade-in-up rounded-xl border border-magenta/30 bg-magenta/5 p-6">
        <p className="text-sm text-magenta">{error}</p>
        <button
          onClick={() => { setLoading(true); fetchData(); }}
          className="mt-3 rounded-lg border border-magenta/30 px-4 py-2 text-xs font-medium text-magenta transition-colors hover:bg-magenta/10"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* Page header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-text-primary">
            Roadmap
          </h1>
          {summary && (
            <p className="mt-1 text-sm text-text-secondary">
              {summary.total} tasks &middot;{' '}
              <span className="text-electric">{summary.in_progress} active</span> &middot;{' '}
              <span className="text-lime">{summary.done} done</span>
            </p>
          )}
        </div>
        {lastCommit && lastCommit.hash !== 'unknown' && (
          <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
            {lastCommit.hash.slice(0, 7)}
          </span>
        )}
      </div>

      {/* Worker bar */}
      <WorkerBar workers={workers} selected={selectedWorker} onSelect={setSelectedWorker} />

      {/* Filter bar */}
      <FilterBar
        tierFilter={tierFilter}
        onTierChange={setTierFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filteredCount={filteredTasks.length}
        totalCount={tasks.length}
      />

      {/* Kanban columns */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {COLUMN_CONFIG.map((col) => (
          <KanbanColumn
            key={col.key}
            label={col.label}
            color={col.color}
            dotColor={col.dotColor}
            tasks={columns[col.key]}
            workerMap={workerMap}
            allWorkers={workers}
            isDoneColumn={col.key === 'done'}
            onCardClick={setExpandedTaskId}
            onReassign={handleReassign}
          />
        ))}
      </div>

      {/* Detail modal */}
      {expandedTask && (
        <TaskDetailModal
          task={expandedTask}
          allTasks={tasks}
          workerInfo={expandedTask.worker ? workerMap.get(expandedTask.worker) : undefined}
          onClose={() => setExpandedTaskId(null)}
        />
      )}
    </div>
  );
}

// ─── FilterBar ────────────────────────────────────────

function FilterBar({
  tierFilter,
  onTierChange,
  searchQuery,
  onSearchChange,
  filteredCount,
  totalCount,
}: {
  tierFilter: string;
  onTierChange: (v: string) => void;
  searchQuery: string;
  onSearchChange: (v: string) => void;
  filteredCount: number;
  totalCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Tier filter */}
      <select
        value={tierFilter}
        onChange={(e) => onTierChange(e.target.value)}
        className="rounded-lg border border-border bg-surface-raised px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-text-secondary focus:border-electric focus:outline-none"
      >
        {TIER_OPTIONS.map((t) => (
          <option key={t} value={t}>
            {t === 'all' ? 'All Tiers' : `Tier ${t}`}
          </option>
        ))}
      </select>

      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        >
          <circle cx="7" cy="7" r="5" />
          <line x1="11" y1="11" x2="14" y2="14" />
        </svg>
        <input
          type="text"
          placeholder="Search ID or title..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface-raised py-2 pl-9 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:border-electric focus:outline-none"
        />
      </div>

      {/* Count indicator */}
      {filteredCount !== totalCount && (
        <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
          {filteredCount}/{totalCount} shown
        </span>
      )}
    </div>
  );
}

// ─── KanbanColumn ─────────────────────────────────────

function KanbanColumn({
  label,
  color,
  dotColor,
  tasks,
  workerMap,
  allWorkers,
  isDoneColumn,
  onCardClick,
  onReassign,
}: {
  label: string;
  color: string;
  dotColor: string;
  tasks: RoadmapTask[];
  workerMap: Map<string, WorkerStat>;
  allWorkers: WorkerStat[];
  isDoneColumn: boolean;
  onCardClick: (id: string) => void;
  onReassign: (taskId: string, worker: string) => void;
}) {
  return (
    <div className="flex flex-col">
      {/* Column header */}
      <div className="mb-3 flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />
        <h2 className={`font-[family-name:var(--font-display)] text-xs font-bold uppercase tracking-widest ${color}`}>
          {label}
        </h2>
        <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted transition-all">
          {tasks.length}
        </span>
      </div>

      {/* Card list */}
      <div className={`space-y-2 ${isDoneColumn ? 'max-h-[70vh] overflow-y-auto pr-1' : ''}`}>
        {tasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-8 text-center">
            <p className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
              {isDoneColumn ? 'No completed tasks' : 'Nothing here'}
            </p>
          </div>
        ) : (
          tasks.map((task, i) => (
            <TaskCard
              key={task.id}
              task={task}
              workerInfo={task.worker ? workerMap.get(task.worker) : undefined}
              allWorkers={allWorkers}
              onClick={() => onCardClick(task.id)}
              onReassign={onReassign}
              style={{ animationDelay: `${i * 30}ms` }}
            />
          ))
        )}
      </div>
    </div>
  );
}
