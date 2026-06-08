import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { isCodeTaskCompletedForSummary } from "@/lib/prototype/implementationCodeTaskSummary";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import type { ImplementationRuntimeSnapshotV1 } from "@/lib/prototype/implementationRuntimeSnapshot";
import type { SelectedExecutionUnitsCompletionGateV1 } from "@/lib/prototype/implementationExecutionSelectedUnits";

export function runHasPersistedGithubVerifiedOutcomeForAutoGate(
  run: CodeTaskExecutionRunV1 | null | undefined,
): boolean {
  if (!run) return false;
  if (run.status !== "github_verified") return false;
  return isCodeTaskCompletedForSummary(run);
}

export function shouldShowIntegrationPipelineButton(input: {
  readonly canIntegrate: boolean;
  readonly previewRuntimeReady?: boolean;
}): boolean {
  if (!input.canIntegrate) return false;
  if (input.previewRuntimeReady) return false;
  return true;
}

export function evaluateIntegrationPipelineButtonEnablement(input: {
  readonly canIntegrate: boolean;
  readonly previewRuntimeReady?: boolean;
  readonly completionGate: SelectedExecutionUnitsCompletionGateV1;
  readonly verificationInconsistentCount: number;
  readonly finalWiringStepExists: boolean;
}): Readonly<{
  readonly show: boolean;
  readonly enabled: boolean;
  readonly disabledReasonLines: readonly string[];
}> {
  const show = shouldShowIntegrationPipelineButton({
    canIntegrate: input.canIntegrate,
    previewRuntimeReady: input.previewRuntimeReady,
  });
  const disabledReasonLines: string[] = [];
  if (!input.finalWiringStepExists) {
    disabledReasonLines.push("최종 연결/통합 Wiring 단계가 구성되지 않았습니다.");
  }
  if (input.completionGate.failedCodeTaskIds.length > 0) {
    disabledReasonLines.push(
      "실패한 CodeTask가 있어 통합을 시작할 수 없습니다.\n먼저 실패 작업을 다시 실행해 주세요.",
    );
  } else if (
    input.verificationInconsistentCount > 0 ||
    input.completionGate.inconsistentCodeTaskIds.length > 0
  ) {
    disabledReasonLines.push("검증 대기 CodeTask가 있어 통합을 시작할 수 없습니다.");
  } else if (
    input.completionGate.selectedCount > 0 &&
    input.completionGate.completedCount < input.completionGate.selectedCount
  ) {
    disabledReasonLines.push(
      `개발 CodeTask ${input.completionGate.completedCount}/${input.completionGate.selectedCount} 완료`,
    );
    disabledReasonLines.push("미완료 CodeTask가 있어 통합을 시작할 수 없습니다.");
  }
  const enabled =
    show &&
    input.finalWiringStepExists &&
    input.completionGate.ok &&
    input.verificationInconsistentCount === 0;
  return { show, enabled, disabledReasonLines };
}

export function evaluateIntegrationPipelineButtonFromSnapshot(
  snapshot: ImplementationRuntimeSnapshotV1,
): Readonly<{
  readonly show: boolean;
  readonly enabled: boolean;
  readonly disabledReasonLines: readonly string[];
}> {
  const show =
    !snapshot.preview.integratedAppPreviewReady &&
    snapshot.integration.steps.length > 0 &&
    snapshot.codeTask.selected > 0;
  const enabled = snapshot.integration.canRunIntegration;
  const disabledReasonLines: string[] = [];
  if (snapshot.integration.disabledReason) {
    disabledReasonLines.push(...snapshot.integration.disabledReason.split("\n").filter(Boolean));
  }
  return { show, enabled, disabledReasonLines };
}

export function isPreviewRuntimeOpenReady(
  runtime: ImplementationPreviewRuntimeV1 | null | undefined,
): boolean {
  if (!runtime || runtime.status !== "ready") return false;
  return Boolean(
    String(runtime.externalPreviewUrl ?? "").trim() ||
      String(runtime.previewUrl ?? "").trim() ||
      String(runtime.internalAppPreviewUrl ?? "").trim(),
  );
}

export function isIntegrationPreviewRuntimeReady(
  runtime: ImplementationPreviewRuntimeV1 | null | undefined,
): boolean {
  if (!isPreviewRuntimeOpenReady(runtime)) return false;
  if (
    runtime!.openMode === "scope_summary_fallback" ||
    runtime!.renderMode === "scope_summary_fallback"
  ) {
    return false;
  }
  if (!String(runtime!.sourceIntegrationBranch ?? "").trim()) return false;
  return runtime!.status === "ready";
}
