"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useMemo } from "react";
import { PackList } from "@/components/PackList";
import { mockPacks } from "@/data/mock-packs";
import { filterPacks, sortPacksForBrowse } from "@/lib/pack-utils";
import { ROUTES, searchPath } from "@/lib/routes";

const BROWSE_FILTERS = [
  { id: "all", label: "전체" },
  { id: "verified", label: "검증됨" },
  { id: "free", label: "무료" },
  { id: "popular", label: "인기" },
] as const;

const CATEGORY_CHIPS = ["전체", "인증", "프레임워크", "API", "UI", "리포팅"] as const;

export function PacksPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = (searchParams.get("filter") as "all" | "verified" | "free" | "popular") || "all";
  const categoryChip = searchParams.get("category") ?? undefined;

  const onSearchSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
      if (q) router.push(searchPath(q));
    },
    [router],
  );

  const buildPacksUrl = (nextFilter: string, nextCategory?: string) => {
    const params = new URLSearchParams();
    if (nextFilter !== "all") params.set("filter", nextFilter);
    if (nextCategory && nextCategory !== "전체") params.set("category", nextCategory);
    const qs = params.toString();
    return qs ? `${ROUTES.packs}?${qs}` : ROUTES.packs;
  };

  const packs = useMemo(() => {
    let list = sortPacksForBrowse(mockPacks);
    list = filterPacks(list, filter);
    if (categoryChip && categoryChip !== "전체") {
      list = list.filter(
        (p) =>
          p.category.includes(categoryChip) ||
          p.tags.some((t) => t.includes(categoryChip)),
      );
    }
    return list;
  }, [filter, categoryChip]);

  return (
    <div className="space-y-6">
      <div className="px-1">
        <h1 className="text-lg font-bold text-slate-900">지식팩 둘러보기</h1>
        <p className="mt-1 text-sm text-store-muted">필요한 제품·솔루션 지식을 지식팩으로 찾아보세요.</p>
      </div>

      <form onSubmit={onSearchSubmit}>
        <input
          name="q"
          type="search"
          placeholder="지식팩 이름, 태그 검색"
          className="min-h-[44px] w-full rounded-xl border border-store-border bg-white px-4 text-sm shadow-sm"
        />
      </form>

      <div className="flex flex-wrap gap-2">
        {BROWSE_FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <Link
              key={f.id}
              href={buildPacksUrl(f.id, categoryChip)}
              className={`inline-flex min-h-[36px] items-center rounded-full border px-3 text-xs font-semibold ${
                active ? "border-store-accent bg-blue-50 text-store-accent" : "border-store-border bg-white"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORY_CHIPS.map((chip) => {
          const active = (categoryChip ?? "전체") === chip;
          return (
            <Link
              key={chip}
              href={buildPacksUrl(filter, chip === "전체" ? undefined : chip)}
              className={`inline-flex min-h-[36px] items-center rounded-full border px-3 text-xs font-semibold ${
                active ? "border-store-accent bg-blue-50 text-store-accent" : "border-store-border bg-white"
              }`}
            >
              {chip}
            </Link>
          );
        })}
      </div>

      <PackList packs={packs} />
    </div>
  );
}
