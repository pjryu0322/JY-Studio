import type { ImplementationIntegrationEligibility } from "@/lib/prototype/implementationIntegrationEligibility";
import type { ImplementationPreviewScopeV1 } from "@/lib/prototype/implementationPreviewScopeV1";

export function buildIntegrationScopeCountSummaryLines(
  scope: ImplementationPreviewScopeV1 | null | undefined,
): readonly string[] {
  if (!scope) return [];
  return [
    `이번 Preview 포함 CodeTask: ${scope.includedCodeTasks.length}개`,
    `이번 Preview 제외 CodeTask: ${scope.excludedCodeTasks.length}개`,
  ];
}

export function buildIntegrationEligibilitySummaryLinesFromSnapshot(
  snapshot: import("@/lib/prototype/implementationRuntimeSnapshot").ImplementationRuntimeSnapshotV1,
): readonly string[] {
  const { codeTask, integration, preview } = snapshot;
  if (codeTask.selected === 0) {
    return ["선택된 CodeTask가 없어 통합할 수 없습니다."];
  }
  if (codeTask.completed < codeTask.selected || codeTask.inconsistent > 0) {
    return [
      `개발 CodeTask ${codeTask.completed}/${codeTask.selected} 완료`,
      "미완료 또는 검증 대기 중인 CodeTask가 있어 통합을 시작할 수 없습니다.",
    ];
  }
  if (preview.integratedAppPreviewReady) {
    return ["실제 앱 Preview 준비 완료"];
  }
  if (integration.canRunIntegration) {
    return [
      `개발 CodeTask ${codeTask.completed}/${codeTask.selected} 완료`,
      "최종 연결/통합 Wiring을 실행할 수 있습니다.",
    ];
  }
  return [preview.message.split("\n")[0] ?? "통합 대기"];
}

/** @deprecated Prefer buildIntegrationEligibilitySummaryLinesFromSnapshot(). */
export function buildIntegrationEligibilitySummaryLines(
  eligibility: ImplementationIntegrationEligibility,
): readonly string[] {
  const includedCount = eligibility.included.length;
  if (includedCount === 0) {
    return ["완료된 CodeTask가 없어 통합할 수 없습니다."];
  }
  const lines = [`완료된 CodeTask ${includedCount}개를 기준으로 통합할 수 있습니다.`];
  for (const warning of eligibility.warnings) {
    lines.push(warning);
  }
  if (!lines.some((line) => line.includes("통합을 실행하면 Preview"))) {
    lines.push("통합을 실행하면 Preview가 준비됩니다.");
  }
  return lines;
}

export function buildIntegrationScopeDetailLines(
  scope: ImplementationPreviewScopeV1 | null | undefined,
): readonly string[] {
  if (!scope) return [];
  const lines: string[] = [
    `이번 Preview는 완료된 CodeTask ${scope.includedCodeTasks.length}개 기준입니다.`,
    "미완료 기능은 포함되지 않았습니다.",
  ];
  if (scope.includedCodeTasks.length) {
    lines.push("포함:");
    for (const row of scope.includedCodeTasks) {
      lines.push(`- ${row.title}`);
    }
  }
  if (scope.excludedCodeTasks.length) {
    lines.push("제외:");
    for (const row of scope.excludedCodeTasks.slice(0, 12)) {
      const status = row.status.trim() || row.reason;
      lines.push(`- ${row.title}: ${status}`);
    }
    if (scope.excludedCodeTasks.length > 12) {
      lines.push(`- 외 ${scope.excludedCodeTasks.length - 12}개`);
    }
  }
  for (const warning of scope.warnings) {
    lines.push(warning);
  }
  return lines;
}
