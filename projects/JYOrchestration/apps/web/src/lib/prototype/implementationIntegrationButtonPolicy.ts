import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { isCodeTaskCompletedForSummary } from "@/lib/prototype/implementationCodeTaskSummary";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
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
  if (input.verificationInconsistentCount > 0 || input.completionGate.inconsistentCodeTaskIds.length > 0) {
    for (const codeTaskId of input.completionGate.inconsistentCodeTaskIds) {
      disabledReasonLines.push(`${codeTaskId}: GitHub outcome 저장 대기`);
    }
  }
  if (
    input.completionGate.selectedCount > 0 &&
    input.completionGate.completedCount < input.completionGate.selectedCount
  ) {
    disabledReasonLines.push(
      `CodeTask ${input.completionGate.completedCount}/${input.completionGate.selectedCount} 완료`,
    );
    for (const codeTaskId of input.completionGate.pendingCodeTaskIds) {
      disabledReasonLines.push(`${codeTaskId} 검증 결과 저장 후 통합을 실행할 수 있습니다.`);
    }
  }
  const enabled =
    show &&
    input.finalWiringStepExists &&
    input.completionGate.ok &&
    input.verificationInconsistentCount === 0;
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
