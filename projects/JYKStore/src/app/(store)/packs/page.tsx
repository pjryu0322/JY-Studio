import { Suspense } from "react";
import { PacksPageClient } from "@/components/PacksPageClient";

export default function PacksPage() {
  return (
    <Suspense fallback={<div className="text-sm text-store-muted">목록 불러오는 중…</div>}>
      <PacksPageClient />
    </Suspense>
  );
}
