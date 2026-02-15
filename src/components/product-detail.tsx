'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from './confirm-dialog';

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
  overrides: Record<string, boolean> | null;
  status: string;
  error_message: string | null;
  cost_usd: string | null;
  project_count: number;
  created_at: string | null;
  updated_at: string | null;
}

const CATEGORIES = ['supplements', 'skincare', 'fitness', 'tech', 'kitchen', 'fashion', 'home', 'food', 'beauty', 'pets', 'baby', 'outdoor', 'automotive', 'other'];

export function ProductDetail({ productId }: { productId: string }) {
  const router = useRouter();
  const [product, setProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [reanalyzing, setReanalyzing] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);

  const fetchProduct = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${productId}`);
      if (res.ok) {
        setProduct(await res.json());
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  // Poll while analyzing
  useEffect(() => {
    if (product?.status !== 'analyzing') return;
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
      } else {
        const data = await res.json();
        setDeleteError(data.error || 'Failed to delete');
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleReanalyze() {
    setReanalyzing(true);
    try {
      const res = await fetch(`/api/products/${productId}/reanalyze`, { method: 'POST' });
      if (res.ok) fetchProduct();
    } finally {
      setReanalyzing(false);
    }
  }

  async function saveField(field: string, value: unknown) {
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        setProduct(await res.json());
      }
    } finally {
      setSaving(false);
      setEditingField(null);
    }
  }

  async function resetField(field: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: [field] }),
      });
      if (res.ok) {
        setProduct(await res.json());
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`/api/products/${productId}/image`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) fetchProduct();
    } finally {
      setImageUploading(false);
      e.target.value = '';
    }
  }

  function startEdit(field: string, currentValue: string) {
    setEditingField(field);
    setEditValue(currentValue);
  }

  function handleEditSubmit(field: string) {
    if (editValue.trim() !== '') {
      saveField(field, editValue.trim());
    } else {
      setEditingField(null);
    }
  }

  const isOverridden = (field: string) => !!product?.overrides?.[field];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-electric" />
            <div className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-b-magenta" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          </div>
          <p className="font-[family-name:var(--font-display)] text-sm text-text-muted">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="rounded-xl border border-border bg-surface p-12 text-center">
        <p className="text-text-secondary">Product not found.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* Back link */}
      <button onClick={() => router.push('/products')} className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-electric">
        <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 3L5 8l5 5" />
        </svg>
        Products
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-text-primary">
            {product.name || 'Untitled Product'}
          </h1>
          <p className="mt-1 truncate font-[family-name:var(--font-mono)] text-xs text-text-muted">
            {product.url}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          <StatusBadge status={product.status} />
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

      {/* Analyzing spinner */}
      {product.status === 'analyzing' && (
        <div className="rounded-xl border border-electric/20 bg-electric/5 p-6">
          <div className="flex items-center gap-4">
            <div className="relative h-8 w-8 flex-shrink-0">
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-electric" />
              <div className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-b-electric-dim" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-electric">Analyzing Product</h3>
              <p className="mt-0.5 text-sm text-text-secondary">Extracting product data. This typically takes 10-30 seconds.</p>
            </div>
          </div>
        </div>
      )}

      {/* Failed state */}
      {product.status === 'failed' && (
        <div className="rounded-xl border border-magenta/30 bg-magenta/5 p-5">
          <div className="flex items-start gap-3">
            <svg viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 flex-shrink-0 text-magenta" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-medium text-magenta">Analysis failed</p>
              {product.error_message && <p className="mt-1 text-sm text-text-secondary">{product.error_message}</p>}
              <button
                onClick={handleReanalyze}
                disabled={reanalyzing}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-electric px-4 py-2 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_24px_rgba(0,240,255,0.3)] disabled:opacity-50"
              >
                {reanalyzing ? 'Re-analyzing...' : 'Retry Analysis'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Image + Actions */}
      <div className="flex gap-6">
        <div className="relative h-40 w-40 flex-shrink-0 overflow-hidden rounded-xl border border-border bg-surface-raised">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt={product.name || 'Product'} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10 text-text-muted" stroke="currentColor" strokeWidth={1.5}>
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-electric/30 hover:text-electric">
            {imageUploading ? 'Uploading...' : product.image_url ? 'Replace Image' : 'Upload Image'}
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={imageUploading} />
          </label>
          {product.status === 'analyzed' && (
            <button
              onClick={handleReanalyze}
              disabled={reanalyzing}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-electric/30 hover:text-electric disabled:opacity-50"
            >
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 2v5h5" />
                <path d="M3.5 10a5 5 0 109-2.3" />
              </svg>
              {reanalyzing ? 'Re-analyzing...' : 'Re-analyze'}
            </button>
          )}
          <div className="mt-auto space-y-1">
            <p className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
              {product.project_count} project{product.project_count !== 1 ? 's' : ''} using this product
            </p>
            {product.cost_usd && (
              <p className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
                Analysis cost: ${parseFloat(product.cost_usd).toFixed(4)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Analysis Results (only when analyzed) */}
      {product.status === 'analyzed' && (
        <div className="space-y-5">
          {/* Basic info grid */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-text-muted">
              Product Info
            </h2>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <EditableField label="Name" field="name" value={product.name} overridden={isOverridden('name')} editing={editingField} editValue={editValue} saving={saving} onEdit={startEdit} onSave={handleEditSubmit} onReset={resetField} onChange={setEditValue} onCancel={() => setEditingField(null)} />
              <EditableField label="Brand" field="brand" value={product.brand} overridden={isOverridden('brand')} editing={editingField} editValue={editValue} saving={saving} onEdit={startEdit} onSave={handleEditSubmit} onReset={resetField} onChange={setEditValue} onCancel={() => setEditingField(null)} />
              <EditableCategoryField value={product.category} overridden={isOverridden('category')} onSave={(v) => saveField('category', v)} onReset={() => resetField('category')} />
              {product.product_type && <InfoField label="Type" value={product.product_type} />}
              {product.product_size && <InfoField label="Size" value={product.product_size} />}
              {product.product_price && <InfoField label="Price" value={product.product_price} />}
            </dl>
          </div>

          {/* Lists */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <EditableListSection label="Selling Points" field="selling_points" items={product.selling_points} overridden={isOverridden('selling_points')} color="magenta" onSave={(items) => saveField('selling_points', items)} onReset={() => resetField('selling_points')} />
            <EditableListSection label="Key Claims" field="key_claims" items={product.key_claims} overridden={isOverridden('key_claims')} color="lime" onSave={(items) => saveField('key_claims', items)} onReset={() => resetField('key_claims')} />
            <EditableListSection label="Benefits" field="benefits" items={product.benefits} overridden={isOverridden('benefits')} color="amber-hot" onSave={(items) => saveField('benefits', items)} onReset={() => resetField('benefits')} />
          </div>

          {/* Text fields */}
          <EditableTextSection label="Usage" field="usage" value={product.usage} overridden={isOverridden('usage')} onSave={(v) => saveField('usage', v)} onReset={() => resetField('usage')} />
          <EditableTextSection label="Hook Angle" field="hook_angle" value={product.hook_angle} overridden={isOverridden('hook_angle')} onSave={(v) => saveField('hook_angle', v)} onReset={() => resetField('hook_angle')} />
          <EditableTextSection label="Avatar Description" field="avatar_description" value={product.avatar_description} overridden={isOverridden('avatar_description')} onSave={(v) => saveField('avatar_description', v)} onReset={() => resetField('avatar_description')} />
        </div>
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Product"
        description={deleteError || `Are you sure you want to delete "${product.name || 'this product'}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => { setShowDeleteConfirm(false); setDeleteError(''); }}
        loading={deleting}
      />
    </div>
  );
}

/* ============================== Sub-components ============================== */

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    analyzed: 'bg-lime/10 text-lime border-lime/20',
    analyzing: 'bg-electric/10 text-electric border-electric/20',
    created: 'bg-surface-overlay text-text-muted border-border',
    failed: 'bg-magenta/10 text-magenta border-magenta/20',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-[family-name:var(--font-mono)] text-xs font-medium ${styles[status] || styles.created}`}>
      {status === 'analyzing' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {status}
    </span>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-text-primary">{value}</dd>
    </div>
  );
}

function OverrideBadge({ onReset }: { onReset: () => void }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="rounded bg-amber-hot/10 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[9px] font-semibold uppercase text-amber-hot">
        Edited
      </span>
      <button onClick={onReset} className="text-[10px] text-text-muted hover:text-electric transition-colors" title="Reset to original">
        Reset
      </button>
    </span>
  );
}

interface EditableFieldProps {
  label: string;
  field: string;
  value: string | null;
  overridden: boolean;
  editing: string | null;
  editValue: string;
  saving: boolean;
  onEdit: (field: string, value: string) => void;
  onSave: (field: string) => void;
  onReset: (field: string) => void;
  onChange: (value: string) => void;
  onCancel: () => void;
}

function EditableField({ label, field, value, overridden, editing, editValue, saving, onEdit, onSave, onReset, onChange, onCancel }: EditableFieldProps) {
  const isEditing = editing === field;

  return (
    <div>
      <dt className="flex items-center gap-2 font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
        {label}
        {overridden && <OverrideBadge onReset={() => onReset(field)} />}
      </dt>
      {isEditing ? (
        <dd className="mt-1 flex items-center gap-1">
          <input
            type="text"
            value={editValue}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSave(field); if (e.key === 'Escape') onCancel(); }}
            autoFocus
            className="flex-1 rounded border border-electric bg-surface px-2 py-1 text-sm text-text-primary focus:outline-none"
          />
          <button onClick={() => onSave(field)} disabled={saving} className="rounded p-1 text-lime hover:bg-lime/10">
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={2}><polyline points="3.5 8 6.5 11 12.5 5" /></svg>
          </button>
          <button onClick={onCancel} className="rounded p-1 text-text-muted hover:bg-surface-overlay">
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={2}><path d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        </dd>
      ) : (
        <dd
          className="mt-1 cursor-pointer rounded px-1 py-0.5 text-sm text-text-primary transition-colors hover:bg-surface-overlay -mx-1"
          onClick={() => onEdit(field, value || '')}
          title="Click to edit"
        >
          {value || <span className="text-text-muted italic">Not set</span>}
        </dd>
      )}
    </div>
  );
}

function EditableCategoryField({ value, overridden, onSave, onReset }: { value: string | null; overridden: boolean; onSave: (v: string) => void; onReset: () => void }) {
  return (
    <div>
      <dt className="flex items-center gap-2 font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
        Category
        {overridden && <OverrideBadge onReset={onReset} />}
      </dt>
      <dd className="mt-1">
        <select
          value={value || ''}
          onChange={(e) => onSave(e.target.value)}
          className="appearance-none rounded-md border border-border bg-surface px-2 py-1 font-[family-name:var(--font-mono)] text-xs text-electric transition-all focus:border-electric focus:outline-none"
        >
          <option value="">Select...</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </dd>
    </div>
  );
}

interface EditableListSectionProps {
  label: string;
  field: string;
  items: string[] | null;
  overridden: boolean;
  color: string;
  onSave: (items: string[]) => void;
  onReset: () => void;
}

function EditableListSection({ label, field: _field, items, overridden, color, onSave, onReset }: EditableListSectionProps) {
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState('');

  if (!items || items.length === 0) return null;

  const dotColor = color === 'magenta' ? 'bg-magenta' : color === 'lime' ? 'bg-lime' : 'bg-amber-hot';

  function handleAdd() {
    if (newItem.trim()) {
      onSave([...(items || []), newItem.trim()]);
      setNewItem('');
      setAdding(false);
    }
  }

  function handleRemove(index: number) {
    const updated = [...(items || [])];
    updated.splice(index, 1);
    onSave(updated);
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
          {label}
          {overridden && <OverrideBadge onReset={onReset} />}
        </h3>
        <button
          onClick={() => setAdding(!adding)}
          className="rounded p-1 text-text-muted transition-colors hover:text-electric"
          title="Add item"
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <line x1="8" y1="3" x2="8" y2="13" />
            <line x1="3" y1="8" x2="13" y2="8" />
          </svg>
        </button>
      </div>
      {adding && (
        <div className="mb-3 flex items-center gap-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
            autoFocus
            placeholder="New item..."
            className="flex-1 rounded border border-electric bg-surface px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <button onClick={handleAdd} className="rounded px-2 py-1.5 text-xs font-medium text-lime hover:bg-lime/10">Add</button>
        </div>
      )}
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="group flex items-start gap-2.5 text-sm text-text-secondary">
            <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${dotColor}`} />
            <span className="flex-1">{item}</span>
            <button
              onClick={() => handleRemove(i)}
              className="rounded p-0.5 text-text-muted opacity-0 transition-all hover:text-magenta group-hover:opacity-100"
              title="Remove"
            >
              <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={2}><path d="M4 4l8 8M12 4l-8 8" /></svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface EditableTextSectionProps {
  label: string;
  field: string;
  value: string | null;
  overridden: boolean;
  onSave: (v: string) => void;
  onReset: () => void;
}

function EditableTextSection({ label, field: _field, value, overridden, onSave, onReset }: EditableTextSectionProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');

  if (!value && !editing) return null;

  function handleSave() {
    onSave(editValue.trim());
    setEditing(false);
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
          {label}
          {overridden && <OverrideBadge onReset={onReset} />}
        </h3>
        {!editing && (
          <button onClick={() => { setEditValue(value || ''); setEditing(true); }} className="rounded p-1 text-text-muted transition-colors hover:text-electric" title="Edit">
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" />
            </svg>
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            rows={3}
            autoFocus
            className="w-full rounded border border-electric bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none"
          />
          <div className="flex gap-2">
            <button onClick={handleSave} className="rounded px-3 py-1 text-xs font-medium text-lime hover:bg-lime/10">Save</button>
            <button onClick={() => setEditing(false)} className="rounded px-3 py-1 text-xs font-medium text-text-muted hover:bg-surface-overlay">Cancel</button>
          </div>
        </div>
      ) : (
        <p className="cursor-pointer rounded px-1 py-0.5 text-sm leading-relaxed text-text-secondary transition-colors hover:bg-surface-overlay -mx-1" onClick={() => { setEditValue(value || ''); setEditing(true); }}>
          {value}
        </p>
      )}
    </div>
  );
}
