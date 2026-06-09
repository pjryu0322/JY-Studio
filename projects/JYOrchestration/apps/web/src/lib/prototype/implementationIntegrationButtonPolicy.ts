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
  options?: Readonly<{
    readonly previewDeploymentReady?: boolean;
    readonly autoGenerationReady?: boolean;
  }>,
): Readonly<{
  readonly show: boolean;
  readonly enabled: boolean;
  readonly disabledReasonLines: readonly string[];
  readonly userStatusLines: readonly string[];
  readonly buttonLabel: string;
  readonly continueBuildPreview: boolean;
}> {
  const show =
    !snapshot.preview.integratedAppPreviewReady && snapshot.codeTask.selected > 0;

  const selectedCompleted =
    snapshot.codeTask.selected > 0 &&
    snapshot.codeTask.completed === snapshot.codeTask.selected &&
    snapshot.codeTask.failed === 0 &&
    snapshot.codeTask.inconsistent === 0;

  const fwStatus = snapshot.integration.finalWiringStatus;
  const finalWiringMissing = fwStatus === "missing";
  const finalWiringRunning = fwStatus === "running";
  const finalWiringRunnable =
    fwStatus === "pending" || fwStatus === "ready" || fwStatus === "failed";

  const continueBuildPreview =
    selectedCompleted &&
    fwStatus === "completed" &&
    snapshot.integration.integrationBranchStatus === "completed" &&
    (snapshot.integration.buildStatus !== "completed" ||
      snapshot.integration.appPreviewTargetStatus !== "completed");

  const autoGenerationReady = options?.autoGenerationReady !== false;
  const previewDeploymentReady = options?.previewDeploymentReady !== false;

  let enabled =
    show &&
    selectedCompleted &&
    !finalWiringRunning &&
    !finalWiringMissing &&
    (continueBuildPreview ||
      (finalWiringRunnable && fwStatus !== "completed"));

  if (!autoGenerationReady && enabled) {
    enabled = false;
  }
  if (!previewDeploymentReady && enabled && !continueBuildPreview) {
    enabled = false;
  }

  const buttonLabel = continueBuildPreview
    ? snapshot.integration.buildStatus !== "completed"
      ? "Build 검증 및 Preview 준비 계속"
      : "Preview 준비 계속"
    : "통합 및 Preview 준비";

  const userStatusLines: string[] = [];

  if (snapshot.codeTask.failed > 0) {
    userStatusLines.push(
      "실패한 CodeTask가 있어 통합을 시작할 수 없습니다.\n먼저 실패 작업을 다시 실행해 주세요.",
    );
  } else if (snapshot.codeTask.inconsistent > 0) {
    userStatusLines.push(
      `개발 CodeTask ${snapshot.codeTask.completed}/${snapshot.codeTask.selected} 완료`,
      "미완료 또는 검증 대기 중인 CodeTask가 있어 통합을 시작할 수 없습니다.",
    );
  } else if (!selectedCompleted) {
    userStatusLines.push(
      `개발 CodeTask ${snapshot.codeTask.completed}/${snapshot.codeTask.selected} 완료`,
      "미완료 또는 검증 대기 중인 CodeTask가 있어 통합을 시작할 수 없습니다.",
    );
  } else if (finalWiringMissing) {
    userStatusLines.push(
      "통합 단계를 준비하지 못했습니다.\n잠시 후 다시 시도해 주세요.",
    );
  } else if (finalWiringRunning) {
    userStatusLines.push(
      "최종 연결/통합 Wiring을 진행 중입니다.",
      "잠시만 기다려 주세요.",
    );
  } else if (continueBuildPreview && enabled) {
    userStatusLines.push("통합 branch가 준비되었습니다.");
    if (snapshot.integration.buildStatus !== "completed") {
      userStatusLines.push("Build 검증 및 Preview 준비가 필요합니다.");
    } else {
      userStatusLines.push("실제 앱 Preview target 준비가 필요합니다.");
    }
  } else if (!autoGenerationReady && selectedCompleted && !finalWiringRunning && !finalWiringMissing) {
    userStatusLines.push("자동 생성 기본 연결을 먼저 정상화해 주세요.");
  } else if (!previewDeploymentReady && selectedCompleted && !finalWiringRunning && !finalWiringMissing) {
    userStatusLines.push(
      "Preview 배포 권한 확인이 필요합니다.",
      "환경설정에서 Preview 배포 사전점검을 완료해 주세요.",
    );
  } else if (enabled) {
    userStatusLines.push(
      `개발 CodeTask ${snapshot.codeTask.completed}/${snapshot.codeTask.selected} 완료`,
      "최종 연결/통합 Wiring을 실행할 수 있습니다.",
    );
    userStatusLines.push(
      "최종 연결/통합 Wiring을 실행하면 실제 앱 Preview를 준비할 수 있습니다.",
    );
  } else if (snapshot.integration.disabledReason) {
    userStatusLines.push(...snapshot.integration.disabledReason.split("\n").filter(Boolean));
  }

  return {
    show,
    enabled,
    userStatusLines,
    disabledReasonLines: enabled ? [] : userStatusLines,
    buttonLabel,
    continueBuildPreview,
  };
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
