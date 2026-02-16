'use client';

import { useState } from 'react';
import { downloadAsset, downloadAllAssets } from '@/lib/download-utils';

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

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadAsset(url, filename);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  }

  const sizeClasses = size === 'sm'
    ? 'h-7 w-7'
    : 'h-8 w-8';
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
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
      ) : (
        <svg viewBox="0 0 16 16" fill="none" className={iconSize} stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M8 2v9M4 7l4 4 4-4M2 13h12" />
        </svg>
      )}
    </button>
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

  async function handleClick() {
    if (downloading || items.length === 0) return;
    setDownloading(true);
    setProgress(0);
    try {
      for (let i = 0; i < items.length; i++) {
        await downloadAsset(items[i].url, items[i].filename);
        setProgress(i + 1);
        if (i < items.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }
    } catch (err) {
      console.error('Download all failed:', err);
    } finally {
      setDownloading(false);
      setProgress(0);
    }
  }

  return (
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
  );
}
