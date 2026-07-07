import Link from "next/link";
import { PackList } from "@/components/PackList";
import { NotFoundState } from "@/components/NotFoundState";
import { getCategoryById } from "@/lib/category-utils";
import { getPacksByCategoryId } from "@/lib/pack-utils";
import { ROUTES } from "@/lib/routes";

type PageProps = {
  params: Promise<{ categoryId: string }>;
};

export default async function CategoryDetailPage({ params }: PageProps) {
  const { categoryId } = await params;
  const category = getCategoryById(categoryId);

  if (!category) {
    return (
      <NotFoundState
        title="카테고리를 찾을 수 없습니다."
        description="다른 카테고리를 둘러보세요."
        ctaLabel="카테고리 목록"
        ctaHref={ROUTES.categories}
      />
    );
  }

  const packs = getPacksByCategoryId(categoryId);

  return (
    <div className="space-y-6">
      <Link href={ROUTES.categories} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent">
        ← 카테고리
      </Link>
      <div className="flex gap-3 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <span className="text-3xl" aria-hidden>
          {category.icon}
        </span>
        <div>
          <h1 className="text-lg font-bold text-slate-900">{category.name}</h1>
          <p className="mt-1 text-sm text-store-muted">{category.description}</p>
        </div>
      </div>
      {packs.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-store-muted">
          이 카테고리에 등록된 지식팩을 준비 중입니다.
        </p>
      ) : (
        <PackList packs={packs} />
      )}
    </div>
  );
}
