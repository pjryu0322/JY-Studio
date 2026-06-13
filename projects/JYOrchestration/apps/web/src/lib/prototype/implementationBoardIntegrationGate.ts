import type { ImplementationCodeTaskSelectionSummaryV1 } from "@/lib/prototype/implementationCodeTaskBoardState";
import { INTEGRATION_STRICT_GATE_INCOMPLETE_USER_MESSAGE } from "@/lib/prototype/implementationIntegrationGate";
import type { IntegrationGateBlockedDetailV1 } from "@/lib/prototype/implementationIntegrationBoardGateSummary";

export const INTEGRATION_PREPARE_INTEGRATION_PREVIEW_LABEL = "통합 및 Preview 준비" as const;
export const INTEGRATION_OPEN_PREVIEW_LABEL = "Preview 보기" as const;

export const INTEGRATION_NO_COMPLETED_TARGETS_USER_MESSAGE =
  "통합 가능한 완료 작업이 없습니다." as const;

export const INTEGRATION_BLOCKED_BY_RUNNABLE_USER_MESSAGE =
  "실행 가능한 미완료 작업이 있습니다. 먼저 선택 작업 실행을 완료해 주세요." as const;

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
  let ok = true;
  let message: string | null = null;
  let blockedCodeTaskIds: readonly string[] = [];

  if (summary.runnableCount > 0) {
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
    message = INTEGRATION_NO_COMPLETED_TARGETS_USER_MESSAGE;
    blockedCodeTaskIds = notReadyIds;
  } else if (summary.integrationReadyCount < summary.totalCount) {
    resolvedAction = "blocked_no_integration_ready";
    ok = false;
    message = INTEGRATION_STRICT_GATE_INCOMPLETE_USER_MESSAGE;
    blockedCodeTaskIds = notReadyIds.length > 0 ? notReadyIds : [];
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