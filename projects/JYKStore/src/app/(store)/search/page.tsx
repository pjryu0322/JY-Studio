import { Suspense } from "react";
import { SearchPageClient } from "@/components/SearchPageClient";
import { listPublishedPacks, searchPublishedPacks } from "@/lib/pack-catalog-service";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ q?: string; chip?: string }>;
};

async function SearchPageContent({ searchParams }: PageProps) {
  const { q, chip } = await searchParams;
  const query = q?.trim() ?? "";
  const selectedChip = chip?.trim() ?? "";
  const hasSearchIntent = query.length > 0 || selectedChip.length > 0;

  const [recommended, results] = await Promise.all([
    hasSearchIntent ? Promise.resolve([]) : listPublishedPacks().then((packs) => packs.slice(0, 3)),
    hasSearchIntent ? searchPublishedPacks({ query, chip: selectedChip }) : Promise.resolve([]),
  ]);

  return (
    <SearchPageClient query={query} chip={chip} results={results} recommended={recommended} />
  );
}

export default function SearchPage(props: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl bg-white p-6 text-center text-sm text-store-muted">검색 화면 불러오는 중…</div>
      }
    >
      <SearchPageContent {...props} />
    </Suspense>
  );
}
