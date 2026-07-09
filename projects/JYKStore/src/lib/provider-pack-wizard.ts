export type ProviderPackWizardStep =
  | "source"
  | "draft-generation"
  | "review"
  | "readonly-reviewing"
  | "readonly-published";

export function resolveProviderPackWizardStep(input: {
  status: string;
  sourceDocumentCount: number;
  knowledgeUnitDraftCount: number;
  forceSourceStep?: boolean;
}): ProviderPackWizardStep {
  if (input.status === "REVIEWING") {
    return "readonly-reviewing";
  }
  if (input.status === "PUBLISHED" || input.status === "VERIFIED") {
    return "readonly-published";
  }
  if (input.status !== "DRAFT") {
    return "readonly-reviewing";
  }

  if (input.forceSourceStep && input.sourceDocumentCount === 0) {
    return "source";
  }
  if (input.sourceDocumentCount === 0) {
    return "source";
  }
  if (input.knowledgeUnitDraftCount === 0) {
    return "draft-generation";
  }
  return "review";
}

export const PROVIDER_PACK_WIZARD_STEP_KEYS = [
  "basic",
  "source",
  "draft",
  "review",
  "publish",
] as const;

export type ProviderPackWizardStepKey = (typeof PROVIDER_PACK_WIZARD_STEP_KEYS)[number];

export function resolveProviderPackWizardStepperStatus(
  wizardStep: ProviderPackWizardStep,
): Record<ProviderPackWizardStepKey, "done" | "current" | "pending"> {
  const base = {
    basic: "done" as const,
    source: "pending" as const,
    draft: "pending" as const,
    review: "pending" as const,
    publish: "pending" as const,
  };

  if (wizardStep === "readonly-reviewing") {
    return { ...base, source: "done", draft: "done", review: "current" };
  }
  if (wizardStep === "readonly-published") {
    return { ...base, source: "done", draft: "done", review: "done", publish: "done" };
  }
  if (wizardStep === "source") {
    return { ...base, source: "current" };
  }
  if (wizardStep === "draft-generation") {
    return { ...base, source: "done", draft: "current" };
  }
  return { ...base, source: "done", draft: "done", review: "current" };
}
