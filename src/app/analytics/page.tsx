import { Nav } from '@/components/nav';
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-[1400px] px-6 py-10 lg:px-8">
        <div className="animate-fade-in-up">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-text-primary">
            Battle <span className="text-magenta">Report</span>
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Performance tracking across your completed runs
          </p>
        </div>
        <div className="mt-8">
          <AnalyticsDashboard />
        </div>
      </main>
    </div>
  );
}
