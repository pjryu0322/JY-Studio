import Link from "next/link";
import {
  ADMIN_CONSOLE_TITLE,
} from "@/lib/role-based-ux-copy";
import { ROUTES } from "@/lib/routes";

export default function AdminPage() {
  return (
    <div className="space-y-4">
      <Link href={ROUTES.home} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent">
        ← 스토어 홈
      </Link>
      <div className="px-1">
        <h1 className="text-lg font-bold text-slate-900">{ADMIN_CONSOLE_TITLE}</h1>
        <p className="mt-1 text-sm text-store-muted">검수 요청 처리 및 운영 도구</p>
      </div>
      <Link
        href={ROUTES.adminReviews}
        className="flex min-h-[44px] items-center justify-between gap-3 rounded-2xl border border-store-border bg-white px-4 py-3 active:bg-slate-50"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">검수 대기 목록</p>
          <p className="text-xs text-store-muted">REVIEWING 지식팩 승인·반려</p>
        </div>
        <span className="shrink-0 text-store-accent" aria-hidden>
          →
        </span>
      </Link>
      <Link
        href={ROUTES.adminOps}
        className="flex min-h-[44px] items-center justify-between gap-3 rounded-2xl border border-store-border bg-white px-4 py-3 active:bg-slate-50"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">운영 콘솔</p>
          <p className="text-xs text-store-muted">API 사용량, AuditLog, Health 상태 확인</p>
        </div>
        <span className="shrink-0 text-store-accent" aria-hidden>
          →
        </span>
      </Link>
      <Link
        href={ROUTES.adminKnowledgeUnitDrafts}
        className="flex min-h-[44px] items-center justify-between gap-3 rounded-2xl border border-store-border bg-white px-4 py-3 active:bg-slate-50"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">Knowledge Unit draft 검토</p>
          <p className="text-xs text-store-muted">GitHub 자동수집 초안 승인/반려</p>
        </div>
        <span className="shrink-0 text-store-accent" aria-hidden>
          →
        </span>
      </Link>
    </div>
  );
}
