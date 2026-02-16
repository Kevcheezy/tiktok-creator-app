import { Nav } from '@/components/nav';
import { RoadmapBoard } from '@/components/roadmap-board';

export default function RoadmapPage() {
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-[1400px] px-6 py-10 lg:px-8">
        <RoadmapBoard />
      </main>
    </div>
  );
}
