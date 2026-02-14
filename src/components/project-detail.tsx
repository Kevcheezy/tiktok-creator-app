'use client';

import { useState, useEffect, useCallback } from 'react';
import { StatusBadge } from './status-badge';

interface ProjectData {
  id: string;
  name: string | null;
  status: string;
  productUrl: string;
  productName: string | null;
  productCategory: string | null;
  productData: {
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
  costUsd: string | null;
  errorMessage: string | null;
  createdAt: string | null;
  character: { name: string; avatarPersona: string | null } | null;
}

export function ProjectDetail({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);

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

  // Poll while status is a processing state
  useEffect(() => {
    if (!project) return;
    const processingStatuses = ['created', 'analyzing', 'scripting', 'casting', 'directing', 'editing'];
    if (!processingStatuses.includes(project.status)) return;

    const interval = setInterval(fetchProject, 2000);
    return () => clearInterval(interval);
  }, [project?.status, fetchProject]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600" />
      </div>
    );
  }

  if (!project) {
    return <p className="text-gray-500">Project not found.</p>;
  }

  const data = project.productData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {project.productName || project.name || 'Untitled Project'}
          </h1>
          <p className="mt-1 text-sm text-gray-500 break-all">{project.productUrl}</p>
        </div>
        <StatusBadge status={project.status} />
      </div>

      {/* Error message */}
      {project.status === 'failed' && project.errorMessage && (
        <div className="rounded-md bg-red-50 p-4">
          <h3 className="text-sm font-medium text-red-800">Analysis Failed</h3>
          <p className="mt-1 text-sm text-red-700">{project.errorMessage}</p>
        </div>
      )}

      {/* Processing indicator */}
      {project.status === 'analyzing' && (
        <div className="rounded-md bg-amber-50 p-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-300 border-t-amber-600" />
            <p className="text-sm text-amber-700">Analyzing product... This typically takes 10-30 seconds.</p>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {data && project.status === 'completed' && (
        <div className="space-y-6">
          {/* Product Info */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">Product Analysis</h2>
            <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {data.brand && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Brand</dt>
                  <dd className="mt-1 text-sm text-gray-900">{data.brand}</dd>
                </div>
              )}
              {data.product_type && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Type</dt>
                  <dd className="mt-1 text-sm text-gray-900">{data.product_type}</dd>
                </div>
              )}
              {data.product_size && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Size</dt>
                  <dd className="mt-1 text-sm text-gray-900">{data.product_size}</dd>
                </div>
              )}
              {data.product_price && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Price</dt>
                  <dd className="mt-1 text-sm text-gray-900">{data.product_price}</dd>
                </div>
              )}
              {data.category && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Category</dt>
                  <dd className="mt-1">
                    <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
                      {data.category}
                    </span>
                  </dd>
                </div>
              )}
              {project.costUsd && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Cost</dt>
                  <dd className="mt-1 text-sm text-gray-900">${parseFloat(project.costUsd).toFixed(4)}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Lists */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {data.selling_points && data.selling_points.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h3 className="text-sm font-semibold text-gray-900">Selling Points</h3>
                <ul className="mt-3 space-y-2">
                  {data.selling_points.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.key_claims && data.key_claims.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h3 className="text-sm font-semibold text-gray-900">Key Claims</h3>
                <ul className="mt-3 space-y-2">
                  {data.key_claims.map((claim, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500" />
                      {claim}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.benefits && data.benefits.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h3 className="text-sm font-semibold text-gray-900">Benefits</h3>
                <ul className="mt-3 space-y-2">
                  {data.benefits.map((benefit, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.usage && (
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h3 className="text-sm font-semibold text-gray-900">Usage</h3>
                <p className="mt-2 text-sm text-gray-700">{data.usage}</p>
              </div>
            )}
          </div>

          {/* Hook Angle */}
          {data.hook_angle && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-gray-900">Hook Angle</h3>
              <p className="mt-2 text-sm text-gray-700">{data.hook_angle}</p>
            </div>
          )}

          {/* Avatar Description */}
          {data.avatar_description && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-gray-900">Avatar Description</h3>
              <p className="mt-2 text-sm text-gray-700">{data.avatar_description}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
