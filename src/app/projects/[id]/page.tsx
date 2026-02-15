import Link from 'next/link';
import { Nav } from '@/components/nav';
import { ProjectDetail } from '@/components/project-detail';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-5xl px-6 py-10 lg:px-8">
        {/* Back link */}
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 font-[family-name:var(--font-display)] text-sm text-text-muted transition-colors hover:text-electric"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className="h-4 w-4"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="13" y1="8" x2="3" y2="8" />
            <polyline points="7 4 3 8 7 12" />
          </svg>
          Back to Projects
        </Link>

        <ProjectDetail projectId={id} />
      </main>
    </div>
  );
}
