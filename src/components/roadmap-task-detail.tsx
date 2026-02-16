'use client';

import { useEffect, useRef } from 'react';
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

interface TaskDetailProps {
  task: RoadmapTask;
  allTasks: RoadmapTask[];
  workerInfo: WorkerStat | undefined;
  onClose: () => void;
}

const WORKER_SPRITE_MAP: Record<string, string> = {
  cloud: 'analyzing',
  tifa: 'scripting',
  barret: 'directing',
  aerith: 'broll_planning',
  red_xiii: 'casting',
};

const STATUS_STYLES: Record<string, { label: string; classes: string }> = {
  backlog: { label: 'Backlog', classes: 'bg-surface-overlay text-text-secondary' },
  in_progress: { label: 'In Progress', classes: 'bg-electric/15 text-electric' },
  done: { label: 'Done', classes: 'bg-lime/15 text-lime' },
};

interface CheckboxItem {
  checked: boolean;
  text: string;
}

interface CheckboxSection {
  heading: string | null;
  items: CheckboxItem[];
}

function parseCheckboxes(body: string): CheckboxSection[] {
  const lines = body.split('\n');
  const sections: CheckboxSection[] = [];
  let currentSection: CheckboxSection = { heading: null, items: [] };

  for (const line of lines) {
    // Section header: **Backend:**, **Frontend:**, etc.
    const headingMatch = line.match(/^\*\*(.+?)[:]*\*\*\s*$/);
    if (headingMatch) {
      if (currentSection.items.length > 0 || currentSection.heading) {
        sections.push(currentSection);
      }
      currentSection = { heading: headingMatch[1], items: [] };
      continue;
    }

    // Checkbox line
    const cbMatch = line.match(/^-\s*\[([ xX])\]\s*(.+)$/);
    if (cbMatch) {
      currentSection.items.push({
        checked: cbMatch[1] !== ' ',
        text: cbMatch[2].trim(),
      });
    }
  }

  if (currentSection.items.length > 0 || currentSection.heading) {
    sections.push(currentSection);
  }

  return sections;
}

export function TaskDetailModal({ task, allTasks, workerInfo, onClose }: TaskDetailProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const statusInfo = STATUS_STYLES[task.status] || STATUS_STYLES.backlog;
  const progress = task.checkboxes.total > 0
    ? Math.round((task.checkboxes.completed / task.checkboxes.total) * 100)
    : (task.status === 'done' ? 100 : 0);

  const sections = parseCheckboxes(task.body);

  // Resolve dependency statuses
  const depStatuses = task.dependsOn.map((depId) => {
    const depTask = allTasks.find((t) => t.id === depId);
    return {
      id: depId,
      status: depTask?.status || 'backlog',
    };
  });

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-void/80 p-6 pt-20 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="animate-fade-in-up w-full max-w-2xl rounded-xl border border-border bg-surface p-6 shadow-2xl">
        {/* Close button */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Task ID + title */}
            <div className="flex items-center gap-2">
              <span className="font-[family-name:var(--font-mono)] text-sm font-bold text-electric">{task.id}</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${statusInfo.classes}`}>
                {statusInfo.label}
              </span>
            </div>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl font-bold text-text-primary">
              {task.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-overlay hover:text-text-primary"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </button>
        </div>

        {/* Meta row */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {workerInfo && (
            <div className="flex items-center gap-1.5">
              <FF7Sprite character={WORKER_SPRITE_MAP[workerInfo.key] || workerInfo.key} size="sm" />
              <div>
                <span className="text-xs font-medium text-text-primary">{workerInfo.name}</span>
                <span className="ml-1 text-[10px] text-text-muted">{workerInfo.role}</span>
              </div>
            </div>
          )}
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
            Tier {task.tier}
          </span>
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
            {task.priority}
          </span>
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
            {task.effort}
          </span>
          {task.costImpact && (
            <span className="font-[family-name:var(--font-mono)] text-[11px] text-gil">
              {task.costImpact}
            </span>
          )}
        </div>

        {/* Description */}
        {task.description && (
          <p className="mt-4 text-sm leading-relaxed text-text-secondary">{task.description}</p>
        )}

        {/* Progress bar */}
        {task.checkboxes.total > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-text-muted">Progress</span>
              <span className="font-[family-name:var(--font-mono)] text-text-secondary">
                {progress}% ({task.checkboxes.completed}/{task.checkboxes.total})
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-overlay">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  backgroundColor: task.status === 'done' ? 'var(--color-lime)' : 'var(--color-electric)',
                }}
              />
            </div>
          </div>
        )}

        {/* Dependencies */}
        {depStatuses.length > 0 && (
          <div className="mt-4">
            <h4 className="text-[11px] font-medium uppercase tracking-wider text-text-muted">Dependencies</h4>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {depStatuses.map((dep) => (
                <span
                  key={dep.id}
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-[family-name:var(--font-mono)] text-[11px] ${
                    dep.status === 'done'
                      ? 'bg-lime/10 text-lime'
                      : dep.status === 'in_progress'
                      ? 'bg-amber-hot/10 text-amber-hot'
                      : 'bg-surface-overlay text-text-muted'
                  }`}
                >
                  {dep.status === 'done' ? (
                    <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2,6 5,9 10,3" />
                    </svg>
                  ) : dep.status === 'in_progress' ? (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-hot animate-materia-pulse" />
                  ) : (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-text-muted" />
                  )}
                  {dep.id}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Spec link */}
        {task.specPath && (
          <div className="mt-3">
            <span className="font-[family-name:var(--font-mono)] text-[11px] text-summon">
              {task.specPath}
            </span>
          </div>
        )}

        {/* Checkbox sections */}
        {sections.length > 0 && (
          <div className="mt-5 space-y-4 border-t border-border pt-4">
            {sections.map((section, si) => (
              <div key={si}>
                {section.heading && (
                  <h4 className="mb-2 text-xs font-semibold text-text-secondary">{section.heading}</h4>
                )}
                <ul className="space-y-1">
                  {section.items.map((item, ii) => (
                    <li key={ii} className="flex items-start gap-2 text-sm">
                      {item.checked ? (
                        <svg viewBox="0 0 16 16" fill="none" className="mt-0.5 h-4 w-4 flex-shrink-0 text-lime" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <rect x="1" y="1" width="14" height="14" rx="2" />
                          <polyline points="4,8 7,11 12,5" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 16 16" fill="none" className="mt-0.5 h-4 w-4 flex-shrink-0 text-text-muted" stroke="currentColor" strokeWidth={1.5}>
                          <rect x="1" y="1" width="14" height="14" rx="2" />
                        </svg>
                      )}
                      <span className={item.checked ? 'text-text-muted line-through' : 'text-text-secondary'}>
                        {item.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
