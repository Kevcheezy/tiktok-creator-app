import { InfluencerDetail } from '@/components/influencer-detail';

export const dynamic = 'force-dynamic';

export default async function InfluencerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 lg:px-8">
      <InfluencerDetail influencerId={id} />
    </main>
  );
}
