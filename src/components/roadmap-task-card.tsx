'use client';

import { FF7Sprite } from './ff7-sprite';

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

interface WorkerStat {
  key: string;
  name: string;
  color: string;
  role: string;
  tasks: { total: number; backlog: number; in_progress: number; done: number };
  assignments: string[];
}

interface TaskCardProps {
  task: RoadmapTask;
  workerInfo: WorkerStat | undefined;
  allWorkers: WorkerStat[];
  onClick: () => void;
  onReassign: (taskId: string, worker: string) => void;
  style?: React.CSSProperties;
}

const WORKER_SPRITE_MAP: Record<string, string> = {
  cloud: 'analyzing',
  tifa: 'scripting',
  barret: 'directing',
  aerith: 'broll_planning',
  red_xiii: 'casting',
};

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  '0': { label: 'T0', color: 'text-magenta' },
  '1': { label: 'T1', color: 'text-electric' },
  '1.5': { label: 'T1.5', color: 'text-amber-hot' },
  '2': { label: 'T2', color: 'text-summon' },
  '3': { label: 'T3', color: 'text-text-secondary' },
  '4': { label: 'T4', color: 'text-text-muted' },
};

export function TaskCard({ task, workerInfo, allWorkers, onClick, onReassign, style }: TaskCardProps) {
  const isTier0 = task.tier === '0';
  const isDone = task.status === 'done';
  const isActive = task.status === 'in_progress';
  const borderColor = isTier0 ? 'var(--color-magenta)' : (workerInfo?.color || 'var(--color-border)');
  const tierInfo = TIER_LABELS[task.tier] || { label: `T${task.tier}`, color: 'text-text-muted' };

  const progress = task.checkboxes.total > 0
    ? Math.round((task.checkboxes.completed / task.checkboxes.total) * 100)
    : (isDone ? 100 : 0);

  return (
    <div
      className={`group relative cursor-pointer rounded-lg border bg-surface-raised transition-all hover:bg-surface-overlay ${
        isDone ? 'opacity-50' : ''
      } ${isActive ? 'shadow-[0_0_16px_rgba(0,229,160,0.08)]' : ''}`}
      style={{
        borderColor: isActive ? 'var(--color-electric)' : 'var(--color-border)',
        borderLeftWidth: 3,
        borderLeftColor: borderColor,
        ...style,
      }}
      onClick={onClick}
    >
      <div className="p-3">
        {/* Header row: worker + tier */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {workerInfo && (
              <FF7Sprite character={WORKER_SPRITE_MAP[workerInfo.key] || workerInfo.key} size="sm" />
            )}
            <span className="text-[11px] text-text-secondary">
              {workerInfo?.name.split(' ')[0] || 'Unassigned'}
            </span>
          </div>
          <span className={`font-[family-name:var(--font-mono)] text-[10px] font-bold ${tierInfo.color}`}>
            {tierInfo.label}
          </span>
        </div>

        {/* Task ID + title */}
        <div className="mt-2">
          <span className="font-[family-name:var(--font-mono)] text-[11px] font-bold text-electric">{task.id}</span>
          <h3 className="text-sm font-medium leading-tight text-text-primary">{task.title}</h3>
        </div>

        {/* Description (1 line) */}
        {task.description && (
          <p className="mt-1 line-clamp-1 text-[11px] text-text-muted">{task.description}</p>
        )}

        {/* Progress bar */}
        {task.checkboxes.total > 0 && (
          <div className="mt-2.5">
            <div className="flex items-center justify-between">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-overlay">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: isDone ? 'var(--color-lime)' : 'var(--color-electric)',
                  }}
                />
              </div>
              <span className="ml-2 font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
                {task.checkboxes.completed}/{task.checkboxes.total}
              </span>
            </div>
          </div>
        )}

        {/* Footer: spec, deps, cost */}
        {(task.specPath || task.dependsOn.length > 0 || task.costImpact) && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {task.specPath && (
              <span className="font-[family-name:var(--font-mono)] text-[10px] text-summon">Spec</span>
            )}
            {task.dependsOn.map((dep) => (
              <span key={dep} className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
                {dep}
              </span>
            ))}
            {task.costImpact && (
              <span className="font-[family-name:var(--font-mono)] text-[10px] text-gil">{task.costImpact}</span>
            )}
          </div>
        )}

        {/* Worker reassignment dropdown */}
        <div className="mt-2 opacity-0 transition-opacity group-hover:opacity-100">
          <select
            value={task.worker || ''}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              if (e.target.value) onReassign(task.id, e.target.value);
            }}
            className="w-full rounded border border-border bg-surface px-2 py-1 font-[family-name:var(--font-mono)] text-[10px] text-text-secondary focus:border-electric focus:outline-none"
          >
            <option value="" disabled>Reassign...</option>
            {allWorkers.map((w) => (
              <option key={w.key} value={w.key}>{w.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
