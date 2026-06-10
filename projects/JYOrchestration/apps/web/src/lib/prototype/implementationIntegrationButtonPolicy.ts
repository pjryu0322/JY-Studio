import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { isCodeTaskCompletedForSummary } from "@/lib/prototype/implementationCodeTaskSummary";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import type { ImplementationRuntimeSnapshotV1 } from "@/lib/prototype/implementationRuntimeSnapshot";
import type { SelectedExecutionUnitsCompletionGateV1 } from "@/lib/prototype/implementationExecutionSelectedUnits";
import { isIntegrationPreviewRemediationPipelineStatus } from "@/lib/prototype/integrationPreviewRemediationGuide";

export type IntegrationButtonReadinessReasonV1 =
  | "ready"
  | "no_selected_codetasks"
  | "selected_codetasks_not_complete"
  | "auto_generation_not_ready"
  | "integration_running"
  | "integration_steps_not_ready";

export function isPreviewFailurePipelineStatusForRetry(
  status: string | null | undefined,
): boolean {
  const s = String(status ?? "").trim();
  if (!s) return false;
  if (isIntegrationPreviewRemediationPipelineStatus(s)) return true;
  return (
    s === "app_preview_target_failed" ||
    s === "static_preview_artifact_missing" ||
    s === "build_failed" ||
    s === "github_pages_deploy_pending"
  );
}

export function resolveIntegrationButtonReadiness(input: {
  readonly selectedCodeTaskCount: number;
  readonly selectedCompletedCount: number;
  readonly selectedFailedCount: number;
  readonly selectedInconsistentCount: number;
  readonly autoGenerationReady: boolean;
  readonly isIntegrationRunning: boolean;
  readonly latestPipelineStatus?: string | null;
  readonly latestAppPreviewTargetStatus?: string | null;
  readonly continueBuildPreview?: boolean;
  readonly canRunInitialIntegration?: boolean;
}): Readonly<{
  readonly enabled: boolean;
  readonly reason: IntegrationButtonReadinessReasonV1;
  readonly userSafeMessage: string | null;
  readonly disabledTitle: string | null;
}> {
  if (input.isIntegrationRunning) {
    return {
      enabled: false,
      reason: "integration_running",
      userSafeMessage: "통합 및 Preview 준비가 이미 진행 중입니다.",
      disabledTitle: "통합 및 Preview 준비가 이미 진행 중입니다.",
    };
  }
  if (input.selectedCodeTaskCount <= 0) {
    return {
      enabled: false,
      reason: "no_selected_codetasks",
      userSafeMessage: "선택된 작업이 없습니다.",
      disabledTitle: "선택된 작업이 없습니다.",
    };
  }
  if (
    input.selectedFailedCount > 0 ||
    input.selectedInconsistentCount > 0 ||
    input.selectedCompletedCount < input.selectedCodeTaskCount
  ) {
    return {
      enabled: false,
      reason: "selected_codetasks_not_complete",
      userSafeMessage: "선택된 작업 중 아직 완료되지 않은 작업이 있습니다.",
      disabledTitle: "선택된 작업 중 아직 완료되지 않은 작업이 있습니다.",
    };
  }
  if (!input.autoGenerationReady) {
    return {
      enabled: false,
      reason: "auto_generation_not_ready",
      userSafeMessage: "자동 생성 기본 연결을 먼저 정상화해 주세요.",
      disabledTitle: "자동 생성 기본 연결을 먼저 정상화해 주세요.",
    };
  }

  const canRetryPreview =
    input.continueBuildPreview === true ||
    isPreviewFailurePipelineStatusForRetry(input.latestPipelineStatus) ||
    isPreviewFailurePipelineStatusForRetry(input.latestAppPreviewTargetStatus) ||
    String(input.latestAppPreviewTargetStatus ?? "").trim() === "pending" ||
    String(input.latestAppPreviewTargetStatus ?? "").trim() === "failed";

  const canIntegrate = input.canRunInitialIntegration === true || canRetryPreview;
  if (!canIntegrate) {
    return {
      enabled: false,
      reason: "integration_steps_not_ready",
      userSafeMessage: null,
      disabledTitle: null,
    };
  }

  return {
    enabled: true,
    reason: "ready",
    userSafeMessage: null,
    disabledTitle: null,
  };
}

export function logIntegrationButtonReadinessResolved(input: {
  readonly projectId?: string | null;
  readonly selectedCodeTaskCount: number;
  readonly selectedCompletedCount: number;
  readonly autoGenerationReady: boolean;
  readonly isIntegrationRunning: boolean;
  readonly latestPipelineStatus?: string | null;
  readonly latestAppPreviewTargetStatus?: string | null;
  readonly buttonEnabled: boolean;
  readonly disabledReason: IntegrationButtonReadinessReasonV1;
}): void {
  const action = input.buttonEnabled
    ? isPreviewFailurePipelineStatusForRetry(input.latestPipelineStatus) ||
      isPreviewFailurePipelineStatusForRetry(input.latestAppPreviewTargetStatus)
      ? "integration_button_enabled_with_previous_preview_failure"
      : "integration_button_readiness_resolved"
    : "integration_button_disabled";
  console.info(
    JSON.stringify({
      action,
      projectId: input.projectId ?? null,
      selectedCodeTaskCount: input.selectedCodeTaskCount,
      selectedCompletedCount: input.selectedCompletedCount,
      autoGenerationReady: input.autoGenerationReady,
      isIntegrationRunning: input.isIntegrationRunning,
      latestPipelineStatus: input.latestPipelineStatus ?? null,
      latestAppPreviewTargetStatus: input.latestAppPreviewTargetStatus ?? null,
      buttonEnabled: input.buttonEnabled,
      disabledReason: input.disabledReason,
    }),
  );
}

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
    readonly autoGenerationReady?: boolean;
    readonly isIntegrationRunning?: boolean;
    readonly latestPipelineStatus?: string | null;
    readonly projectId?: string | null;
  }>,
): Readonly<{
  readonly show: boolean;
  readonly enabled: boolean;
  readonly disabledReasonLines: readonly string[];
  readonly userStatusLines: readonly string[];
  readonly buttonLabel: string;
  readonly continueBuildPreview: boolean;
  readonly disabledTitle: string | null;
  readonly readinessReason: IntegrationButtonReadinessReasonV1;
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

  const canRunInitialIntegration =
    show &&
    selectedCompleted &&
    !finalWiringRunning &&
    !finalWiringMissing &&
    (finalWiringRunnable && fwStatus !== "completed");

  const readiness = resolveIntegrationButtonReadiness({
    selectedCodeTaskCount: snapshot.codeTask.selected,
    selectedCompletedCount: snapshot.codeTask.completed,
    selectedFailedCount: snapshot.codeTask.failed,
    selectedInconsistentCount: snapshot.codeTask.inconsistent,
    autoGenerationReady,
    isIntegrationRunning: options?.isIntegrationRunning === true,
    latestPipelineStatus: options?.latestPipelineStatus,
    latestAppPreviewTargetStatus: snapshot.integration.appPreviewTargetStatus,
    continueBuildPreview,
    canRunInitialIntegration,
  });

  const enabled = show && readiness.enabled;

  logIntegrationButtonReadinessResolved({
    projectId: options?.projectId,
    selectedCodeTaskCount: snapshot.codeTask.selected,
    selectedCompletedCount: snapshot.codeTask.completed,
    autoGenerationReady,
    isIntegrationRunning: options?.isIntegrationRunning === true,
    latestPipelineStatus: options?.latestPipelineStatus,
    latestAppPreviewTargetStatus: snapshot.integration.appPreviewTargetStatus,
    buttonEnabled: enabled,
    disabledReason: readiness.reason,
  });

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
  } else if (readiness.reason === "auto_generation_not_ready" && selectedCompleted) {
    userStatusLines.push("자동 생성 기본 연결을 먼저 정상화해 주세요.");
  } else if (
    enabled &&
    (isPreviewFailurePipelineStatusForRetry(options?.latestPipelineStatus) ||
      isPreviewFailurePipelineStatusForRetry(snapshot.integration.appPreviewTargetStatus))
  ) {
    userStatusLines.push(
      "이전 Preview 준비가 완료되지 않았습니다.",
      "다시 [통합 및 Preview 준비]를 누르면 Preview 권한을 다시 확인합니다.",
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
    disabledReasonLines: enabled ? [] : userStatusLines.length ? userStatusLines : readiness.userSafeMessage ? [readiness.userSafeMessage] : [],
    buttonLabel,
    continueBuildPreview,
    disabledTitle: enabled ? null : readiness.disabledTitle,
    readinessReason: readiness.reason,
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
