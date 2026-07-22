import { CategoryCard } from "@/components/CategoryCard";
import { listCategoriesWithPublishedCounts } from "@/lib/pack-catalog-service";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await listCategoriesWithPublishedCounts();

  return (
    <ul className="grid gap-3">
      {categories.map((category) => (
        <li key={category.categoryId}>
          <CategoryCard category={category} packCount={category.publishedCount} />
        </li>
      ))}
    </ul>
  );
}
