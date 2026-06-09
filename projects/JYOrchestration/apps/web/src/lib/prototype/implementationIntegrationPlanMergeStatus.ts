import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import { asReadonlyArray } from "@/lib/prototype/implementationIntegrationPlanNormalize";

export function integrationPlanHasSuccessfulMerge(
  plan: CodeTaskIntegrationPlanV1 | null | undefined,
): boolean {
  if (!plan?.integrationBranch?.trim()) return false;
  if (!asReadonlyArray(plan.included).length) return false;
  if (plan.status === "failed" || plan.status === "conflict") return false;
  const mergeResults = asReadonlyArray(plan.mergeResults);
  if (mergeResults.some((m) => m.status === "merged")) return true;
  return (
    plan.status === "preview_ready" ||
    plan.status === "pr_ready" ||
    plan.status === "integrating" ||
    plan.status === "build_checking"
  );
}
