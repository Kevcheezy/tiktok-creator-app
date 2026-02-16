import Link from 'next/link';
import { Nav } from '@/components/nav';
import { InfluencerForm } from '@/components/influencer-form';

export default function NewInfluencerPage() {
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-lg px-6 py-10 lg:px-8">
        <div className="animate-fade-in-up">
          <Link
            href="/influencers"
            className="inline-flex items-center gap-2 font-[family-name:var(--font-display)] text-sm text-text-secondary transition-colors hover:text-electric mb-4"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="8" x2="4" y2="8" />
              <polyline points="8 4 4 8 8 12" />
            </svg>
            Influencers
          </Link>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-text-primary">
            New Influencer
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Create an influencer persona with a reference photo for AI-generated videos.
          </p>
        </div>

        <div className="mt-8 animate-fade-in-up rounded-xl border border-border bg-surface p-6" style={{ animationDelay: '100ms' }}>
          <InfluencerForm />
        </div>
      </main>
    </div>
  );
}
