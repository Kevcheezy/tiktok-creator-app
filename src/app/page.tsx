import Link from 'next/link';
import { QuestBoard } from '@/components/quest-board';
import { supabase } from '@/db';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { data: projects } = await supabase
    .from('project')
    .select('*, character:ai_character(*)')
    .order('created_at', { ascending: false });

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-10 lg:px-8">
        {/* Page header */}
        <div className="animate-fade-in-up flex items-end justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-text-primary">
              Projects
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              {projects && projects.length > 0
                ? `${projects.length} project${projects.length === 1 ? '' : 's'} in your workspace`
                : 'Your AI video production workspace'}
            </p>
          </div>
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 rounded-lg bg-electric px-5 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_24px_rgba(0,240,255,0.3)]"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              className="h-4 w-4"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <line x1="8" y1="3" x2="8" y2="13" />
              <line x1="3" y1="8" x2="13" y2="8" />
            </svg>
            New Project
          </Link>
        </div>

        {/* Project grid */}
        <div className="mt-8">
          <QuestBoard projects={projects || []} />
        </div>
    </main>
  );
}
