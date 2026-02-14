import { Nav } from '@/components/nav';
import { ProjectDetail } from '@/components/project-detail';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <ProjectDetail projectId={id} />
      </main>
    </div>
  );
}
