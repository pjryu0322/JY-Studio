import { AdminReviewDetailPageClient } from "@/components/AdminReviewDetailPageClient";

type PageProps = {
  params: Promise<{ packId: string }>;
};

export default async function AdminReviewDetailPage({ params }: PageProps) {
  const { packId } = await params;

  return (
    <div className="space-y-4">
      <AdminReviewDetailPageClient packId={packId} />
    </div>
  );
}
