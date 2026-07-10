"use client";

import type { ProviderSubmitReadinessPlan } from "@/lib/provider-submit-readiness-steps";
import {
  PROVIDER_PACK_GO_TO_INSPECTION_TAB,
  PROVIDER_PACK_REVIEW_SUBMIT_CTA,
} from "@/lib/role-based-ux-copy";

export function SubmitRequestAction({
  plan,
  submitting,
  onSubmitReview,
  onGoToInspectionTab,
}: {
  readonly plan: ProviderSubmitReadinessPlan;
  readonly submitting: boolean;
  readonly onSubmitReview: () => void;
  readonly onGoToInspectionTab?: () => void;
}) {
  if (plan.nextAction === "WAIT_ADMIN_REVIEW") {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-center text-sm font-semibold text-amber-950">
        관리자 검토가 진행 중입니다.
      </p>
    );
  }

  const canSubmit = plan.canSubmitReview;

  return (
    <div className="space-y-2">
      {!canSubmit && onGoToInspectionTab ? (
        <button
          type="button"
          onClick={onGoToInspectionTab}
          className="min-h-[44px] w-full rounded-xl border border-store-accent bg-white text-sm font-bold text-store-accent"
        >
          {PROVIDER_PACK_GO_TO_INSPECTION_TAB}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onSubmitReview}
        disabled={!canSubmit || submitting}
        className={`min-h-[44px] w-full rounded-xl text-sm font-bold ${
          canSubmit
            ? "bg-store-accent text-white"
            : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-500"
        } disabled:opacity-60`}
      >
        {submitting ? "제출 중…" : PROVIDER_PACK_REVIEW_SUBMIT_CTA}
      </button>
      {!canSubmit && plan.submitBlockedReasons.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <p className="font-semibold">제출하려면 먼저 다음 작업을 완료하세요:</p>
          <ul className="mt-1 list-disc pl-4">
            {plan.submitBlockedReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
