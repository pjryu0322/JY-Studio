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
  readonly chainHead: string | null;
  readonly mergeItems: readonly CodeTaskIntegrationPlanV1["included"][number][];
}): void {
  const included = asReadonlyArray(input.plan.included);
  if (!included.length) {
    throw new IntegrationPipelineDomainError("integration_included_targets_empty");
  }
  if (input.chainHead && included.length > 1 && !input.mergeItems.length) {
    throw new IntegrationPipelineDomainError("integration_source_missing", undefined, {
      chainHead: input.chainHead,
      includedWorkBranches: included.map((i) => i.workBranch),
    });
  }
}
