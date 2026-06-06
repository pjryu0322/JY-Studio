import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import type { IntegrationCheckResultV1 } from "@/lib/prototype/implementationIntegrationCheckService";

export function integrationPlanHasConflict(plan: CodeTaskIntegrationPlanV1 | null | undefined): boolean {
  if (!plan) return false;
  if (plan.status === "conflict") return true;
  return (plan.mergeResults ?? []).some((r) => r.status === "conflict");
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
  if (!plan.included.length) return false;
  const allMerged = plan.included.every((item) =>
    (plan.mergeResults ?? []).some(
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
