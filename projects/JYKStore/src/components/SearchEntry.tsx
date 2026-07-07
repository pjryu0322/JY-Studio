import Link from "next/link";
import { ROUTES } from "@/lib/routes";

export function SearchEntry() {
  return (
    <Link
      href={ROUTES.search}
      className="flex min-h-[44px] w-full items-center gap-2 rounded-xl border border-store-border bg-white px-3 py-2.5 text-left shadow-sm active:bg-slate-50"
      aria-label="지식팩 검색"
    >
      <svg
        className="shrink-0 text-store-muted"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3-3" />
      </svg>
      <span className="text-sm text-store-muted">어떤 지식팩이 필요하신가요?</span>
    </Link>
  );
}
