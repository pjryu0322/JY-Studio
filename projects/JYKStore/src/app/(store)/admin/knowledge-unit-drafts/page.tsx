import Link from "next/link";
import { ROUTES } from "@/lib/routes";

export default function AdminKnowledgeUnitDraftsPage() {
  return (
    <div className="space-y-4">
      <Link
        href={ROUTES.admin}
        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
      >
        ← 관리자 콘솔
      </Link>
      <div className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h1 className="text-lg font-bold text-slate-900">내부 지식 생성 기능 종료</h1>
        <p className="mt-2 text-sm leading-relaxed text-store-muted">
          JYKStore 내부 Knowledge Unit draft 생성·검수 기능은 종료되었습니다. Pack 검수는
          검수 대기 목록에서 진행하세요.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={ROUTES.adminReviews}
            className="inline-flex min-h-[44px] items-center rounded-xl bg-store-accent px-4 text-sm font-bold text-white"
          >
            검수 대기 목록
          </Link>
          <Link
            href={ROUTES.admin}
            className="inline-flex min-h-[44px] items-center rounded-xl border border-store-border px-4 text-sm font-semibold text-slate-800"
          >
            관리자 콘솔
          </Link>
        </div>
      </div>
    </div>
  );
}
