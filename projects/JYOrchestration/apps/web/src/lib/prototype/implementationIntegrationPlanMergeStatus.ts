import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import { asReadonlyArray } from "@/lib/prototype/implementationIntegrationPlanNormalize";

export function integrationPlanHasSuccessfulMerge(
  plan: CodeTaskIntegrationPlanV1 | null | undefined,
): boolean {
  if (!plan?.integrationBranch?.trim()) return false;
  if (!asReadonlyArray(plan.included).length) return false;
  if (plan.status === "failed" || plan.status === "conflict") return false;
  const mergeResults = asReadonlyArray(plan.mergeResults);
  if (mergeResults.some((m) => m.status === "merged" || m.status === "already_integrated")) {
    return true;
  }
  return (
    plan.status === "preview_ready" ||
    plan.status === "pr_ready" ||
    plan.status === "integrating" ||
    plan.status === "build_checking"
  );
}

export function integrationPlanHasExistingBranchResumeEvidence(
  plan: CodeTaskIntegrationPlanV1 | null | undefined,
): boolean {
  if (!plan?.integrationBranch?.trim()) return false;
  if (!asReadonlyArray(plan.included).length) return false;
  if (plan.status === "failed" || plan.status === "conflict") return false;
  if (integrationPlanHasSuccessfulMerge(plan)) return true;
  const branch = plan.integrationBranch.trim();
  if (!branch.startsWith("integration/")) return false;
  const slug = plan.projectId.trim().replace(/[^\p{L}\p{N}]+/gu, "").slice(0, 12) || "project";
  if (!branch.includes(slug)) return false;
  return (
    plan.status === "branch_creating" ||
    plan.status === "integrating" ||
    plan.status === "build_checking" ||
    plan.status === "preview_ready" ||
    plan.status === "pr_ready" ||
    Boolean(plan.pullRequestUrl?.trim())
  );
}
