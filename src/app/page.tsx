import Link from 'next/link';
import { Nav } from '@/components/nav';
import { ProjectList } from '@/components/project-list';
import { db } from '@/db';
import { project } from '@/db/schema';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const projects = await db.query.project.findMany({
    orderBy: [desc(project.createdAt)],
    with: { character: true },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <Link
            href="/projects/new"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
          >
            New Project
          </Link>
        </div>
        <div className="mt-6">
          <ProjectList projects={projects} />
        </div>
      </main>
    </div>
  );
}
