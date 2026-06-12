import { evaluateIntegrationPrepareGateFromBoardSummary } from "@/lib/prototype/implementationBoardIntegrationGate";
import type { ImplementationCodeTaskSelectionSummaryV1 } from "@/lib/prototype/implementationCodeTaskBoardState";
import { evaluateIntegrationPipelineButtonFromSnapshot } from "@/lib/prototype/implementationIntegrationButtonPolicy";
import type { IntegrationGateBlockedDetailV1 } from "@/lib/prototype/implementationIntegrationBoardGateSummary";
import type { ImplementationRuntimeSnapshotV1 } from "@/lib/prototype/implementationRuntimeSnapshot";

export type ProjectIntegrationPipelineEligibilityReasonCodeV1 =
  | "ready"
  | "codetask_completion_required"
  | "failed_codetask_exists"
  | "verification_inconsistent"
  | "integration_step_missing"
  | "integration_already_running"
  | "preview_already_ready"
  | "review_change_not_ready"
  | "board_gate_blocked";

export type ProjectIntegrationPipelineEligibilityV1 = Readonly<{
  readonly canRun: boolean;
  readonly reasonCode: ProjectIntegrationPipelineEligibilityReasonCodeV1;
  readonly userMessage: string;
  readonly blockedUnitIds: readonly string[];
  readonly blockedCodeTaskIds: readonly string[];
}>;

export function buildImplementationIntegrationPipelineEligibilityFromSnapshot(
  snapshot: ImplementationRuntimeSnapshotV1,
  options: Readonly<{
    readonly boardGateSummary: ImplementationCodeTaskSelectionSummaryV1;
    readonly boardGateBlockedDetails?: readonly IntegrationGateBlockedDetailV1[];
  }>,
): ProjectIntegrationPipelineEligibilityV1 {
  const boardSummary = options.boardGateSummary;
  const button = evaluateIntegrationPipelineButtonFromSnapshot(snapshot, {
    boardGateSummary: boardSummary,
  });
  const blockedUnitIds = snapshot.units
    .filter(
      (u) =>
        u.displayStatus === "failed" ||
        u.displayStatus === "verification_inconsistent" ||
        u.displayStatus === "pending" ||
        u.displayStatus === "running" ||
        u.displayStatus === "verifying",
    )
    .map((u) => u.unitId);

  if (snapshot.preview.integratedAppPreviewReady) {
    return {
      canRun: false,
      reasonCode: "preview_already_ready",
      userMessage: "실제 앱 Preview가 이미 준비되었습니다.",
      blockedUnitIds: [],
      blockedCodeTaskIds: [],
    };
  }

  const boardIntegrationReady =
    boardSummary.runnableCount === 0 && boardSummary.integrationReadyCount > 0;

  const continueBuildPreview =
    boardIntegrationReady &&
    snapshot.codeTask.failed === 0 &&
    snapshot.codeTask.inconsistent === 0 &&
    snapshot.integration.finalWiringStatus === "completed" &&
    snapshot.integration.integrationBranchStatus === "completed" &&
    (snapshot.integration.buildStatus !== "completed" ||
      snapshot.integration.appPreviewTargetStatus !== "completed");

  if (continueBuildPreview) {
    return {
      canRun: true,
      reasonCode: "ready",
      userMessage: "",
      blockedUnitIds: [],
      blockedCodeTaskIds: [],
    };
  }

  const gate = evaluateIntegrationPrepareGateFromBoardSummary(boardSummary, {
    blockedDetails: options.boardGateBlockedDetails,
  });
  if (!gate.ok) {
    return {
      canRun: false,
      reasonCode: "board_gate_blocked",
      userMessage:
        gate.message ??
        "미완료 또는 검증 대기 중인 CodeTask가 있어 통합을 시작할 수 없습니다.",
      blockedUnitIds,
      blockedCodeTaskIds: gate.blockedCodeTaskIds,
    };
  }

  if (snapshot.codeTask.failed > 0) {
    return {
      canRun: false,
      reasonCode: "failed_codetask_exists",
      userMessage:
        "실패한 CodeTask가 있어 통합을 시작할 수 없습니다.\n먼저 실패 작업을 다시 실행해 주세요.",
      blockedUnitIds,
      blockedCodeTaskIds: [
        ...snapshot.units.filter((u) => u.displayStatus === "failed").map((u) => u.codeTaskId),
      ],
    };
  }

  if (snapshot.codeTask.inconsistent > 0) {
    return {
      canRun: false,
      reasonCode: "verification_inconsistent",
      userMessage: "미완료 또는 검증 대기 중인 CodeTask가 있어 통합을 시작할 수 없습니다.",
      blockedUnitIds,
      blockedCodeTaskIds: snapshot.codeTask.inconsistentCodeTaskIds,
    };
  }

  if (snapshot.integration.finalWiringStatus === "missing") {
    return {
      canRun: false,
      reasonCode: "integration_step_missing",
      userMessage: "통합 단계를 준비하지 못했습니다.\n잠시 후 다시 시도해 주세요.",
      blockedUnitIds: [],
      blockedCodeTaskIds: [],
    };
  }

  if (snapshot.integration.finalWiringStatus === "running") {
    return {
      canRun: false,
      reasonCode: "integration_already_running",
      userMessage: "최종 연결/통합 Wiring을 진행 중입니다.\n잠시만 기다려 주세요.",
      blockedUnitIds: [],
      blockedCodeTaskIds: [],
    };
  }

  if (button.enabled || gate.resolvedAction === "prepare_integration_preview") {
    return {
      canRun: true,
      reasonCode: "ready",
      userMessage: "",
      blockedUnitIds: [],
      blockedCodeTaskIds: [],
    };
  }

  const fallbackMessage =
    button.disabledReasonLines.join("\n").trim() ||
    snapshot.integration.disabledReason ||
    "통합을 시작할 수 없습니다.";
  return {
    canRun: false,
    reasonCode: "codetask_completion_required",
    userMessage: fallbackMessage,
    blockedUnitIds,
    blockedCodeTaskIds: gate.blockedDetails.map((row) => row.codeTaskId),
  };
}

export function mapEligibilityReasonToPipelineStatus(
  reasonCode: ProjectIntegrationPipelineEligibilityReasonCodeV1,
): "codetasks_incomplete" | "step_missing" {
  if (reasonCode === "integration_step_missing" || reasonCode === "integration_already_running") {
    return "step_missing";
  }
  return "codetasks_incomplete";
}
