import Link from "next/link";
import { AdminReviewDetailPageClient } from "@/components/AdminReviewDetailPageClient";
import { ROUTES } from "@/lib/routes";

type PageProps = {
  params: Promise<{ packId: string }>;
};

export default async function AdminReviewDetailPage({ params }: PageProps) {
  const { packId } = await params;

  return (
    <div className="space-y-4">
      <Link href={ROUTES.admin} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent">
        ← 관리자 콘솔
      </Link>
      <AdminReviewDetailPageClient packId={packId} />
    </div>
  );
}
