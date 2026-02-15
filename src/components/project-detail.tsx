'use client';

import { useState, useEffect, useCallback } from 'react';
import { StatusBadge } from './status-badge';
import { PipelineProgress } from './pipeline-progress';
import { ScriptReview } from './script-review';

interface ProjectData {
  id: string;
  name: string | null;
  status: string;
  product_url: string;
  product_name: string | null;
  product_category: string | null;
  product_data: {
    product_name?: string;
    brand?: string;
    product_type?: string;
    product_size?: string;
    product_price?: string;
    category?: string;
    selling_points?: string[];
    key_claims?: string[];
    usage?: string;
    benefits?: string[];
    hook_angle?: string;
    product_image_url?: string;
    image_description_for_nano_banana_pro?: string;
    avatar_description?: string;
  } | null;
  cost_usd: string | null;
  error_message: string | null;
  created_at: string | null;
  character: { name: string; avatar_persona: string | null } | null;
}

export function ProjectDetail({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
      }
    } catch (err) {
      console.error('Failed to fetch project:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Poll while in processing state
  useEffect(() => {
    if (!project) return;
    const processingStatuses = ['created', 'analyzing', 'scripting', 'casting', 'directing', 'editing'];
    if (!processingStatuses.includes(project.status)) return;

    const interval = setInterval(fetchProject, 2000);
    return () => clearInterval(interval);
  }, [project?.status, fetchProject]);

  async function handleApproveAnalysis() {
    if (!project) return;
    setApproving(true);
    try {
      await fetch(`/api/projects/${projectId}/approve`, { method: 'POST' });
      fetchProject();
    } catch (err) {
      console.error('Failed to approve:', err);
    } finally {
      setApproving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-electric" />
            <div className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-b-magenta" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          </div>
          <p className="font-[family-name:var(--font-display)] text-sm text-text-muted">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="rounded-xl border border-border bg-surface p-12 text-center">
        <p className="text-text-secondary">Project not found.</p>
      </div>
    );
  }

  const data = project.product_data;

  return (
    <div className="animate-fade-in-up space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-text-primary">
            {project.product_name || project.name || 'Untitled Project'}
          </h1>
          <p className="mt-1 truncate font-[family-name:var(--font-mono)] text-xs text-text-muted">
            {project.product_url}
          </p>
        </div>
        <StatusBadge status={project.status} />
      </div>

      {/* Pipeline Progress */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <PipelineProgress status={project.status} />
      </div>

      {/* Error message */}
      {project.status === 'failed' && project.error_message && (
        <div className="rounded-xl border border-magenta/30 bg-magenta/5 p-5">
          <div className="flex items-start gap-3">
            <svg
              viewBox="0 0 20 20"
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-magenta"
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-magenta">
                Pipeline Failed
              </h3>
              <p className="mt-1 text-sm text-text-secondary">{project.error_message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Processing indicator for created/analyzing */}
      {(project.status === 'created' || project.status === 'analyzing') && (
        <div className="rounded-xl border border-electric/20 bg-electric/5 p-6">
          <div className="flex items-center gap-4">
            <div className="relative h-8 w-8 flex-shrink-0">
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-electric" />
              <div className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-b-electric-dim" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-electric">
                {project.status === 'created' ? 'Initializing...' : 'Analyzing Product'}
              </h3>
              <p className="mt-0.5 text-sm text-text-secondary">
                {project.status === 'created'
                  ? 'Setting up your project...'
                  : 'Extracting product data and generating content strategy. This typically takes 10-30 seconds.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Scripting processing indicator */}
      {project.status === 'scripting' && (
        <div className="rounded-xl border border-electric/20 bg-electric/5 p-6">
          <div className="flex items-center gap-4">
            <div className="relative h-8 w-8 flex-shrink-0">
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-electric" />
              <div className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-b-electric-dim" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-electric">
                Generating Script
              </h3>
              <p className="mt-0.5 text-sm text-text-secondary">
                Crafting a 60-second TikTok script with hooks, shots, and energy arcs...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Review */}
      {project.status === 'analysis_review' && data && (
        <>
          <AnalysisResults data={data} costUsd={project.cost_usd} character={project.character} />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleApproveAnalysis}
              disabled={approving}
              className="inline-flex items-center gap-2 rounded-lg bg-lime px-6 py-3 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_32px_rgba(184,255,0,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {approving ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" strokeLinecap="round" />
                  </svg>
                  Approving...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3.5 8 6.5 11 12.5 5" />
                  </svg>
                  Approve &amp; Generate Script
                </>
              )}
            </button>
          </div>
        </>
      )}

      {/* Script Review */}
      {project.status === 'script_review' && (
        <ScriptReview projectId={projectId} onStatusChange={fetchProject} />
      )}

      {/* Completed - show analysis results */}
      {project.status === 'completed' && data && (
        <AnalysisResults data={data} costUsd={project.cost_usd} character={project.character} />
      )}
    </div>
  );
}

/* ==============================
   Analysis Results Sub-component
   ============================== */

interface AnalysisResultsProps {
  data: NonNullable<ProjectData['product_data']>;
  costUsd: string | null;
  character: { name: string; avatar_persona: string | null } | null;
}

function AnalysisResults({ data, costUsd, character }: AnalysisResultsProps) {
  return (
    <div className="stagger-children space-y-5">
      {/* Product Info Grid */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-text-muted">
          Product Analysis
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {data.brand && (
            <div>
              <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Brand
              </dt>
              <dd className="mt-1 text-sm text-text-primary">{data.brand}</dd>
            </div>
          )}
          {data.product_type && (
            <div>
              <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Type
              </dt>
              <dd className="mt-1 text-sm text-text-primary">{data.product_type}</dd>
            </div>
          )}
          {data.product_size && (
            <div>
              <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Size
              </dt>
              <dd className="mt-1 text-sm text-text-primary">{data.product_size}</dd>
            </div>
          )}
          {data.product_price && (
            <div>
              <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Price
              </dt>
              <dd className="mt-1 text-sm text-text-primary">{data.product_price}</dd>
            </div>
          )}
          {data.category && (
            <div>
              <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Category
              </dt>
              <dd className="mt-1">
                <span className="inline-flex rounded-md bg-electric/10 px-2 py-0.5 font-[family-name:var(--font-mono)] text-xs text-electric">
                  {data.category}
                </span>
              </dd>
            </div>
          )}
          {costUsd && (
            <div>
              <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Cost
              </dt>
              <dd className="mt-1 font-[family-name:var(--font-mono)] text-sm text-text-primary">
                ${parseFloat(costUsd).toFixed(4)}
              </dd>
            </div>
          )}
          {character && (
            <div>
              <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Character
              </dt>
              <dd className="mt-1 text-sm text-text-primary">{character.name}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Lists Section */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data.selling_points && data.selling_points.length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
              Selling Points
            </h3>
            <ul className="space-y-2">
              {data.selling_points.map((point, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-magenta" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.key_claims && data.key_claims.length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
              Key Claims
            </h3>
            <ul className="space-y-2">
              {data.key_claims.map((claim, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-lime" />
                  {claim}
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.benefits && data.benefits.length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
              Benefits
            </h3>
            <ul className="space-y-2">
              {data.benefits.map((benefit, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-hot" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.usage && (
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
              Usage
            </h3>
            <p className="text-sm leading-relaxed text-text-secondary">{data.usage}</p>
          </div>
        )}
      </div>

      {/* Hook Angle */}
      {data.hook_angle && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="mb-2 font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
            Hook Angle
          </h3>
          <p className="text-sm leading-relaxed text-text-secondary">{data.hook_angle}</p>
        </div>
      )}

      {/* Avatar Description */}
      {data.avatar_description && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="mb-2 font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
            Avatar Description
          </h3>
          <p className="text-sm leading-relaxed text-text-secondary">{data.avatar_description}</p>
        </div>
      )}
    </div>
  );
}
