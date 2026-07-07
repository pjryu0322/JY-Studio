"use client";

import { useCallback } from "react";
import { PackCard } from "@/components/PackCard";
import { mockPacks, POPULAR_SEARCH_TERMS } from "@/data/mock-packs";

export default function SearchPage() {
  const handleAdd = useCallback(() => {}, []);

  const recommended = mockPacks.filter((p) => p.status === "PUBLISHED" || p.packId === "easy-auth").slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="pack-search" className="sr-only">
          지식팩 검색
        </label>
        <input
          id="pack-search"
          type="search"
          readOnly
          placeholder="어떤 지식팩이 필요하신가요?"
          className="min-h-[44px] w-full rounded-xl border border-store-border bg-white px-4 text-sm text-slate-900 placeholder:text-store-muted shadow-sm"
          aria-describedby="search-phase-hint"
        />
        <p id="search-phase-hint" className="mt-2 text-xs text-store-muted">
          검색 기능은 다음 단계에서 연결됩니다. 필요한 키워드를 눌러 탐색을 시작해 보세요.
        </p>
      </div>

      <section>
        <h2 className="mb-3 px-1 text-sm font-bold text-slate-900">인기 검색어</h2>
        <div className="flex flex-wrap gap-2">
          {POPULAR_SEARCH_TERMS.map((term) => (
            <button
              key={term}
              type="button"
              className="min-h-[44px] rounded-full border border-store-border bg-white px-4 text-sm font-medium text-slate-700 active:bg-slate-50"
            >
              {term}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 px-1 text-lg font-bold text-slate-900">추천 지식팩</h2>
        <div className="space-y-3">
          {recommended.map((pack) => (
            <PackCard key={pack.packId} pack={pack} onAddToLibrary={handleAdd} />
          ))}
        </div>
      </section>
    </div>
  );
}
