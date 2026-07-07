import Link from "next/link";
import { ROUTES } from "@/lib/routes";

export function MyPacksEmptyState() {
  return (
    <div className="rounded-2xl border border-store-border bg-white px-6 py-10 text-center shadow-card">
      <p className="text-4xl" aria-hidden>
        📦
      </p>
      <h2 className="mt-4 text-base font-bold text-slate-900">아직 추가한 지식팩이 없습니다.</h2>
      <p className="mt-2 text-sm leading-relaxed text-store-muted">
        필요한 지식팩을 찾아 내 지식팩에 추가하면, 연동에 필요한 Pack ID와 예시 코드를 바로 확인할 수 있습니다.
      </p>
      <Link
        href={ROUTES.packs}
        className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-store-accent px-6 text-sm font-bold text-white active:opacity-90"
      >
        지식팩 둘러보기
      </Link>
    </div>
  );
}
