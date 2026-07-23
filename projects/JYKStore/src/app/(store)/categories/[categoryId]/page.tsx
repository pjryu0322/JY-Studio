import { redirect } from "next/navigation";
import { PackList } from "@/components/PackList";
import { CategoryCard } from "@/components/CategoryCard";
import { NotFoundState } from "@/components/NotFoundState";
import { isProviderAccountRole } from "@/lib/account-role";
import { getStoreAuthSessionFromCookies } from "@/lib/auth-session";
import {
  getCategoryById,
  listCategoryTreeWithPublishedCounts,
  listPublishedPacksByCategory,
} from "@/lib/pack-catalog-service";
import { ROUTES } from "@/lib/routes";
import { getStoreUserById } from "@/lib/store-auth-service";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ categoryId: string }>;
};

export default async function CategoryDetailPage({ params }: PageProps) {
  const session = await getStoreAuthSessionFromCookies();
  if (session) {
    const user = await getStoreUserById(session.userId);
    if (isProviderAccountRole(user?.accountRole)) {
      redirect(ROUTES.provider);
    }
  }

  const { categoryId } = await params;
  const category = await getCategoryById(categoryId);

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

  const packs = await listPublishedPacksByCategory(categoryId);
  const tree = await listCategoryTreeWithPublishedCounts();
  const findNode = (
    nodes: Awaited<ReturnType<typeof listCategoryTreeWithPublishedCounts>>,
  ): (typeof nodes)[number] | null => {
    for (const node of nodes) {
      if (node.categoryId === categoryId) return node;
      const nested = findNode(node.children);
      if (nested) return nested;
    }
    return null;
  };
  const node = findNode(tree);
  const childCategories = node?.children ?? [];

  return (
    <div className="space-y-6">
      <div className="flex gap-3 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <span className="text-3xl" aria-hidden>
          {category.icon}
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-900">{category.name}</h2>
          <p className="mt-1 text-sm text-store-muted">{category.description}</p>
          <p className="mt-2 text-xs text-store-muted">등록된 공개 지식팩 {packs.length}개</p>
        </div>
      </div>

      {childCategories.length > 0 ? (
        <section className="space-y-2">
          <h3 className="px-1 text-xs font-bold uppercase tracking-wide text-store-muted">하위 카테고리</h3>
          <ul className="grid gap-1.5">
            {childCategories.map((child) => (
              <li key={child.categoryId}>
                <CategoryCard category={child} packCount={child.publishedCount} depth={1} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {packs.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-store-muted">
          이 카테고리에 공개된 지식팩이 아직 없습니다.
        </p>
      ) : (
        <PackList packs={packs} />
      )}
    </div>
  );
}
