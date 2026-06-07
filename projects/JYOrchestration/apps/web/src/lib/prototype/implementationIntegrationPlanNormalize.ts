import type { CodeTaskIntegrationMergeResultV1, CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";

export function asReadonlyArray<T>(value: readonly T[] | T[] | null | undefined): readonly T[] {
  return Array.isArray(value) ? value : [];
}

export type IntegrationPlanArrayNormalizationAuditV1 = Readonly<{
  readonly includedWasArray: boolean;
  readonly excludedWasArray: boolean;
  readonly mergeResultsWasArray: boolean;
}>;

export function normalizeCodeTaskIntegrationPlan(
  plan: CodeTaskIntegrationPlanV1,
): CodeTaskIntegrationPlanV1 {
  return {
    ...plan,
    included: asReadonlyArray(plan.included),
    excluded: asReadonlyArray(plan.excluded),
    mergeResults: asReadonlyArray(plan.mergeResults),
  };
}

export function auditIntegrationPlanArrayNormalization(
  raw: Partial<CodeTaskIntegrationPlanV1> & Pick<CodeTaskIntegrationPlanV1, "version">,
): IntegrationPlanArrayNormalizationAuditV1 {
  return {
    includedWasArray: Array.isArray(raw.included),
    excludedWasArray: Array.isArray(raw.excluded),
    mergeResultsWasArray: Array.isArray(raw.mergeResults),
  };
}

export function normalizePartialIntegrationPlanArrays(
  plan: CodeTaskIntegrationPlanV1,
): Readonly<{
  readonly plan: CodeTaskIntegrationPlanV1;
  readonly audit: IntegrationPlanArrayNormalizationAuditV1;
}> {
  const audit = auditIntegrationPlanArrayNormalization(plan);
  return { plan: normalizeCodeTaskIntegrationPlan(plan), audit };
}

export function mergeResultsSafe(
  plan: CodeTaskIntegrationPlanV1,
): readonly CodeTaskIntegrationMergeResultV1[] {
  return asReadonlyArray(plan.mergeResults);
}
