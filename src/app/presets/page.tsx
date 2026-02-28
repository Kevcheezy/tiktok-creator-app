import Link from 'next/link';
import { PresetList } from '@/components/preset-list';

export const dynamic = 'force-dynamic';

export default function PresetsPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
      <div className="animate-fade-in-up flex items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-text-primary">
            Style Presets
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Analyze winning TikTok videos to extract their scriptwriting formula
          </p>
        </div>
        <Link
          href="/presets/new"
          className="inline-flex items-center gap-2 rounded-lg bg-electric px-5 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_24px_rgba(0,240,255,0.3)]"
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" /></svg>
          New Preset
        </Link>
      </div>
      <div className="mt-8">
        <PresetList />
      </div>
    </main>
  );
}
