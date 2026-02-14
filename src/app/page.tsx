import Link from 'next/link';
import { Nav } from '@/components/nav';
import { ProjectList } from '@/components/project-list';
import { supabase } from '@/db';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { data: projects } = await supabase
    .from('project')
    .select('*, character:ai_character(*)')
    .order('created_at', { ascending: false });

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
          <ProjectList projects={projects || []} />
        </div>
      </main>
    </div>
  );
}
