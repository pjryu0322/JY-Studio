import type { ImplementationCodeTaskSelectionSummaryV1 } from "@/lib/prototype/implementationCodeTaskBoardState";
import {
  isBoardSummaryReadyForIntegrationMerge,
  logIntegrationReadyPartialCoverageWarning,
} from "@/lib/prototype/implementationBoardIntegrationGatePolicy";
import type { IntegrationGateBlockedDetailV1 } from "@/lib/prototype/implementationIntegrationBoardGateSummary";

export const INTEGRATION_PREPARE_INTEGRATION_PREVIEW_LABEL = "통합 및 Preview 준비" as const;
export const INTEGRATION_OPEN_PREVIEW_LABEL = "Preview 보기" as const;

export const INTEGRATION_NO_COMPLETED_TARGETS_USER_MESSAGE =
  "통합 가능한 완료 작업이 없습니다." as const;

export const INTEGRATION_NO_INTEGRATION_READY_USER_MESSAGE =
  "통합 가능한 완료 CodeTask가 없습니다. GitHub commit 확인이 완료된 CodeTask가 필요합니다." as const;

export const INTEGRATION_BLOCKED_BY_RUNNABLE_USER_MESSAGE =
  "실행 가능한 미완료 CodeTask가 있습니다. 먼저 CodeTask 실행을 완료해 주세요." as const;

export const INTEGRATION_FINAL_WIRING_NOT_READY_USER_MESSAGE =
  "통합 작업 준비가 완료되지 않았습니다. 상세 로그를 확인해 주세요." as const;

export const INTEGRATION_PIPELINE_START_SUCCESS_TOAST =
  "통합 및 Preview 준비를 시작했습니다." as const;

export const INTEGRATION_PIPELINE_FAILED_USER_MESSAGE =
  "통합 처리 중 오류가 발생했습니다. 상세 로그를 확인해 주세요." as const;

export type IntegrationGateBlockedApiSummaryV1 = Readonly<{
  readonly runnableCount: number;
  readonly integrationReadyCount: number;
  readonly verifiedCount: number;
  readonly completedCount: number;
  readonly totalCount: number;
  readonly selectedCount: number;
}>;

export function buildIntegrationGateBlockedApiSummary(
  summary: ImplementationCodeTaskSelectionSummaryV1,
  input?: Readonly<{ readonly verifiedCount?: number; readonly completedCount?: number }>,
): IntegrationGateBlockedApiSummaryV1 {
  return {
    runnableCount: summary.runnableCount,
    integrationReadyCount: summary.integrationReadyCount,
    verifiedCount: input?.verifiedCount ?? summary.integrationReadyCount,
    completedCount: input?.completedCount ?? summary.integrationReadyCount,
    totalCount: summary.totalCount,
    selectedCount: summary.selectedRunnableCount,
  };
}

export function buildIntegrationGateBlockedApiBody(input: {
  readonly blockReason: Exclude<IntegrationButtonGateBlockReasonV1, null | "stale_summary_detected">;
  readonly summary: ImplementationCodeTaskSelectionSummaryV1;
  readonly userMessage: string;
  readonly verifiedCount?: number;
  readonly completedCount?: number;
}): Readonly<{
  readonly ok: false;
  readonly success: false;
  readonly status: "board_gate_blocked";
  readonly previewReady: false;
  readonly blockReason: Exclude<IntegrationButtonGateBlockReasonV1, null | "stale_summary_detected">;
  readonly message: string;
  readonly summary: IntegrationGateBlockedApiSummaryV1;
}> {
  return {
    ok: false,
    success: false,
    status: "board_gate_blocked",
    previewReady: false,
    blockReason: input.blockReason,
    message: input.userMessage,
    summary: buildIntegrationGateBlockedApiSummary(input.summary, {
      verifiedCount: input.verifiedCount,
      completedCount: input.completedCount,
    }),
  };
}

export type IntegrationButtonGateBlockReasonV1 =
  | "runnable_tasks_exist"
  | "no_integration_ready_units"
  | "final_wiring_not_ready"
  | "target_repository_missing"
  | "stale_summary_detected"
  | null;

export {
  isFinalWiringStepReadyForIntegrationButton,
  type FinalWiringReadyReasonV1,
} from "@/lib/prototype/implementationFinalWiringReadyResolver";

export function evaluateIntegrationButtonGate(input: {
  readonly summary: ImplementationCodeTaskSelectionSummaryV1;
  readonly finalWiringReady: boolean;
  readonly finalWiringReadyReason?: string | null;
  readonly selectedCount?: number;
  readonly completedCount?: number;
  readonly verifiedCount?: number;
  readonly clientSummary?: ImplementationCodeTaskSelectionSummaryV1 | null;
  readonly projectId?: string | null;
  readonly countSummary?: Pick<
    import("@/lib/prototype/implementationIntegrationCountSummary").ImplementationIntegrationCountSummaryV1,
    "executableCodeTaskCount" | "totalOrchestrationUnitCount" | "integrationTaskCount"
  > | null;
}): Readonly<{
  readonly canRun: boolean;
  readonly blockReason: IntegrationButtonGateBlockReasonV1;
  readonly userMessage: string | null;
  readonly integrationReadyCodeTaskIds: readonly string[];
}> {
  const integrationReadyCodeTaskIds = [
    ...new Set(input.summary.integrationReadyCodeTaskIds.map((id) => id.trim()).filter(Boolean)),
  ];
  const staleDetected =
    input.clientSummary != null && !isSameBoardGateSummary(input.clientSummary, input.summary);

  let blockReason: IntegrationButtonGateBlockReasonV1 = null;
  let userMessage: string | null = null;

  if (input.summary.runnableCount > 0) {
    blockReason = "runnable_tasks_exist";
    userMessage = INTEGRATION_BLOCKED_BY_RUNNABLE_USER_MESSAGE;
  } else if (integrationReadyCodeTaskIds.length === 0 || input.summary.integrationReadyCount === 0) {
    blockReason = "no_integration_ready_units";
    userMessage = INTEGRATION_NO_INTEGRATION_READY_USER_MESSAGE;
  } else if (!input.finalWiringReady) {
    blockReason = "final_wiring_not_ready";
    userMessage = INTEGRATION_FINAL_WIRING_NOT_READY_USER_MESSAGE;
  }

  const canRun = blockReason == null;

  if (canRun) {
    logIntegrationReadyPartialCoverageWarning({
      projectId: input.projectId,
      summary: input.summary,
      countSummary: input.countSummary,
    });
  }

  logIntegrationButtonGateEvaluated({
    projectId: input.projectId,
    summary: input.summary,
    selectedCount: input.selectedCount ?? input.summary.selectedRunnableCount,
    completedCount: input.completedCount,
    verifiedCount: input.verifiedCount ?? input.summary.integrationReadyCount,
    finalWiringReady: input.finalWiringReady,
    finalWiringReadyReason: input.finalWiringReadyReason ?? null,
    blockReason: canRun && staleDetected ? "stale_summary_detected" : blockReason,
    canRun,
    staleDetected,
  });

  if (canRun && staleDetected) {
    console.info(
      JSON.stringify({
        action: "implementation_integration_button_gate_stale_client_summary",
        projectId: input.projectId ?? null,
        message: "Authoritative board gate used; client summary differed",
      }),
    );
  }

  return { canRun, blockReason, userMessage, integrationReadyCodeTaskIds };
}

export function logIntegrationButtonGateEvaluated(input: {
  readonly projectId?: string | null;
  readonly summary: ImplementationCodeTaskSelectionSummaryV1;
  readonly selectedCount?: number;
  readonly completedCount?: number;
  readonly verifiedCount?: number;
  readonly finalWiringReady: boolean;
  readonly finalWiringReadyReason?: string | null;
  readonly blockReason: IntegrationButtonGateBlockReasonV1;
  readonly canRun: boolean;
  readonly staleDetected?: boolean;
}): void {
  if (typeof console === "undefined" || !console.info) return;
  const payload = {
    action: input.canRun
      ? "implementation_integration_button_gate_evaluated"
      : "implementation_integration_button_gate_blocked",
    projectId: input.projectId ?? null,
    runnableCount: input.summary.runnableCount,
    selectedCount: input.selectedCount ?? input.summary.selectedRunnableCount,
    completedCount: input.completedCount ?? null,
    verifiedCount: input.verifiedCount ?? input.summary.integrationReadyCount,
    integrationReadyCount: input.summary.integrationReadyCount,
    finalWiringReady: input.finalWiringReady,
    finalWiringReadyReason: input.finalWiringReadyReason ?? null,
    blockReason: input.blockReason,
    staleSummaryDetected: input.staleDetected === true,
  };
  console.info(JSON.stringify(payload));
}

export function logIntegrationButtonClicked(input: {
  readonly projectId?: string | null;
  readonly clientSummary?: Pick<
    ImplementationCodeTaskSelectionSummaryV1,
    "runnableCount" | "selectedRunnableCount" | "integrationReadyCount" | "totalCount"
  > | null;
  readonly clientFinalWiringReady?: boolean | null;
  readonly skipReason?: string | null;
}): void {
  if (typeof console === "undefined" || !console.info) return;
  const client = input.clientSummary;
  console.info(
    JSON.stringify({
      action: "implementation_integration_button_clicked",
      projectId: input.projectId ?? null,
      skipReason: input.skipReason ?? null,
      clientRunnableCount: client?.runnableCount ?? null,
      clientSelectedCount: client?.selectedRunnableCount ?? null,
      clientIntegrationReadyCount: client?.integrationReadyCount ?? null,
      clientTotalCount: client?.totalCount ?? null,
      clientFinalWiringReady: input.clientFinalWiringReady ?? null,
    }),
  );
}

export type IntegrationPrepareGateResolutionV1 =
  | "prepare_integration_preview"
  | "blocked_runnable_tasks"
  | "blocked_no_integration_ready";

export function isSameBoardGateSummary(
  a: ImplementationCodeTaskSelectionSummaryV1,
  b: ImplementationCodeTaskSelectionSummaryV1,
): boolean {
  const sortIds = (ids: readonly string[]) => [...ids].map((id) => id.trim()).filter(Boolean).sort();
  return (
    a.totalCount === b.totalCount &&
    a.runnableCount === b.runnableCount &&
    a.integrationReadyCount === b.integrationReadyCount &&
    a.selectedRunnableCount === b.selectedRunnableCount &&
    JSON.stringify(sortIds(a.integrationReadyCodeTaskIds)) ===
      JSON.stringify(sortIds(b.integrationReadyCodeTaskIds)) &&
    JSON.stringify(sortIds(a.selectedRunnableCodeTaskIds)) ===
      JSON.stringify(sortIds(b.selectedRunnableCodeTaskIds))
  );
}

export type ExtendedBoardGateSummaryV1 = ImplementationCodeTaskSelectionSummaryV1 &
  Readonly<{
    readonly runnableCodeTaskIds?: readonly string[];
    readonly blockedDetails?: readonly IntegrationGateBlockedDetailV1[];
  }>;

export function buildBoardGateMismatchLogFields(input: {
  readonly client: ExtendedBoardGateSummaryV1 | null;
  readonly server: ExtendedBoardGateSummaryV1;
}): Record<string, unknown> {
  const sortIds = (ids: readonly string[]) => [...ids].map((id) => id.trim()).filter(Boolean).sort();
  const client = input.client;
  const server = input.server;
  const clientRunnableIds = client?.runnableCodeTaskIds ?? null;
  const serverRunnableIds = server.runnableCodeTaskIds ?? [];
  const clientBlockedIds = client?.blockedDetails?.map((d) => d.codeTaskId.trim()).filter(Boolean) ?? null;
  const serverBlockedIds = server.blockedDetails?.map((d) => d.codeTaskId.trim()).filter(Boolean) ?? [];

  return {
    summariesMatch: client ? isSameBoardGateSummary(client, server) : null,
    clientTotalCount: client?.totalCount ?? null,
    serverTotalCount: server.totalCount,
    clientRunnableCount: client?.runnableCount ?? null,
    serverRunnableCount: server.runnableCount,
    clientIntegrationReadyCount: client?.integrationReadyCount ?? null,
    serverIntegrationReadyCount: server.integrationReadyCount,
    clientSelectedRunnableCount: client?.selectedRunnableCount ?? null,
    serverSelectedRunnableCount: server.selectedRunnableCount,
    clientSelectedRunnableCodeTaskIds: client?.selectedRunnableCodeTaskIds ?? null,
    serverSelectedRunnableCodeTaskIds: server.selectedRunnableCodeTaskIds,
    clientIntegrationReadyCodeTaskIds: client?.integrationReadyCodeTaskIds ?? null,
    serverIntegrationReadyCodeTaskIds: server.integrationReadyCodeTaskIds,
    clientRunnableCodeTaskIds: clientRunnableIds,
    serverRunnableCodeTaskIds: serverRunnableIds,
    runnableCodeTaskIdsMatch:
      clientRunnableIds == null
        ? null
        : JSON.stringify(sortIds(clientRunnableIds)) === JSON.stringify(sortIds(serverRunnableIds)),
    clientBlockedCodeTaskIds: clientBlockedIds,
    serverBlockedCodeTaskIds: serverBlockedIds,
    blockedCodeTaskIdsMatch:
      clientBlockedIds == null
        ? null
        : JSON.stringify(sortIds(clientBlockedIds)) === JSON.stringify(sortIds(serverBlockedIds)),
  };
}

export type ImplementationIntegrationControlGateActionV1 =
  | "prepare_integration_preview"
  | "open_preview"
  | "blocked";

export function resolveImplementationIntegrationControlGate(input: {
  readonly summary: ImplementationCodeTaskSelectionSummaryV1;
  readonly previewReady?: boolean;
  readonly actualPreviewUrl?: string | null;
  readonly blockedDetails?: readonly IntegrationGateBlockedDetailV1[];
  readonly runnableCodeTaskIds?: readonly string[];
  readonly projectId?: string | null;
}): Readonly<{
  readonly action: ImplementationIntegrationControlGateActionV1;
  readonly enabled: boolean;
  readonly label: string;
  readonly userMessage: string | null;
  readonly disabledReason: string | null;
  readonly targetCodeTaskIds: readonly string[];
}> {
  const previewReady = input.previewReady === true;
  const previewUrl = String(input.actualPreviewUrl ?? "").trim();
  if (previewReady && previewUrl) {
    return {
      action: "open_preview",
      enabled: true,
      label: INTEGRATION_OPEN_PREVIEW_LABEL,
      userMessage: null,
      disabledReason: null,
      targetCodeTaskIds: [],
    };
  }

  const gate = evaluateIntegrationPrepareGateFromBoardSummary(input.summary, {
    blockedDetails: input.blockedDetails,
    runnableCodeTaskIds: input.runnableCodeTaskIds,
    projectId: input.projectId,
  });

  if (gate.ok) {
    return {
      action: "prepare_integration_preview",
      enabled: true,
      label: INTEGRATION_PREPARE_INTEGRATION_PREVIEW_LABEL,
      userMessage: null,
      disabledReason: null,
      targetCodeTaskIds: gate.integrationReadyCodeTaskIds,
    };
  }

  return {
    action: "blocked",
    enabled: false,
    label: INTEGRATION_PREPARE_INTEGRATION_PREVIEW_LABEL,
    userMessage: gate.message,
    disabledReason: gate.message,
    targetCodeTaskIds: gate.integrationReadyCodeTaskIds,
  };
}

export function evaluateIntegrationPrepareGateFromBoardSummary(
  summary: ImplementationCodeTaskSelectionSummaryV1,
  input?: Readonly<{
    readonly blockedDetails?: readonly IntegrationGateBlockedDetailV1[];
    readonly runnableCodeTaskIds?: readonly string[];
    readonly projectId?: string | null;
    readonly countSummary?: Pick<
      import("@/lib/prototype/implementationIntegrationCountSummary").ImplementationIntegrationCountSummaryV1,
      "executableCodeTaskCount" | "totalOrchestrationUnitCount" | "integrationTaskCount"
    > | null;
  }>,
): Readonly<{
  readonly ok: boolean;
  readonly message: string | null;
  readonly resolvedAction: IntegrationPrepareGateResolutionV1;
  readonly integrationReadyCodeTaskIds: readonly string[];
  readonly blockedCodeTaskIds: readonly string[];
  readonly blockedDetails: readonly IntegrationGateBlockedDetailV1[];
}> {
  const integrationReadyCodeTaskIds = [
    ...new Set(summary.integrationReadyCodeTaskIds.map((id) => id.trim()).filter(Boolean)),
  ];
  const blockedDetails = input?.blockedDetails ?? [];
  const notReadyIds = blockedDetails.map((row) => row.codeTaskId.trim()).filter(Boolean);

  let resolvedAction: IntegrationPrepareGateResolutionV1 = "prepare_integration_preview";
  let ok =
    isBoardSummaryReadyForIntegrationMerge(summary) && integrationReadyCodeTaskIds.length > 0;
  let message: string | null = null;
  let blockedCodeTaskIds: readonly string[] = [];

  if (ok) {
    logIntegrationReadyPartialCoverageWarning({
      projectId: input?.projectId,
      summary,
      countSummary: input?.countSummary,
    });
  } else if (summary.runnableCount > 0) {
    resolvedAction = "blocked_runnable_tasks";
    ok = false;
    message = INTEGRATION_BLOCKED_BY_RUNNABLE_USER_MESSAGE;
    blockedCodeTaskIds =
      input?.runnableCodeTaskIds?.length
        ? [...input.runnableCodeTaskIds]
        : notReadyIds.filter((id) => !integrationReadyCodeTaskIds.includes(id));
  } else if (integrationReadyCodeTaskIds.length === 0) {
    resolvedAction = "blocked_no_integration_ready";
    ok = false;
    message = INTEGRATION_NO_INTEGRATION_READY_USER_MESSAGE;
    blockedCodeTaskIds = notReadyIds;
  }

  if (typeof console !== "undefined" && console.info) {
    console.info(
      JSON.stringify({
        action: ok ? "integration_gate_evaluated" : "integration_gate_blocked",
        projectId: input?.projectId ?? null,
        runnableCount: summary.runnableCount,
        integrationReadyCount: summary.integrationReadyCount,
        integrationReadyCodeTaskIds,
        blockedCodeTaskIds,
        ...(ok
          ? { resolvedAction }
          : {
              reason:
                resolvedAction === "blocked_runnable_tasks"
                  ? "unfinished_or_pending_verification"
                  : "no_integration_ready_tasks",
              blockedDetails,
            }),
      }),
    );
  }

  return {
    ok,
    message,
    resolvedAction,
    integrationReadyCodeTaskIds,
    blockedCodeTaskIds,
    blockedDetails,
  };
}

/** @deprecated Use evaluatePrepareIntegrationPreviewStartGate instead. */
export function evaluateIntegrationBlockedByRunnableBoardSummary(
  summary: Pick<ImplementationCodeTaskSelectionSummaryV1, "runnableCount">,
): Readonly<{ readonly ok: boolean; readonly message: string | null }> {
  void summary;
  return { ok: true, message: null };
}

export function evaluatePrepareIntegrationPreviewStartGate(
  summary: Pick<
    ImplementationCodeTaskSelectionSummaryV1,
    "totalCount" | "runnableCount" | "integrationReadyCount" | "integrationReadyCodeTaskIds"
  >,
): Readonly<{ readonly ok: boolean; readonly message: string | null; readonly codeTaskIds: readonly string[] }> {
  const gate = evaluateIntegrationPrepareGateFromBoardSummary({
    totalCount: summary.totalCount,
    runnableCount: summary.runnableCount,
    selectedRunnableCount: 0,
    selectedRunnableCodeTaskIds: [],
    integrationReadyCount: summary.integrationReadyCount,
    integrationReadyCodeTaskIds: summary.integrationReadyCodeTaskIds,
  });
  return {
    ok: gate.ok,
    message: gate.message,
    codeTaskIds: gate.integrationReadyCodeTaskIds,
  };
}

export function logPrepareIntegrationPreviewStarted(input: {
  readonly projectId?: string | null;
  readonly integrationTargetCount: number;
  readonly integrationCodeTaskIds: readonly string[];
}): void {
  if (typeof console === "undefined" || !console.info) return;
  console.info(
    JSON.stringify({
      action: "prepare_integration_preview_started",
      projectId: input.projectId ?? null,
      integrationTargetCount: input.integrationTargetCount,
      integrationCodeTaskIds: input.integrationCodeTaskIds,
    }),
  );
}

export function logIntegrationPrepareStarted(input: {
  readonly projectId?: string | null;
  readonly integrationCodeTaskCount: number;
  readonly integrationCodeTaskIds: readonly string[];
}): void {
  if (typeof console === "undefined" || !console.info) return;
  console.info(
    JSON.stringify({
      action: "integration_prepare_started",
      projectId: input.projectId ?? null,
      integrationCodeTaskCount: input.integrationCodeTaskCount,
      integrationCodeTaskIds: input.integrationCodeTaskIds,
    }),
  );
}