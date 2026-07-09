"use client";

import {
  PROVIDER_PACK_WIZARD_BASIC_STEP,
  PROVIDER_PACK_WIZARD_DRAFT_STEP,
  PROVIDER_PACK_WIZARD_PUBLISH_STEP,
  PROVIDER_PACK_WIZARD_REVIEW_STEP,
  PROVIDER_PACK_WIZARD_SOURCE_STEP,
} from "@/lib/role-based-ux-copy";
import {
  resolveProviderPackWizardStepperStatus,
  type ProviderPackWizardStep,
} from "@/lib/provider-pack-wizard";

const STEPS = [
  { key: "basic" as const, label: PROVIDER_PACK_WIZARD_BASIC_STEP },
  { key: "source" as const, label: PROVIDER_PACK_WIZARD_SOURCE_STEP },
  { key: "draft" as const, label: PROVIDER_PACK_WIZARD_DRAFT_STEP },
  { key: "review" as const, label: PROVIDER_PACK_WIZARD_REVIEW_STEP },
  { key: "publish" as const, label: PROVIDER_PACK_WIZARD_PUBLISH_STEP },
];

export function ProviderPackWizardStepper({ wizardStep }: { readonly wizardStep: ProviderPackWizardStep }) {
  const status = resolveProviderPackWizardStepperStatus(wizardStep);

  return (
    <ol className="flex flex-wrap gap-2 rounded-2xl border border-store-border bg-white p-3 text-[11px]">
      {STEPS.map((step, index) => {
        const stepStatus = status[step.key];
        const tone =
          stepStatus === "current"
            ? "border-store-accent bg-blue-50 text-store-accent"
            : stepStatus === "done"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-store-border bg-slate-50 text-store-muted";
        return (
          <li
            key={step.key}
            className={`flex min-w-[4.5rem] flex-1 items-center gap-1 rounded-xl border px-2 py-2 font-semibold ${tone}`}
          >
            <span className="text-[10px] opacity-70">{index + 1}</span>
            <span className="leading-tight">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
