import { Suspense } from "react";
import { ProviderSourcePreviewClient } from "./ProviderSourcePreviewClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ packId: string }>;
};

export default async function ProviderSourcePreviewPage({ params }: PageProps) {
  const { packId } = await params;
  return (
    <Suspense fallback={<p className="p-4 text-sm text-store-muted">원문 미리보기 준비 중…</p>}>
      <ProviderSourcePreviewClient packId={packId} />
    </Suspense>
  );
}
