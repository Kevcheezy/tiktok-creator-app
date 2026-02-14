import { Nav } from '@/components/nav';
import { CreateProjectForm } from '@/components/create-project-form';

export default function NewProjectPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <main className="mx-auto max-w-lg px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900">New Project</h1>
        <p className="mt-2 text-sm text-gray-600">
          Enter a TikTok Shop product URL to analyze and generate a UGC video.
        </p>
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
          <CreateProjectForm />
        </div>
      </main>
    </div>
  );
}
