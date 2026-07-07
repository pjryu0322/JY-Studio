import { CategoryCard } from "@/components/CategoryCard";
import { listCategoriesWithPublishedCounts } from "@/lib/pack-catalog-service";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await listCategoriesWithPublishedCounts();

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="text-lg font-bold text-slate-900">카테고리</h1>
        <p className="mt-1 text-sm text-store-muted">분야별로 지식팩을 찾아보세요.</p>
      </div>
      <ul className="grid gap-3">
        {categories.map((category) => (
          <li key={category.categoryId}>
            <CategoryCard category={category} packCount={category.publishedCount} />
          </li>
        ))}
      </ul>
    </div>
  );
}
