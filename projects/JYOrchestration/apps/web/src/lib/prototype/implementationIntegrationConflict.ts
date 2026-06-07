import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import { asReadonlyArray, mergeResultsSafe } from "@/lib/prototype/implementationIntegrationPlanNormalize";
import type { IntegrationCheckResultV1 } from "@/lib/prototype/implementationIntegrationCheckService";

export function integrationPlanHasConflict(plan: CodeTaskIntegrationPlanV1 | null | undefined): boolean {
  if (!plan) return false;
  if (plan.status === "conflict") return true;
  return mergeResultsSafe(plan).some((r) => r.status === "conflict");
}

export function integrationCheckFailed(
  check: IntegrationCheckResultV1 | null | undefined,
): boolean {
  return check?.status === "failed";
}

export function canCreateIntegrationPullRequest(plan: CodeTaskIntegrationPlanV1 | null | undefined): boolean {
  if (!plan) return false;
  if (integrationPlanHasConflict(plan)) return false;
  if (plan.status === "failed") return false;
  if (integrationCheckFailed(plan.checkResult)) return false;
  const included = asReadonlyArray(plan.included);
  if (!included.length) return false;
  const mergeResults = mergeResultsSafe(plan);
  const allMerged = included.every((item) =>
    mergeResults.some(
      (r) => r.codeTaskId === item.codeTaskId && r.status === "merged",
    ),
  );
  return allMerged || plan.status === "preview_ready" || plan.status === "pr_ready";
}

export function canMergeIntegrationPullRequest(plan: CodeTaskIntegrationPlanV1 | null | undefined): boolean {
  if (!plan) return false;
  if (plan.status !== "pr_ready") return false;
  if (integrationPlanHasConflict(plan)) return false;
  if (integrationCheckFailed(plan.checkResult)) return false;
  return Boolean(String(plan.pullRequestUrl ?? "").trim() && plan.pullRequestNumber);
}
