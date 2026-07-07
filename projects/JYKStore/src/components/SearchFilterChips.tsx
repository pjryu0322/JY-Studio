import Link from "next/link";
import { searchPath } from "@/lib/routes";

export function SearchFilterChips(p: {
  readonly query: string;
  readonly activeChip?: string;
  readonly chips: readonly string[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {p.chips.map((chip) => {
        const active =
          chip === "전체" ? !p.activeChip || p.activeChip === "전체" : p.activeChip === chip;
        const href = chip === "전체" ? searchPath(p.query) : searchPath(p.query, chip);
        return (
          <Link
            key={chip}
            href={href}
            className={`inline-flex min-h-[36px] items-center rounded-full border px-3 text-xs font-semibold ${
              active
                ? "border-store-accent bg-blue-50 text-store-accent"
                : "border-store-border bg-white text-slate-700"
            }`}
          >
            {chip}
          </Link>
        );
      })}
    </div>
  );
}
