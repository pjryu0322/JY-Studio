import { Suspense } from "react";
import { PacksPageClient } from "@/components/PacksPageClient";
import { listPublishedPacks } from "@/lib/pack-catalog-service";

export const dynamic = "force-dynamic";

export default async function PacksPage() {
  const initialPacks = await listPublishedPacks();

  return (
    <Suspense fallback={<div className="text-sm text-store-muted">목록 불러오는 중…</div>}>
      <PacksPageClient initialPacks={initialPacks} />
    </Suspense>
  );
}
