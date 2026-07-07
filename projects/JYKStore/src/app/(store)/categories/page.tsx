import { CategoryCard } from "@/components/CategoryCard";
import { mockCategories } from "@/data/mock-categories";
import { mockPacks } from "@/data/mock-packs";

export default function CategoriesPage() {
  const countByCategory = new Map<string, number>();
  for (const pack of mockPacks) {
    countByCategory.set(pack.categoryId, (countByCategory.get(pack.categoryId) ?? 0) + 1);
  }

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="text-lg font-bold text-slate-900">카테고리</h1>
        <p className="mt-1 text-sm text-store-muted">분야별로 지식팩을 찾아보세요.</p>
      </div>
      <ul className="grid gap-3">
        {mockCategories.map((category) => (
          <li key={category.categoryId}>
            <CategoryCard category={category} packCount={countByCategory.get(category.categoryId) ?? 0} />
          </li>
        ))}
      </ul>
    </div>
  );
}
