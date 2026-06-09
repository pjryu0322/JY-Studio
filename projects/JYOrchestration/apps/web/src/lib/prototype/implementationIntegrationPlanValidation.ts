import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import {
  asReadonlyArray,
  normalizeCodeTaskIntegrationPlan,
} from "@/lib/prototype/implementationIntegrationPlanNormalize";
import { IntegrationPipelineDomainError } from "@/lib/prototype/implementationIntegrationErrors";

export type IntegrationPlanInvariantResultV1 = Readonly<{
  readonly ok: boolean;
  readonly reason?: string;
  readonly plan: CodeTaskIntegrationPlanV1;
}>;

export function validateCodeTaskIntegrationPlanInvariant(
  raw: CodeTaskIntegrationPlanV1,
): IntegrationPlanInvariantResultV1 {
  const plan = normalizeCodeTaskIntegrationPlan(raw);
  if (!Array.isArray(raw.included) && raw.included !== undefined) {
    return { ok: false, reason: "integration_plan_included_not_array", plan };
  }
  if (!Array.isArray(raw.excluded) && raw.excluded !== undefined) {
    return { ok: false, reason: "integration_plan_excluded_not_array", plan };
  }
  for (const item of plan.included) {
    if (!String(item.codeTaskId ?? "").trim()) {
      return { ok: false, reason: "integration_plan_invalid", plan };
    }
    if (!String(item.workBranch ?? "").trim()) {
      return { ok: false, reason: "integration_plan_invalid", plan };
    }
  }
  return { ok: true, plan };
}

export function assertIntegrationMergeTargets(input: {
  readonly plan: CodeTaskIntegrationPlanV1;
  readonly effectiveSourceBranch: string | null;
  readonly mergeItems: readonly CodeTaskIntegrationPlanV1["included"][number][];
  readonly diagnostic?: Record<string, unknown>;
}): void {
  const plan = normalizeCodeTaskIntegrationPlan(input.plan);
  const included = asReadonlyArray(plan.included);
  if (!included.length) {
    throw new IntegrationPipelineDomainError("integration_included_targets_empty");
  }
  if (!String(input.effectiveSourceBranch ?? "").trim()) {
    throw new IntegrationPipelineDomainError("integration_source_missing", undefined, input.diagnostic);
  }
  if (!input.mergeItems.length) {
    throw new IntegrationPipelineDomainError("integration_source_missing", undefined, {
      ...(input.diagnostic ?? {}),
      effectiveSourceBranch: input.effectiveSourceBranch,
    });
  }
}

/** @deprecated Prefer assertIntegrationMergeTargets with effectiveSourceBranch. */
export function assertIntegrationMergeTargetsWithChainHead(input: {
  readonly plan: CodeTaskIntegrationPlanV1;
  readonly chainHead: string | null;
  readonly mergeItems: readonly CodeTaskIntegrationPlanV1["included"][number][];
}): void {
  assertIntegrationMergeTargets({
    plan: input.plan,
    effectiveSourceBranch:
      input.mergeItems[0]?.workBranch?.trim() || input.chainHead?.trim() || null,
    mergeItems: input.mergeItems,
    diagnostic: { chainHead: input.chainHead },
  });
}
