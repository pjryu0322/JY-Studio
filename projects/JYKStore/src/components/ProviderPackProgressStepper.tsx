import Link from "next/link";
import type { ProviderPackProgressStep } from "@/lib/provider-pack-progress";
import type { ProviderOnboardingStep } from "@/lib/provider-onboarding-steps";

const STATUS_LABEL: Record<ProviderPackProgressStep["status"], string> = {
  COMPLETED: "완료",
  CURRENT: "다음",
  WAITING: "대기",
  BLOCKED: "불가",
};

const STATUS_STYLE: Record<ProviderPackProgressStep["status"], string> = {
  COMPLETED: "bg-emerald-100 text-emerald-900",
  CURRENT: "bg-store-accent/15 text-store-accent",
  WAITING: "bg-slate-100 text-slate-600",
  BLOCKED: "bg-slate-100 text-slate-500",
};

const LEGACY_STATUS_MAP: Record<
  ProviderOnboardingStep["status"],
  ProviderPackProgressStep["status"]
> = {
  done: "COMPLETED",
  current: "CURRENT",
  pending: "WAITING",
};

type UnifiedStep = {
  key: string;
  title: string;
  description: string;
  status: ProviderPackProgressStep["status"];
  href?: string | null;
};

/** Pack-scoped 5-step progress. Use on Pack Detail only — never for Provider Center aggregates. */
export function ProviderPackProgressStepper({
  steps,
}: {
  readonly steps: readonly ProviderPackProgressStep[] | readonly ProviderOnboardingStep[];
}) {
  const unified: UnifiedStep[] = steps.map((step) => {
    if ("label" in step) {
      return {
        key: step.key,
        title: step.label,
        description: step.description,
        status: step.status,
        href: step.href,
      };
    }
    return {
      key: step.key,
      title: step.title,
      description: step.description,
      status: LEGACY_STATUS_MAP[step.status],
      href: step.href,
    };
  });

  return (
    <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <h2 className="text-sm font-bold text-slate-900">진행 단계</h2>
      <ol className="mt-3 space-y-2">
        {unified.map((step, index) => (
          <li
            key={step.key}
            className="flex items-start gap-3 rounded-xl border border-store-border/80 px-3 py-2.5"
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[step.status]}`}
                >
                  {STATUS_LABEL[step.status]}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-store-muted">{step.description}</p>
              {step.href && step.status === "CURRENT" ? (
                <Link
                  href={step.href}
                  className="mt-1 inline-block text-xs font-semibold text-store-accent underline-offset-2 hover:underline"
                >
                  이 단계로 이동
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** @deprecated Use ProviderPackProgressStepper */
export function ProviderOnboardingStepper({
  steps,
}: {
  readonly steps: readonly ProviderOnboardingStep[];
}) {
  return <ProviderPackProgressStepper steps={steps} />;
}
