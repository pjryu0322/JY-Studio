import Link from "next/link";
import type { StoreCategory } from "@/types/pack";
import { categoryDetailPath } from "@/lib/routes";

export function CategoryCard(p: {
  readonly category: StoreCategory;
  readonly packCount: number;
  readonly depth?: number;
}) {
  return (
    <Link
      href={categoryDetailPath(p.category.categoryId)}
      className="flex items-center gap-2.5 rounded-xl border border-store-border bg-white px-3 py-2.5 transition hover:bg-slate-50 active:bg-slate-50"
    >
      <span className="text-lg leading-none" aria-hidden>
        {p.category.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-slate-900">{p.category.name}</p>
          {(p.depth ?? 0) > 0 ? (
            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
              하위
            </span>
          ) : null}
        </div>
        <p className="truncate text-[11px] text-store-muted">{p.category.description}</p>
      </div>
      <span className="shrink-0 text-[11px] font-medium text-store-muted">
        공개 {p.packCount}
      </span>
    </Link>
  );
}
