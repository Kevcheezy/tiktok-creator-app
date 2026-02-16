'use client';

import { useState } from 'react';
import { downloadAsset } from '@/lib/download-utils';

// ---- Single-asset download icon button ----

interface DownloadButtonProps {
  url: string;
  filename: string;
  /** Size variant: 'sm' for asset card overlays, 'md' for standalone buttons */
  size?: 'sm' | 'md';
  className?: string;
}

export function DownloadButton({ url, filename, size = 'sm', className }: DownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    setError(null);
    try {
      await downloadAsset(url, filename);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Download failed';
      console.error('Download failed:', err);
      setError(message);
      // Auto-dismiss the error toast after 4 seconds
      setTimeout(() => setError(null), 4000);
    } finally {
      setDownloading(false);
    }
  }

  const sizeClasses = size === 'sm'
    ? 'h-7 w-7'
    : 'h-8 w-8';
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={downloading}
        title={`Download ${filename}`}
        className={`flex items-center justify-center rounded-md bg-void/70 text-text-muted backdrop-blur-sm transition-colors hover:bg-electric/20 hover:text-electric disabled:opacity-50 ${sizeClasses} ${className || ''}`}
      >
        {downloading ? (
          <svg className={`animate-spin ${iconSize}`} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" strokeLinecap="round" />
          </svg>
        ) : error ? (
          <svg viewBox="0 0 16 16" fill="none" className={iconSize} stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <circle cx="8" cy="8" r="6" />
            <path d="M8 5v4" />
            <circle cx="8" cy="11" r="0.5" fill="currentColor" stroke="none" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" fill="none" className={iconSize} stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M8 2v9M4 7l4 4 4-4M2 13h12" />
          </svg>
        )}
      </button>
      {error && (
        <div className="absolute right-0 top-full z-50 mt-1 w-48 animate-fade-in-up rounded-lg border border-magenta/30 bg-void/95 px-3 py-2 backdrop-blur-md">
          <p className="font-[family-name:var(--font-display)] text-[10px] font-semibold text-magenta">
            {error}
          </p>
        </div>
      )}
    </div>
  );
}

// ---- "Download All" button for stages ----

interface DownloadAllButtonProps {
  items: { url: string; filename: string }[];
  label?: string;
  className?: string;
}

export function DownloadAllButton({ items, label, className }: DownloadAllButtonProps) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (downloading || items.length === 0) return;
    setDownloading(true);
    setProgress(0);
    setError(null);
    try {
      for (let i = 0; i < items.length; i++) {
        await downloadAsset(items[i].url, items[i].filename);
        setProgress(i + 1);
        if (i < items.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Download failed';
      console.error('Download all failed:', err);
      setError(`Failed on file ${progress + 1}/${items.length}: ${message}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setDownloading(false);
      setProgress(0);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={downloading || items.length === 0}
        className={`inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 font-[family-name:var(--font-display)] text-xs font-semibold text-text-muted transition-all hover:border-electric/30 hover:text-electric disabled:cursor-not-allowed disabled:opacity-50 ${className || ''}`}
      >
        {downloading ? (
          <>
            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" strokeLinecap="round" />
            </svg>
            <span className="font-[family-name:var(--font-mono)]">{progress}/{items.length}</span>
          </>
        ) : (
          <>
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M8 2v9M4 7l4 4 4-4M2 13h12" />
            </svg>
            {label || `Download All (${items.length})`}
          </>
        )}
      </button>
      {error && (
        <div className="absolute right-0 top-full z-50 mt-1 w-64 animate-fade-in-up rounded-lg border border-magenta/30 bg-void/95 px-3 py-2 backdrop-blur-md">
          <p className="font-[family-name:var(--font-display)] text-[10px] font-semibold text-magenta">
            {error}
          </p>
        </div>
      )}
    </div>
  );
}
