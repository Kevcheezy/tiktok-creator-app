'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { StatusBadge } from './status-badge';
import { PipelineProgress } from './pipeline-progress';
import { ScriptReview } from './script-review';
import { AssetReview } from './asset-review';
import { ConfirmDialog } from './confirm-dialog';
import { StageProgress } from './stage-progress';

interface ProjectData {
  id: string;
  name: string | null;
  status: string;
  product_url: string;
  product_name: string | null;
  product_category: string | null;
  product_image_url: string | null;
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
  failed_at_status: string | null;
  created_at: string | null;
  character: { name: string; avatar_persona: string | null } | null;
  influencer_id: string | null;
  influencer: { id: string; name: string; persona: string | null; image_url: string | null } | null;
}

export function ProjectDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState('');
  const [archived, setArchived] = useState(false);

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
    const processingStatuses = ['created', 'analyzing', 'scripting', 'casting', 'directing', 'voiceover', 'editing'];
    if (!processingStatuses.includes(project.status)) return;

    const interval = setInterval(fetchProject, 2000);
    return () => clearInterval(interval);
  }, [project?.status, fetchProject]);

  // Fetch final video URL when project is completed
  useEffect(() => {
    if (project?.status === 'completed') {
      fetch(`/api/projects/${project.id}/assets`)
        .then(r => r.json())
        .then(data => {
          const segments = data.segments || [];
          for (const seg of segments) {
            for (const asset of (seg as { assets?: { type: string; url?: string }[] }).assets || []) {
              if (asset.type === 'final_video' && asset.url) {
                setFinalVideoUrl(asset.url);
              }
            }
          }
        });
    }
  }, [project?.status, project?.id]);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/');
      }
    } catch {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

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

  async function handleArchive() {
    if (!project) return;
    const res = await fetch(`/api/projects/${project.id}/archive`, { method: 'POST' });
    if (res.ok) setArchived(true);
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
        <div className="flex flex-shrink-0 items-center gap-3">
          <StatusBadge status={project.status} />
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-lg border border-border p-2.5 text-text-muted transition-all hover:border-magenta/40 hover:bg-magenta/5 hover:text-magenta"
            title="Delete project"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 4h12" />
              <path d="M5 4V2.5A.5.5 0 015.5 2h5a.5.5 0 01.5.5V4" />
              <path d="M12.5 4v9.5a1 1 0 01-1 1h-7a1 1 0 01-1-1V4" />
              <line x1="6.5" y1="7" x2="6.5" y2="11" />
              <line x1="9.5" y1="7" x2="9.5" y2="11" />
            </svg>
          </button>
        </div>
      </div>

      {/* Pipeline Progress */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <PipelineProgress status={project.status} failedAtStatus={project.failed_at_status} />
      </div>

      {/* Error message with recovery actions */}
      {project.status === 'failed' && (
        <FailedRecovery
          projectId={projectId}
          errorMessage={project.error_message}
          failedAtStatus={project.failed_at_status}
          onRecovered={fetchProject}
        />
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
          <ProductImageSection
            projectId={projectId}
            productImageUrl={project.product_image_url || data.product_image_url || null}
            onImageUpdated={fetchProject}
          />
          <div className="flex items-center justify-between gap-4">
            {!project.product_image_url && !data.product_image_url && (
              <p className="text-sm text-amber-hot">
                A product image is required before proceeding.
              </p>
            )}
            <div className="ml-auto">
              <button
                type="button"
                onClick={handleApproveAnalysis}
                disabled={approving || (!project.product_image_url && !data.product_image_url)}
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
          </div>
        </>
      )}

      {/* Asset generation progress indicators */}
      {project.status === 'casting' && (
        <StageProgress projectId={projectId} stage="casting" color="magenta" />
      )}
      {project.status === 'directing' && (
        <StageProgress projectId={projectId} stage="directing" color="magenta" />
      )}
      {project.status === 'voiceover' && (
        <StageProgress projectId={projectId} stage="voiceover" color="magenta" />
      )}
      {project.status === 'editing' && (
        <StageProgress projectId={projectId} stage="editing" color="electric" />
      )}

      {/* Script Review */}
      {project.status === 'script_review' && (
        <ScriptReview projectId={projectId} onStatusChange={fetchProject} />
      )}

      {/* Influencer Selection Gate */}
      {project.status === 'influencer_selection' && (
        <InfluencerSelection
          projectId={projectId}
          currentInfluencerId={project.influencer_id}
          onSelected={fetchProject}
        />
      )}

      {/* Casting Review */}
      {project.status === 'casting_review' && (
        <AssetReview
          projectId={projectId}
          onStatusChange={fetchProject}
          confirmBeforeApprove={{
            title: 'Generate Videos?',
            description: 'This will generate video segments using Kling 3.0 Pro and voiceover audio using ElevenLabs. Video generation takes 2-5 minutes per segment.',
            cost: '~$1.25',
          }}
        />
      )}

      {/* Asset Review */}
      {project.status === 'asset_review' && (
        <AssetReview projectId={projectId} onStatusChange={fetchProject} />
      )}

      {/* Completed - Final Review */}
      {project.status === 'completed' && (
        <div className="space-y-6">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-text-primary">
            Final Video
          </h2>

          {finalVideoUrl ? (
            <div className="mx-auto max-w-sm">
              <video
                src={finalVideoUrl}
                controls
                className="w-full rounded-xl border border-border aspect-[9/16]"
              />
            </div>
          ) : (
            <p className="text-text-muted text-sm">No final video found.</p>
          )}

          <div className="flex gap-3">
            {finalVideoUrl && (
              <a
                href={finalVideoUrl}
                download
                className="inline-flex items-center gap-2 rounded-lg bg-electric px-4 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:bg-electric/90 hover:shadow-[0_0_24px_rgba(0,240,255,0.3)]"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M8 2v9M4 7l4 4 4-4M2 13h12" />
                </svg>
                Download Video
              </a>
            )}
            <button
              onClick={handleArchive}
              disabled={archived}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 font-[family-name:var(--font-display)] text-sm font-medium text-text-secondary transition-colors hover:text-electric hover:border-electric/30 disabled:opacity-50"
            >
              {archived ? 'Archived' : 'Archive Run'}
            </button>
          </div>

          <div className="glass rounded-xl border border-border p-6">
            <h3 className="mb-4 font-[family-name:var(--font-display)] text-xs font-semibold text-text-muted uppercase tracking-wider">
              Recipe
            </h3>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-text-muted">Product</dt>
                <dd className="text-text-primary">{project.product_name || '\u2014'}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Category</dt>
                <dd className="text-text-primary">{project.product_category || '\u2014'}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Total Cost</dt>
                <dd className="text-electric font-medium">${parseFloat(project.cost_usd || '0').toFixed(2)}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Project"
        description={`Are you sure you want to delete "${project.product_name || project.name || 'this project'}"? All scripts, assets, and generated content will be permanently removed.`}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        loading={deleting}
      />
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

/* ==============================
   Product Image Section
   ============================== */

interface ProductImageSectionProps {
  projectId: string;
  productImageUrl: string | null;
  onImageUpdated: () => void;
}

function ProductImageSection({ projectId, productImageUrl, onImageUpdated }: ProductImageSectionProps) {
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const hasValidImage = !!productImageUrl && !imageError;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch(`/api/projects/${projectId}/product-image`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      setImageError(false);
      onImageUpdated();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      // Reset input so same file can be re-selected
      e.target.value = '';
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="mb-3 font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
        Product Image
      </h3>

      {hasValidImage ? (
        <div className="flex items-start gap-5">
          <div className="relative h-32 w-32 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-void">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={productImageUrl}
              alt="Product"
              className="h-full w-full object-contain"
              onError={() => setImageError(true)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-text-secondary">
              Image extracted from product page.
            </p>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-electric/30 hover:text-electric">
              {uploading ? 'Uploading...' : 'Replace Image'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-amber-hot/30 bg-amber-hot/5 p-6">
          <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-amber-hot" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          <p className="text-center text-sm text-text-secondary">
            {productImageUrl && imageError
              ? 'The extracted image could not be loaded. Please upload a product image.'
              : 'No product image found. Upload one to continue.'}
          </p>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-amber-hot px-4 py-2 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_24px_rgba(255,160,0,0.3)]">
            {uploading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" strokeLinecap="round" />
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M8 12V4M4 7l4-4 4 4M2 14h12" />
                </svg>
                Upload Product Image
              </>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>
      )}

      {uploadError && (
        <p className="mt-2 text-sm text-magenta">{uploadError}</p>
      )}
    </div>
  );
}

/* ==============================
   Influencer Selection Gate
   ============================== */

interface InfluencerOption {
  id: string;
  name: string;
  persona: string | null;
  image_url: string | null;
}

interface InfluencerSelectionProps {
  projectId: string;
  currentInfluencerId: string | null;
  onSelected: () => void;
}

function InfluencerSelection({ projectId, currentInfluencerId, onSelected }: InfluencerSelectionProps) {
  const [influencers, setInfluencers] = useState<InfluencerOption[]>([]);
  const [selectedId, setSelectedId] = useState(currentInfluencerId || '');
  const [loadingList, setLoadingList] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [productPlacement, setProductPlacement] = useState([
    { segment: 0, visibility: 'none', notes: '' },
    { segment: 1, visibility: 'subtle', notes: '' },
    { segment: 2, visibility: 'hero', notes: '' },
    { segment: 3, visibility: 'set_down', notes: '' },
  ]);

  useEffect(() => {
    fetch('/api/influencers')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setInfluencers(data);
        // Pre-select current if set, otherwise first with an image
        if (!currentInfluencerId && data.length > 0) {
          const withImage = data.find((i: InfluencerOption) => i.image_url);
          if (withImage) setSelectedId(withImage.id);
        }
      })
      .catch(() => setInfluencers([]))
      .finally(() => setLoadingList(false));
  }, [currentInfluencerId]);

  async function handleConfirm() {
    if (!selectedId) return;
    setConfirming(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectId}/select-influencer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ influencerId: selectedId, productPlacement }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to select influencer');
      }
      onSelected();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select influencer');
    } finally {
      setConfirming(false);
    }
  }

  const selected = influencers.find((i) => i.id === selectedId);

  if (loadingList) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-electric border-t-transparent" />
          <span className="text-sm text-text-secondary">Loading influencers...</span>
        </div>
      </div>
    );
  }

  if (influencers.length === 0) {
    return (
      <div className="rounded-xl border border-amber-hot/30 bg-amber-hot/5 p-6">
        <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-amber-hot">
          No Influencers Available
        </h3>
        <p className="mt-1 text-sm text-text-secondary">
          Create an influencer with a reference image before generating keyframes.
        </p>
        <a
          href="/influencers/new"
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-hot px-4 py-2 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_24px_rgba(255,160,0,0.3)]"
        >
          Create Influencer
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-electric/20 bg-surface p-5">
        <h2 className="mb-1 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-electric">
          Select Influencer for Keyframes
        </h2>
        <p className="mb-5 text-sm text-text-secondary">
          Choose the AI influencer whose likeness will be used to generate keyframe images. Their reference photo will be edited into each scene.
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {influencers.map((inf) => {
            const isSelected = selectedId === inf.id;
            const hasImage = !!inf.image_url;
            return (
              <button
                key={inf.id}
                type="button"
                onClick={() => hasImage && setSelectedId(inf.id)}
                disabled={!hasImage}
                className={`group relative overflow-hidden rounded-xl border-2 transition-all text-left ${
                  isSelected
                    ? 'border-electric bg-electric/5 ring-1 ring-electric/30'
                    : hasImage
                      ? 'border-border bg-surface-raised hover:border-border-bright'
                      : 'border-border/50 bg-surface-raised opacity-50 cursor-not-allowed'
                }`}
              >
                {/* Image */}
                <div className="aspect-[3/4] w-full overflow-hidden bg-void">
                  {inf.image_url ? (
                    <img
                      src={inf.image_url}
                      alt={inf.name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-text-muted" stroke="currentColor" strokeWidth={1.5}>
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
                      </svg>
                    </div>
                  )}
                </div>
                {/* Info */}
                <div className="p-2.5">
                  <p className="font-[family-name:var(--font-display)] text-xs font-semibold text-text-primary truncate">
                    {inf.name}
                  </p>
                  {inf.persona && (
                    <p className="mt-0.5 text-[10px] text-text-muted truncate">{inf.persona}</p>
                  )}
                  {!hasImage && (
                    <p className="mt-0.5 text-[10px] text-magenta">No image</p>
                  )}
                </div>
                {/* Selection checkmark */}
                {isSelected && (
                  <div className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-electric">
                    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-void" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3.5 8 6.5 11 12.5 5" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Product Placement Per Segment */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-1 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-text-muted">
          Product Placement
        </h2>
        <p className="mb-4 text-xs text-text-muted">
          Control how the product appears in each segment&apos;s keyframes. Add notes for specific instructions.
        </p>
        <div className="space-y-3">
          {productPlacement.map((seg, i) => {
            const sectionLabels = ['Hook', 'Problem', 'Solution + Product', 'CTA'];
            return (
              <div key={seg.segment} className="rounded-lg border border-border bg-surface-raised p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-overlay font-[family-name:var(--font-mono)] text-[10px] font-bold text-text-muted">
                    {seg.segment + 1}
                  </span>
                  <span className="font-[family-name:var(--font-display)] text-xs font-semibold text-text-primary">
                    {sectionLabels[i]}
                  </span>
                  <select
                    value={seg.visibility}
                    onChange={(e) => {
                      const updated = [...productPlacement];
                      updated[i] = { ...updated[i], visibility: e.target.value };
                      setProductPlacement(updated);
                    }}
                    className="ml-auto appearance-none rounded-md border border-border bg-surface px-2.5 py-1 font-[family-name:var(--font-mono)] text-[11px] text-text-secondary transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
                  >
                    <option value="none">Not visible</option>
                    <option value="subtle">Subtle / Background</option>
                    <option value="hero">Hero shot</option>
                    <option value="set_down">In frame</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={seg.notes}
                  onChange={(e) => {
                    const updated = [...productPlacement];
                    updated[i] = { ...updated[i], notes: e.target.value };
                    setProductPlacement(updated);
                  }}
                  placeholder="Optional: e.g. 'holds bottle at eye level'"
                  className="mt-2 block w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted/60 transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Cost estimate + confirm */}
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-text-muted">
          {selected && (
            <span>
              Selected: <span className="text-text-primary font-medium">{selected.name}</span>
              {' '}&middot;{' '}
              <span className="text-text-muted">Estimated cost: ~$0.56 for keyframes</span>
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!selectedId || confirming}
          className="inline-flex items-center gap-2 rounded-lg bg-lime px-6 py-3 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_32px_rgba(184,255,0,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {confirming ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" strokeLinecap="round" />
              </svg>
              Confirming...
            </>
          ) : (
            <>
              <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3.5 8 6.5 11 12.5 5" />
              </svg>
              Confirm &amp; Generate Keyframes
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-magenta/30 bg-magenta/10 px-4 py-3">
          <p className="text-sm text-magenta">{error}</p>
        </div>
      )}
    </div>
  );
}

/* ==============================
   Failed Recovery Sub-component
   ============================== */

const STAGE_LABELS: Record<string, string> = {
  analyzing: 'Product Analysis',
  scripting: 'Script Generation',
  casting: 'Keyframe Casting',
  directing: 'Video Directing',
  voiceover: 'Voiceover Generation',
  editing: 'Video Composition',
};

const ROLLBACK_LABELS: Record<string, string> = {
  analyzing: 'Start',
  scripting: 'Analysis Review',
  casting: 'Influencer Selection',
  directing: 'Casting Review',
  voiceover: 'Casting Review',
  editing: 'Asset Review',
};

interface FailedRecoveryProps {
  projectId: string;
  errorMessage: string | null;
  failedAtStatus: string | null;
  onRecovered: () => void;
}

function FailedRecovery({ projectId, errorMessage, failedAtStatus, onRecovered }: FailedRecoveryProps) {
  const [retrying, setRetrying] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  const stageLabel = failedAtStatus ? STAGE_LABELS[failedAtStatus] || failedAtStatus : 'Unknown';
  const rollbackLabel = failedAtStatus ? ROLLBACK_LABELS[failedAtStatus] || 'previous stage' : 'previous stage';

  async function handleRetry() {
    setRetrying(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/retry`, { method: 'POST' });
      if (res.ok) onRecovered();
    } catch (err) {
      console.error('Retry failed:', err);
    } finally {
      setRetrying(false);
    }
  }

  async function handleRollback() {
    setRollingBack(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/rollback`, { method: 'POST' });
      if (res.ok) onRecovered();
    } catch (err) {
      console.error('Rollback failed:', err);
    } finally {
      setRollingBack(false);
    }
  }

  return (
    <div className="rounded-xl border border-magenta/30 bg-magenta/5 p-5">
      <div className="flex items-start gap-3">
        <svg
          viewBox="0 0 20 20"
          className="mt-0.5 h-5 w-5 flex-shrink-0 text-magenta"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
        <div className="flex-1">
          <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-magenta">
            Pipeline Failed{failedAtStatus ? ` at ${stageLabel}` : ''}
          </h3>
          {errorMessage && (
            <p className="mt-1 text-sm text-text-secondary">{errorMessage}</p>
          )}

          {failedAtStatus && (
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleRetry}
                disabled={retrying || rollingBack}
                className="inline-flex items-center gap-2 rounded-lg bg-electric px-4 py-2 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_24px_rgba(0,240,255,0.3)] disabled:opacity-50"
              >
                {retrying ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" strokeLinecap="round" />
                    </svg>
                    Retrying...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 2v5h5" />
                      <path d="M3.5 10a5 5 0 109-2.3" />
                    </svg>
                    Retry {stageLabel}
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleRollback}
                disabled={retrying || rollingBack}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 font-[family-name:var(--font-display)] text-sm font-medium text-text-secondary transition-colors hover:border-electric/30 hover:text-electric disabled:opacity-50"
              >
                {rollingBack ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" strokeLinecap="round" />
                    </svg>
                    Rolling back...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 2v5h-5" />
                      <path d="M12.5 10a5 5 0 11-9-2.3" />
                    </svg>
                    Back to {rollbackLabel}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
