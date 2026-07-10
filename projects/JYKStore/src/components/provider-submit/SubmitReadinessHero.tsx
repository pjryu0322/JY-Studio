"use client";

import type { ProviderSubmitReadinessPlan } from "@/lib/provider-submit-readiness-steps";
import { PROVIDER_SUBMIT_READINESS_TITLE } from "@/lib/role-based-ux-copy";

export function SubmitReadinessHero({
  plan,
  busy,
  onRunNextAction,
}: {
  readonly plan: ProviderSubmitReadinessPlan;
  readonly busy: boolean;
  readonly onRunNextAction: () => void;
}) {
  const allDone = plan.completedStepCount >= plan.totalStepCount && plan.nextAction === "SUBMIT_REVIEW";
  const waitingAdmin = plan.nextAction === "WAIT_ADMIN_REVIEW";

  return (
    <section className="rounded-2xl border border-store-border bg-slate-50 p-4">
      <h3 className="text-sm font-bold text-slate-900">{PROVIDER_SUBMIT_READINESS_TITLE}</h3>
      <p className="mt-1 text-xs text-store-muted">
        아래 필수 점검을 완료하면 검수 요청을 제출할 수 있습니다.
      </p>

      {waitingAdmin ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <p className="font-bold">관리자 검토 대기</p>
          <p className="mt-1">{plan.nextActionDescription}</p>
        </div>
      ) : allDone ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
          <p className="font-bold">검수 요청 준비 완료</p>
          <p className="mt-1">
            모든 필수 점검이 완료되었습니다. 검수 요청을 제출하면 일반 카탈로그와 Context API에는 아직
            공개되지 않고, 관리자 검토 단계로 이동합니다.
          </p>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-slate-800">
          <p className="font-bold">검수 요청 준비가 아직 완료되지 않았습니다.</p>
          <p className="mt-2">
            현재 단계: <strong>{plan.currentStepTitle}</strong>
          </p>
          <p className="mt-1 text-store-muted">{plan.nextActionDescription}</p>
          {plan.incompleteStepTitles.length > 0 ? (
            <div className="mt-2">
              <p className="font-semibold">미완료 항목 {plan.incompleteStepTitles.length}개</p>
              <ul className="mt-1 list-disc pl-4">
                {plan.incompleteStepTitles.map((title) => (
                  <li key={title}>{title}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      <p className="mt-3 text-xs text-slate-700">
        진행률: <strong>{plan.completedStepCount}</strong> / {plan.totalStepCount} 완료
      </p>

      {plan.nextAction !== "BLOCKED" &&
      plan.nextAction !== "WAIT_ADMIN_REVIEW" &&
      plan.nextAction !== "SUBMIT_REVIEW" ? (
        <button
          type="button"
          disabled={busy}
          onClick={onRunNextAction}
          className="mt-3 min-h-[44px] w-full rounded-xl bg-store-accent px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? "실행 중…" : plan.nextActionLabel}
        </button>
      ) : null}
    </section>
  );
}
