import Link from "next/link";
import { countPacksInCategory, mockPacks, STORE_CATEGORIES } from "@/data/mock-packs";
import { ROUTES } from "@/lib/routes";

export default function CategoriesPage() {
  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="text-lg font-bold text-slate-900">카테고리</h1>
        <p className="mt-1 text-sm text-store-muted">분야별로 지식팩을 찾아보세요.</p>
      </div>
      <ul className="grid gap-3">
        {STORE_CATEGORIES.map((category) => {
          const count = countPacksInCategory(mockPacks, category);
          return (
            <li key={category}>
              <Link
                href={ROUTES.search}
                className="flex min-h-[44px] items-center justify-between gap-3 rounded-2xl border border-store-border bg-white px-4 py-3 shadow-card active:bg-slate-50"
              >
                <span className="text-sm font-semibold text-slate-900">{category}</span>
                <span className="text-xs text-store-muted">{count > 0 ? `${count}개` : "준비 중"}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
