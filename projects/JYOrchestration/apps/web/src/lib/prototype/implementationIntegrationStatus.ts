import type { ImplementationIntegrationStepV1 } from "@/lib/prototype/implementationIntegrationStep";
import {
  findIntegrationStep,
  isIntegrationStepCompleted,
} from "@/lib/prototype/implementationIntegrationStepMutations";

function labelForStatus(status: ImplementationIntegrationStepV1["status"]): string {
  switch (status) {
    case "pending":
      return "대기";
    case "ready":
      return "실행 가능";
    case "running":
      return "실행 중";
    case "completed":
      return "완료";
    case "failed":
      return "실패";
    case "skipped":
      return "건너뜀";
    default:
      return status;
  }
}

export function buildIntegrationStepStatusLines(
  steps: readonly ImplementationIntegrationStepV1[],
): readonly string[] {
  if (!steps.length) return [];
  const lines: string[] = ["통합 단계"];
  for (const step of [...steps].sort((a, b) => a.order - b.order)) {
    lines.push(`- ${step.title}: ${labelForStatus(step.status)}`);
  }
  return lines;
}

export function isFinalWiringIntegrationStepCompleted(
  steps: readonly ImplementationIntegrationStepV1[],
): boolean {
  return isIntegrationStepCompleted(steps, "final_wiring");
}

export function deriveIntegrationStepPipelinePhase(
  steps: readonly ImplementationIntegrationStepV1[],
): "final_wiring_pending" | "integration_branch_pending" | "build_pending" | "build_failed" | "app_preview_pending" | "all_completed" | "none" {
  if (!steps.length) return "none";
  const finalWiring = findIntegrationStep(steps, "final_wiring");
  if (!finalWiring || finalWiring.status === "failed") return "final_wiring_pending";
  if (finalWiring.status !== "completed") return "final_wiring_pending";
  const branch = findIntegrationStep(steps, "integration_branch");
  if (!branch || branch.status === "failed") return "integration_branch_pending";
  if (branch.status !== "completed") return "integration_branch_pending";
  const build = findIntegrationStep(steps, "build");
  if (build?.status === "failed") return "build_failed";
  if (!build || build.status !== "completed") return "build_pending";
  const app = findIntegrationStep(steps, "app_preview_target");
  if (!app || app.status !== "completed") return "app_preview_pending";
  return "all_completed";
}
