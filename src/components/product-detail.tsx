'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StatusBadge } from './status-badge';
import { ConfirmDialog } from './confirm-dialog';
import { uploadToStorage } from './direct-upload';

interface ProductData {
  id: string;
  url: string;
  name: string | null;
  brand: string | null;
  category: string | null;
  product_type: string | null;
  product_size: string | null;
  product_price: string | null;
  selling_points: string[] | null;
  key_claims: string[] | null;
  benefits: string[] | null;
  usage: string | null;
  hook_angle: string | null;
  avatar_description: string | null;
  image_description: string | null;
  image_url: string | null;
  analysis_data: Record<string, unknown> | null;
  overrides: Record<string, boolean> | null;
  status: string;
  error_message: string | null;
  cost_usd: string | null;
  created_at: string;
  updated_at: string;
  projects: Array<{
    id: string;
    name: string | null;
    product_name: string | null;
    status: string;
    created_at: string;
  }>;
}

const CATEGORIES = [
  'beauty',
  'fitness',
  'supplements',
  'tech',
  'home',
  'fashion',
  'food',
  'baby',
  'pets',
  'other',
];

const STATUS_MAP: Record<string, string> = {
  analyzed: 'completed',
  analyzing: 'analyzing',
  failed: 'failed',
  created: 'created',
};

function formatDate(date: string | null): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ProductDetail({ productId }: { productId: string }) {
  const router = useRouter();
  const [product, setProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  // Image upload state
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Inline edit state for text/textarea fields
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  // Inline edit state for array fields
  const [editArrays, setEditArrays] = useState<Record<string, string[]>>({});

  const fetchProduct = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${productId}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      setProduct(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  // Sync edit values when product changes or edit mode toggles
  useEffect(() => {
    if (!product) return;
    setEditValues({
      name: product.name || '',
      brand: product.brand || '',
      product_type: product.product_type || '',
      product_size: product.product_size || '',
      product_price: product.product_price || '',
      category: product.category || '',
      usage: product.usage || '',
      hook_angle: product.hook_angle || '',
      avatar_description: product.avatar_description || '',
      image_description: product.image_description || '',
    });
    setEditArrays({
      selling_points: product.selling_points || [],
      key_claims: product.key_claims || [],
      benefits: product.benefits || [],
    });
  }, [product]);

  // Poll while analyzing
  useEffect(() => {
    if (!product) return;
    if (product.status !== 'analyzing') return;
    const interval = setInterval(fetchProduct, 3000);
    return () => clearInterval(interval);
  }, [product?.status, fetchProduct]);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/products');
      } else if (res.status === 409) {
        const data = await res.json();
        setDeleteError(data.error || 'This product is referenced by projects and cannot be deleted.');
        setDeleting(false);
      } else {
        setDeleteError('Failed to delete product.');
        setDeleting(false);
      }
    } catch {
      setDeleteError('Failed to delete product.');
      setDeleting(false);
    }
  }

  async function handleSaveField(field: string, value: string) {
    setSaving(field);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProduct(updated);
      }
    } catch (err) {
      console.error('Failed to save field:', err);
    } finally {
      setSaving(null);
    }
  }

  async function handleSaveArray(field: string, value: string[]) {
    setSaving(field);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProduct(updated);
      }
    } catch (err) {
      console.error('Failed to save array:', err);
    } finally {
      setSaving(null);
    }
  }

  async function handleReset(field: string) {
    setSaving(field);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: [field] }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProduct(updated);
      }
    } catch (err) {
      console.error('Failed to reset field:', err);
    } finally {
      setSaving(null);
    }
  }

  async function handleReanalyze() {
    setReanalyzing(true);
    try {
      await fetch(`/api/products/${productId}/reanalyze`, { method: 'POST' });
      fetchProduct();
    } catch (err) {
      console.error('Failed to re-analyze:', err);
    } finally {
      setReanalyzing(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError('');

    try {
      // Upload directly to storage
      const { path } = await uploadToStorage(file, 'product', productId);

      // Update product record with storage path
      const res = await fetch(`/api/products/${productId}/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath: path }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      setImageError(false);
      fetchProduct();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-electric" />
            <div
              className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-b-magenta"
              style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
            />
          </div>
          <p className="font-[family-name:var(--font-display)] text-sm text-text-muted">Loading product...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="animate-fade-in-up">
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-raised">
            <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-text-muted" stroke="currentColor" strokeWidth={1.5}>
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <p className="mt-4 text-text-secondary">Product not found.</p>
          <Link href="/products" className="mt-4 inline-flex text-sm text-electric hover:underline">
            Back to Products
          </Link>
        </div>
      </div>
    );
  }

  const mappedStatus = STATUS_MAP[product.status] || product.status;
  const hasValidImage = !!product.image_url && !imageError;

  const textFields: Array<{
    key: string;
    label: string;
    multiline?: boolean;
  }> = [
    { key: 'name', label: 'Product Name' },
    { key: 'brand', label: 'Brand' },
    { key: 'product_type', label: 'Type' },
    { key: 'product_size', label: 'Size' },
    { key: 'product_price', label: 'Price' },
    { key: 'usage', label: 'Usage', multiline: true },
    { key: 'hook_angle', label: 'Hook Angle', multiline: true },
    { key: 'avatar_description', label: 'Avatar Description', multiline: true },
    { key: 'image_description', label: 'Image Description', multiline: true },
  ];

  const arrayFields: Array<{
    key: string;
    label: string;
    dotColor: string;
  }> = [
    { key: 'selling_points', label: 'Selling Points', dotColor: 'bg-magenta' },
    { key: 'key_claims', label: 'Key Claims', dotColor: 'bg-lime' },
    { key: 'benefits', label: 'Benefits', dotColor: 'bg-amber-hot' },
  ];

  return (
    <div className="animate-fade-in-up space-y-8">
      {/* Back link */}
      <Link
        href="/products"
        className="inline-flex items-center gap-2 font-[family-name:var(--font-display)] text-sm text-text-secondary transition-colors hover:text-electric"
      >
        <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="8" x2="4" y2="8" />
          <polyline points="8 4 4 8 8 12" />
        </svg>
        Products
      </Link>

      {/* ========== A. Header ========== */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-text-primary">
            {product.name || 'Untitled Product'}
          </h1>
          {product.brand && (
            <p className="mt-1 font-[family-name:var(--font-display)] text-sm text-text-secondary">
              {product.brand}
            </p>
          )}
          <a
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block truncate font-[family-name:var(--font-mono)] text-xs text-text-muted hover:text-electric transition-colors"
          >
            {product.url}
          </a>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          <StatusBadge status={mappedStatus} />
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-lg border border-border p-2.5 text-text-muted transition-all hover:border-magenta/40 hover:bg-magenta/5 hover:text-magenta"
            title="Delete product"
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

      {/* Delete error */}
      {deleteError && (
        <div className="rounded-lg border border-magenta/30 bg-magenta/10 px-4 py-3">
          <p className="text-sm text-magenta">{deleteError}</p>
        </div>
      )}

      {/* Error message for failed products */}
      {product.status === 'failed' && product.error_message && (
        <div className="rounded-xl border border-magenta/30 bg-magenta/5 p-5">
          <div className="flex items-start gap-3">
            <svg viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 flex-shrink-0 text-magenta" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-magenta">
                Analysis Failed
              </h3>
              <p className="mt-1 text-sm text-text-secondary">{product.error_message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Analyzing indicator */}
      {product.status === 'analyzing' && (
        <div className="rounded-xl border border-electric/20 bg-electric/5 p-6">
          <div className="flex items-center gap-4">
            <div className="relative h-8 w-8 flex-shrink-0">
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-electric" />
              <div className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-b-electric" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-electric">
                Analyzing Product
              </h3>
              <p className="mt-0.5 text-sm text-text-secondary">
                Extracting product data and generating content strategy. This typically takes 10-30 seconds.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========== B. Product Image Section ========== */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
          Product Image
        </h2>

        {hasValidImage ? (
          <div className="flex items-start gap-5">
            <div className="relative h-32 w-32 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-void">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.image_url!}
                alt="Product"
                className="h-full w-full object-contain"
                onError={() => setImageError(true)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm text-text-secondary">Product image.</p>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-electric/30 hover:text-electric">
                {uploading ? 'Uploading...' : 'Replace Image'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
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
              {product.image_url && imageError
                ? 'The product image could not be loaded. Please upload a new one.'
                : 'No product image found. Upload one to improve video generation.'}
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
                onChange={handleImageUpload}
                disabled={uploading}
              />
            </label>
          </div>
        )}

        {uploadError && (
          <p className="mt-2 text-sm text-magenta">{uploadError}</p>
        )}
      </div>

      {/* ========== C. Analysis Results with Inline Editing ========== */}
      {product.status === 'analyzed' && (
        <div className="space-y-5">
          {/* Edit mode toggle */}
          <div className="flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-text-muted">
              Analysis Results
            </h2>
            <button
              type="button"
              onClick={() => setEditMode(!editMode)}
              className={`rounded-lg px-4 py-2 font-[family-name:var(--font-display)] text-sm font-medium transition-all ${
                editMode
                  ? 'bg-electric px-4 py-2.5 font-semibold text-void'
                  : 'border border-border text-text-secondary hover:text-electric hover:border-electric/30'
              }`}
            >
              {editMode ? 'Done Editing' : 'Edit Mode'}
            </button>
          </div>

          {/* Category field */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
                Category
              </h3>
              <EditedBadge field="category" overrides={product.overrides} />
              {product.overrides?.category && (
                <ResetButton field="category" saving={saving} onReset={handleReset} />
              )}
            </div>
            {editMode ? (
              <select
                value={editValues.category || ''}
                onChange={(e) => {
                  setEditValues((v) => ({ ...v, category: e.target.value }));
                  handleSaveField('category', e.target.value);
                }}
                className="appearance-none rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text-primary transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
              >
                <option value="">Select category...</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            ) : (
              product.category ? (
                <span className="inline-flex rounded-md bg-electric/10 px-2 py-0.5 font-[family-name:var(--font-mono)] text-xs text-electric">
                  {product.category}
                </span>
              ) : (
                <span className="text-sm text-text-muted italic">Not set</span>
              )
            )}
          </div>

          {/* Text fields */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-4 font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
              Product Details
            </h3>
            <div className="space-y-5">
              {textFields.map((field) => (
                <div key={field.key}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <label className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                      {field.label}
                    </label>
                    <EditedBadge field={field.key} overrides={product.overrides} />
                    {product.overrides?.[field.key] && (
                      <ResetButton field={field.key} saving={saving} onReset={handleReset} />
                    )}
                    {saving === field.key && (
                      <span className="font-[family-name:var(--font-mono)] text-[10px] text-electric">Saving...</span>
                    )}
                  </div>
                  {editMode ? (
                    field.multiline ? (
                      <textarea
                        value={editValues[field.key] || ''}
                        onChange={(e) => setEditValues((v) => ({ ...v, [field.key]: e.target.value }))}
                        onBlur={() => handleSaveField(field.key, editValues[field.key] || '')}
                        rows={3}
                        className="w-full rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text-primary transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric resize-none"
                      />
                    ) : (
                      <input
                        type="text"
                        value={editValues[field.key] || ''}
                        onChange={(e) => setEditValues((v) => ({ ...v, [field.key]: e.target.value }))}
                        onBlur={() => handleSaveField(field.key, editValues[field.key] || '')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveField(field.key, editValues[field.key] || '');
                          }
                        }}
                        className="w-full rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text-primary transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
                      />
                    )
                  ) : (
                    <p className="text-sm leading-relaxed text-text-secondary">
                      {(product as unknown as Record<string, string>)[field.key] || <span className="italic text-text-muted">Not set</span>}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Array fields */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {arrayFields.map((field) => {
              const items = editMode
                ? (editArrays[field.key] || [])
                : ((product as unknown as Record<string, string[] | null>)[field.key] || []);

              return (
                <div key={field.key} className="rounded-xl border border-border bg-surface p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
                      {field.label}
                    </h3>
                    <EditedBadge field={field.key} overrides={product.overrides} />
                    {product.overrides?.[field.key] && (
                      <ResetButton field={field.key} saving={saving} onReset={handleReset} />
                    )}
                    {saving === field.key && (
                      <span className="font-[family-name:var(--font-mono)] text-[10px] text-electric">Saving...</span>
                    )}
                  </div>

                  {editMode ? (
                    <div className="space-y-2">
                      {(editArrays[field.key] || []).map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className={`mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${field.dotColor}`} />
                          <input
                            type="text"
                            value={item}
                            onChange={(e) => {
                              const updated = [...(editArrays[field.key] || [])];
                              updated[i] = e.target.value;
                              setEditArrays((v) => ({ ...v, [field.key]: updated }));
                            }}
                            onBlur={() => handleSaveArray(field.key, editArrays[field.key] || [])}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveArray(field.key, editArrays[field.key] || []);
                              }
                            }}
                            className="flex-1 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (editArrays[field.key] || []).filter((_, idx) => idx !== i);
                              setEditArrays((v) => ({ ...v, [field.key]: updated }));
                              handleSaveArray(field.key, updated);
                            }}
                            className="rounded p-1 text-text-muted transition-colors hover:text-magenta"
                          >
                            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                              <line x1="4" y1="4" x2="12" y2="12" />
                              <line x1="12" y1="4" x2="4" y2="12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...(editArrays[field.key] || []), ''];
                          setEditArrays((v) => ({ ...v, [field.key]: updated }));
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 font-[family-name:var(--font-display)] text-xs font-medium text-text-muted transition-colors hover:border-electric/30 hover:text-electric"
                      >
                        <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                          <line x1="8" y1="3" x2="8" y2="13" />
                          <line x1="3" y1="8" x2="13" y2="8" />
                        </svg>
                        Add item
                      </button>
                    </div>
                  ) : (
                    items.length > 0 ? (
                      <ul className="space-y-2">
                        {items.map((item, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
                            <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${field.dotColor}`} />
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm italic text-text-muted">None</p>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========== D. Projects Using This Product ========== */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
            Projects Using This Product
          </h2>
          <Link
            href={`/projects/new?productId=${product.id}`}
            className="inline-flex items-center gap-2 rounded-lg bg-electric px-4 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:bg-electric/90 hover:shadow-[0_0_24px_rgba(0,240,255,0.3)]"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <line x1="8" y1="3" x2="8" y2="13" />
              <line x1="3" y1="8" x2="13" y2="8" />
            </svg>
            Create New Video
          </Link>
        </div>

        {product.projects.length > 0 ? (
          <div className="space-y-3">
            {product.projects.map((proj) => (
              <Link
                key={proj.id}
                href={`/projects/${proj.id}`}
                className="flex items-center justify-between rounded-lg border border-border bg-surface-raised px-4 py-3 transition-all hover:border-electric/30 hover:bg-surface-overlay"
              >
                <div className="min-w-0">
                  <p className="font-[family-name:var(--font-display)] text-sm font-medium text-text-primary truncate">
                    {proj.name || proj.product_name || 'Untitled Project'}
                  </p>
                  <p className="mt-0.5 font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
                    {formatDate(proj.created_at)}
                  </p>
                </div>
                <StatusBadge status={proj.status} />
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">No projects yet</p>
        )}
      </div>

      {/* ========== E. Actions ========== */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
          Actions
        </h2>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleReanalyze}
            disabled={reanalyzing || product.status === 'analyzing'}
            className="inline-flex items-center gap-2 rounded-lg bg-electric px-4 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:bg-electric/90 hover:shadow-[0_0_24px_rgba(0,240,255,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {reanalyzing ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" strokeLinecap="round" />
                </svg>
                Re-analyzing...
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 2v5h5" />
                  <path d="M3.5 10a5 5 0 109-2.3" />
                </svg>
                Re-analyze
              </>
            )}
          </button>

          {product.cost_usd && parseFloat(product.cost_usd) > 0 && (
            <span className="font-[family-name:var(--font-mono)] text-sm text-text-muted">
              Cost: <span className="text-electric font-medium">${parseFloat(product.cost_usd).toFixed(4)}</span>
            </span>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
          Details
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              ID
            </dt>
            <dd className="mt-1 font-[family-name:var(--font-mono)] text-xs text-text-secondary">
              {product.id}
            </dd>
          </div>
          <div>
            <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Status
            </dt>
            <dd className="mt-1 text-sm text-text-primary">{product.status}</dd>
          </div>
          <div>
            <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Created
            </dt>
            <dd className="mt-1 text-sm text-text-secondary">
              {formatDate(product.created_at)}
            </dd>
          </div>
          {product.updated_at && (
            <div>
              <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Updated
              </dt>
              <dd className="mt-1 text-sm text-text-secondary">
                {formatDate(product.updated_at)}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Product"
        description={`Are you sure you want to delete "${product.name || 'this product'}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setDeleteError('');
        }}
        loading={deleting}
      />
    </div>
  );
}

/* ==============================
   Edited Badge Sub-component
   ============================== */

function EditedBadge({ field, overrides }: { field: string; overrides: Record<string, boolean> | null }) {
  if (!overrides?.[field]) return null;
  return (
    <span className="rounded-full bg-amber-hot/10 px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] text-amber-hot border border-amber-hot/20">
      Edited
    </span>
  );
}

/* ==============================
   Reset Button Sub-component
   ============================== */

function ResetButton({
  field,
  saving,
  onReset,
}: {
  field: string;
  saving: string | null;
  onReset: (field: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onReset(field)}
      disabled={saving === field}
      className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted hover:text-electric transition-colors disabled:opacity-50"
    >
      {saving === field ? 'Resetting...' : 'Reset to original'}
    </button>
  );
}
