import { Suspense } from "react";
import { AdminReviewDetailPageClient } from "@/components/AdminReviewDetailPageClient";

type PageProps = {
  params: Promise<{ packId: string }>;
};

export default async function AdminReviewDetailPage({ params }: PageProps) {
  const { packId } = await params;

  return (
    <div className="space-y-4">
      <Suspense fallback={<p className="text-sm text-store-muted">불러오는 중…</p>}>
        <AdminReviewDetailPageClient packId={packId} />
      </Suspense>
    </div>
  );
}
