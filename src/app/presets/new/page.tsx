import { PresetBuilder } from '@/components/preset-builder';

export const dynamic = 'force-dynamic';

export default function NewPresetPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10 lg:px-8">
      <div className="animate-fade-in-up">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-text-primary">
          Analyze Winning Video
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Paste a TikTok video URL to extract its scriptwriting formula and scoring profile
        </p>
      </div>
      <div className="mt-8">
        <PresetBuilder />
      </div>
    </main>
  );
}
