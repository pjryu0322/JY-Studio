"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback } from "react";
import { PackList } from "@/components/PackList";
import { SearchFilterChips } from "@/components/SearchFilterChips";
import { NotFoundState } from "@/components/NotFoundState";
import { POPULAR_SEARCH_TERMS } from "@/data/mock-packs";
import { applySearchFilters, getPublishedPacks, searchPacks } from "@/lib/pack-utils";
import { ROUTES, searchPath } from "@/lib/routes";

const RESULT_CHIPS = ["전체", "인증", "API", "Java", "Spring", "검증됨", "무료"] as const;

export function SearchPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const chip = searchParams.get("chip") ?? undefined;

  const onSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const q = String(fd.get("q") ?? "").trim();
      router.push(searchPath(q));
    },
    [router],
  );

  const hasQuery = query.trim().length > 0;
  let results = hasQuery ? searchPacks(query) : [];
  if (hasQuery) {
    results = applySearchFilters(results, { chip });
  }
  const recommended = getPublishedPacks().slice(0, 3);

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit}>
        <label htmlFor="pack-search" className="sr-only">
          지식팩 검색
        </label>
        <input
          id="pack-search"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="어떤 지식팩이 필요하신가요?"
          className="min-h-[44px] w-full rounded-xl border border-store-border bg-white px-4 text-sm text-slate-900 placeholder:text-store-muted shadow-sm"
        />
      </form>

      {!hasQuery ? (
        <>
          <section>
            <h2 className="mb-3 px-1 text-sm font-bold text-slate-900">인기 검색어</h2>
            <div className="flex flex-wrap gap-2">
              {POPULAR_SEARCH_TERMS.map((term) => (
                <Link
                  key={term}
                  href={searchPath(term)}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-store-border bg-white px-4 text-sm font-medium text-slate-700 active:bg-slate-50"
                >
                  {term}
                </Link>
              ))}
            </div>
          </section>
          <section>
            <h2 className="mb-3 px-1 text-lg font-bold text-slate-900">추천 지식팩</h2>
            <PackList packs={recommended} />
          </section>
        </>
      ) : (
        <>
          <div className="px-1">
            <p className="text-sm text-store-muted">
              <span className="font-semibold text-slate-900">「{query}」</span> 검색 결과{" "}
              <span className="font-semibold text-store-accent">{results.length}</span>개
            </p>
          </div>
          <SearchFilterChips query={query} activeChip={chip} chips={RESULT_CHIPS} />
          {results.length === 0 ? (
            <NotFoundState
              title="검색 결과가 없습니다."
              description="다른 키워드로 검색하거나 카테고리에서 지식팩을 찾아보세요."
              ctaLabel="지식팩 둘러보기"
              ctaHref={ROUTES.packs}
            />
          ) : (
            <PackList packs={results} />
          )}
        </>
      )}
    </div>
  );
}
