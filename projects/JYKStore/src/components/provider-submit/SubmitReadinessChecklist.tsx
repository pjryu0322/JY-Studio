"use client";

import type {
  ProviderSubmitReadinessPlan,
  SubmitReadinessNextAction,
  SubmitReadinessStep,
} from "@/lib/provider-submit-readiness-steps";

function statusBadge(status: SubmitReadinessStep["status"]): string {
  switch (status) {
    case "completed":
      return "완료";
    case "current":
      return "진행 필요";
    case "failed":
      return "재실행 필요";
    case "blocked":
      return "불가";
    default:
      return "대기";
  }
}

function statusBadgeClass(status: SubmitReadinessStep["status"]): string {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-900";
    case "current":
      return "bg-blue-100 text-blue-900";
    case "failed":
      return "bg-red-100 text-red-900";
    case "blocked":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export function SubmitReadinessChecklist({
  steps,
  busy,
  onStepAction,
}: {
  readonly steps: ProviderSubmitReadinessPlan["steps"];
  readonly busy: boolean;
  readonly onStepAction: (action: SubmitReadinessNextAction) => void;
}) {
  return (
    <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <h3 className="text-sm font-bold text-slate-900">필수 점검 체크리스트</h3>
      <ol className="mt-3 space-y-3">
        {steps.map((step, index) => (
          <li
            key={step.key}
            className="rounded-xl border border-store-border px-3 py-3 text-xs"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-bold text-slate-900">
                {index + 1}. {step.title}
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass(step.status)}`}
              >
                {statusBadge(step.status)}
              </span>
            </div>
            <p className="mt-1 text-store-muted">{step.description}</p>
            {step.blockingReasons?.map((reason) => (
              <p key={reason} className="mt-1 text-[11px] text-amber-900">
                {reason}
              </p>
            ))}
            {step.actionLabel && step.actionKind ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onStepAction(step.actionKind!)}
                className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border bg-white px-3 text-sm font-semibold disabled:opacity-50 sm:w-auto"
              >
                {busy ? "실행 중…" : step.actionLabel}
              </button>
            ) : step.status === "waiting" ? (
              <p className="mt-2 text-[11px] font-semibold text-slate-500">대기 중</p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
