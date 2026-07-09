import Link from "next/link";
import { AdminKnowledgeUnitDraftReviewPanel } from "@/components/AdminKnowledgeUnitDraftReviewPanel";
import { ROUTES } from "@/lib/routes";

export default function AdminKnowledgeUnitDraftsPage() {
  return (
    <div className="space-y-4">
      <Link href={ROUTES.admin} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent">
        ← 관리자 콘솔
      </Link>
      <div className="px-1">
        <h1 className="text-lg font-bold text-slate-900">Knowledge Unit draft 검토</h1>
        <p className="mt-1 text-sm text-store-muted">초안 단위 승인/반려 (Pack 검수와 별도)</p>
      </div>
      <AdminKnowledgeUnitDraftReviewPanel />
    </div>
  );
}
