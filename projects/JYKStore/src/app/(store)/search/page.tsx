import { Suspense } from "react";
import { SearchPageClient } from "@/components/SearchPageClient";

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl bg-white p-6 text-center text-sm text-store-muted">검색 화면 불러오는 중…</div>
      }
    >
      <SearchPageClient />
    </Suspense>
  );
}
