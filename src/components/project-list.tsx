import { ProjectCard } from './project-card';

interface Project {
  id: string;
  name: string | null;
  productUrl: string;
  productName: string | null;
  productCategory: string | null;
  status: string;
  createdAt: string | Date | null;
  costUsd: string | null;
}

export function ProjectList({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
        <h3 className="text-sm font-semibold text-gray-900">No projects yet</h3>
        <p className="mt-1 text-sm text-gray-500">
          Get started by creating a new project.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
