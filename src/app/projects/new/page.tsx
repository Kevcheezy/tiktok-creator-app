import { Nav } from '@/components/nav';
import { CreateProjectForm } from '@/components/create-project-form';

export default function NewProjectPage() {
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-lg px-6 py-10 lg:px-8">
        <div className="animate-fade-in-up">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-text-primary">
            New Project
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Enter a TikTok Shop product URL to analyze and generate a UGC video.
          </p>
        </div>

        <div className="mt-8 animate-fade-in-up rounded-xl border border-border bg-surface p-6" style={{ animationDelay: '100ms' }}>
          <CreateProjectForm />
        </div>
      </main>
    </div>
  );
}
