import type { ImplementationIntegrationStepV1 } from "@/lib/prototype/implementationIntegrationStep";

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
  const finalWiring = steps.find((s) => s.kind === "final_wiring");
  return finalWiring?.status === "completed";
}

export function isFinalWiringIntegrationStepPendingOrReady(
  steps: readonly ImplementationIntegrationStepV1[],
): boolean {
  const finalWiring = steps.find((s) => s.kind === "final_wiring");
  if (!finalWiring) return false;
  return (
    finalWiring.status === "pending" ||
    finalWiring.status === "ready" ||
    finalWiring.status === "running"
  );
}
