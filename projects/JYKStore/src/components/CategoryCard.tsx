import Link from "next/link";
import type { StoreCategory } from "@/types/pack";
import { categoryDetailPath } from "@/lib/routes";

export function CategoryCard(p: {
  readonly category: StoreCategory;
  readonly packCount: number;
}) {
  return (
    <Link
      href={categoryDetailPath(p.category.categoryId)}
      className="flex min-h-[44px] items-center gap-3 rounded-2xl border border-store-border bg-white px-4 py-3 shadow-card active:bg-slate-50"
    >
      <span className="text-2xl" aria-hidden>
        {p.category.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{p.category.name}</p>
        <p className="line-clamp-2 text-xs text-store-muted">{p.category.description}</p>
      </div>
      <span className="shrink-0 text-xs font-medium text-store-muted">
        {p.packCount > 0 ? `${p.packCount}개` : "준비 중"}
      </span>
    </Link>
  );
}
