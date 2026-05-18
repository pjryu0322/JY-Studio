/**
 * UI-ready view models for /execution (grouped, user-facing).
 * Business execution only — not Stage1/Stage2.
 */

import { EXECUTOR_TYPE_LABELS } from "@/lib/workflow/collaborationSessionResultStore";
import type { ExecutionPageActionState, PreExecutionSessionSelector } from "@/lib/workflow/businessExecutionSelectors";
import type { BusinessExecutionMonitoringState } from "@/lib/workflow/businessExecutionRunMonitoring";
import type { PreLaunchActionAvailability } from "@/lib/workflow/preLaunchActionModel";
import type { BusinessExecutionRunEvent } from "@/lib/workflow/businessExecutionRunEvent";
import type { BusinessExecutionRun } from "@/lib/workflow/businessExecutionRun";
import { resolveSessionBusinessExecutionRunEvents } from "@/lib/workflow/collaborationSessionResultStore";

export type ExecutionTone = "neutral" | "good" | "warn" | "bad";

export type ExecutionSummaryKpi = {
  label: string;
  value: string;
  tone?: ExecutionTone;
};

export type ExecutionPrimaryActionKey =
  | "openTasks"
  | "selectActiveInput"
  | "prepareHandoffPrepared"
  | "createExecutionRequestDraft"
  | "approveExecutionDraft"
  | "recordBusinessExecutionRequest"
  | "approveBusinessExecution"
  | "createBusinessExecutionPackage"
  | "assignExecutor"
  | "prepareExecutorHandoffPayload"
  | "prepareExecutorIntakeContract"
  | "prepareExecutorWorkOrder"
  | "declareLaunchIntent"
  | "prepareLaunchHandoffRecord"
  | "prepareExecutionBridge"
  | "prepareExecutorLaunchContract"
  | "markExecutionTriggerIntent"
  | "prepareActualExecutionAdapter"
  | "prepareActualLaunchCommand"
  | "startBusinessExecution"
  | "prepareExecutorIntegrationAdapter"
  | "runExecutorConnector"
  | "retryExecutorConnector"
  | "none";

export type ExecutionSummaryView = {
  hasSession: boolean;
  contextLine: string | null;
  kpis: ExecutionSummaryKpi[];
  primaryAction: {
    key: ExecutionPrimaryActionKey;
    label: string;
    disabled: boolean;
    note?: string | null;
  };
  nextActionNote: string | null;
};

export type ExecutionProgressRow = {
  title: string;
  statusLabel: string;
  tone: ExecutionTone;
  detail: string | null;
};

export type ExecutionProgressView = {
  executionRequest: ExecutionProgressRow;
  packageAndAssignment: ExecutionProgressRow;
  executionPreparation: ExecutionProgressRow;
};

export type ExecutionRunView = {
  canRetryBusinessRun: boolean;
  businessRunRetryBlocked: boolean;
  businessRunRetryLabel: string;
};

export type ExecutionConnectorView = {
  canInvokeConnector: boolean;
  canRetryConnector: boolean;
  connectorStaleNote: string | null;
};

/** @deprecated Prefer getExecutionRunView + getExecutionConnectorView */
export type ExecutionRunAndConnectorView = ExecutionRunView & ExecutionConnectorView;

export type ExecutionAdvancedArtifactsView = {
  handoffPayloadReady: boolean;
  intakeReady: boolean;
  workOrderReady: boolean;
  bridgeReady: boolean;
  launchContractReady: boolean;
  triggerIntentReady: boolean;
  adapterReady: boolean;
  launchCommandReady: boolean;
};

function toneForRunStatus(status: string | null | undefined): ExecutionTone {
  if (status === "completed") return "good";
  if (status === "failed") return "bad";
  if (status === "running") return "neutral";
  if (status === "accepted") return "neutral";
  if (status === "queued" || status === "idle") return "warn";
  return "warn";
}

function connectorStatusLabel(status: string | null | undefined) {
  if (!status) return "호출 안 함";
  if (status === "accepted") return "수락됨";
  if (status === "running") return "진행 중";
  if (status === "completed") return "완료";
  return "실패";
}

export function getExecutionRunTimelineViewState(input: {
  sessionId: string | null;
  run: BusinessExecutionRun | undefined;
  isRunCurrent: boolean;
  maxEvents?: number;
}): { events: BusinessExecutionRunEvent[] } {
  if (!input.sessionId || !input.run || !input.isRunCurrent) return { events: [] };
  const all = resolveSessionBusinessExecutionRunEvents(input.sessionId, input.run.runId);
  const max = input.maxEvents ?? 10;
  return { events: all.slice(Math.max(0, all.length - max)) };
}

function resolvePrimaryExecutionAction(input: {
  pre: PreExecutionSessionSelector;
  actions: ExecutionPageActionState;
  nextAction: PreLaunchActionAvailability;
}): ExecutionSummaryView["primaryAction"] {
  const { pre, actions, nextAction } = input;
  const snapshot = pre.snapshot;
  const isActive = pre.isSnapshotActive;
  const isHandoffPrepared = pre.isHandoffPreparedActive;
  const handoffValidity = pre.handoffValidity;
  const isDraftApproved = pre.isExecutionDraftApproved;

  if (!snapshot) return { key: "openTasks", label: "작업 화면 열기", disabled: false, note: "준비된 스냅샷이 아직 없습니다." };
  if (!isActive) return { key: "selectActiveInput", label: "활성 입력으로 선택", disabled: false, note: null };
  if (!isHandoffPrepared) {
    return {
      key: "prepareHandoffPrepared",
      label: nextAction.actionLabel,
      disabled: !nextAction.canPrepareLaunchAction,
      note: null,
    };
  }
  if (!pre.executionRequestDraft) {
    return {
      key: "createExecutionRequestDraft",
      label: "실행 요청 초안 만들기",
      disabled: !handoffValidity.isHandoffValid || !isHandoffPrepared,
      note: !handoffValidity.isHandoffValid ? "현재 스냅샷에 대해 인수가 유효하지 않습니다." : null,
    };
  }
  if (!isDraftApproved) {
    return {
      key: "approveExecutionDraft",
      label: "실행을 위해 승인",
      disabled: !handoffValidity.isHandoffValid,
      note: !handoffValidity.isHandoffValid ? "현재 스냅샷에 대해 인수가 유효하지 않습니다." : null,
    };
  }
  if (!pre.businessExecutionRequest) {
    return {
      key: "recordBusinessExecutionRequest",
      label: "실행 요청 작성",
      disabled: !actions.canRecordBusinessRequest,
      note: null,
    };
  }
  if (!pre.isBusinessExecutionApproved) {
    return {
      key: "approveBusinessExecution",
      label: "실행 요청 승인",
      disabled: !actions.canApproveBusinessExecution,
      note: null,
    };
  }
  if (!pre.isBusinessExecutionPackaged) {
    return {
      key: "createBusinessExecutionPackage",
      label: "실행 패키지 준비",
      disabled: !actions.canCreateBusinessPackage,
      note: null,
    };
  }
  if (!pre.isExecutionPackageAssigned) {
    return {
      key: "assignExecutor",
      label: "실행기 배정",
      disabled: !actions.canAssignExecutor,
      note: "이 패키지에 cursor_executor 또는 reviewer를 선택하세요.",
    };
  }
  if (!pre.isExecutionAssignmentHandoffCurrent) {
    return {
      key: "prepareExecutorHandoffPayload",
      label: "실행기 인수 준비",
      disabled: !actions.canCreateHandoffPayload,
      note: null,
    };
  }
  if (!pre.isExecutorIntakeContractCurrent) {
    return {
      key: "prepareExecutorIntakeContract",
      label: "실행기 입력 계약 준비",
      disabled: !actions.canCreateIntakeContract,
      note: null,
    };
  }
  if (!pre.isExecutorWorkOrderCurrent) {
    return {
      key: "prepareExecutorWorkOrder",
      label: "실행기 작업 지시 준비",
      disabled: !actions.canCreateWorkOrder,
      note: null,
    };
  }
  if (!pre.isBusinessLaunchIntentCurrent) {
    return {
      key: "declareLaunchIntent",
      label: "실행 의도 선언",
      disabled: !actions.canDeclareLaunchIntent,
      note:
        pre.executionReadiness.status !== "ready"
          ? "실행 의도를 선언하려면 실행 준비가 완료되어야 합니다."
          : null,
    };
  }
  if (!pre.isBusinessLaunchHandoffRecordCurrent) {
    return {
      key: "prepareLaunchHandoffRecord",
      label: "실행 인수 기록 준비",
      disabled: !actions.canRecordLaunchHandoff,
      note: null,
    };
  }
  if (!pre.isExecutionBridgePayloadCurrent) {
    return {
      key: "prepareExecutionBridge",
      label: "실행 브리지 준비",
      disabled: !actions.canPrepareExecutionBridge,
      note: null,
    };
  }
  if (!pre.isExecutorLaunchContractCurrent) {
    return {
      key: "prepareExecutorLaunchContract",
      label: "실행 계약 준비",
      disabled: !actions.canPrepareLaunchContract,
      note: null,
    };
  }
  if (!pre.isExecutionTriggerIntentCurrent) {
    return {
      key: "markExecutionTriggerIntent",
      label: "트리거 의도 선언",
      disabled: !actions.canDeclareExecutionTriggerIntent,
      note: null,
    };
  }
  if (!pre.isActualExecutionAdapterRequestCurrent) {
    return {
      key: "prepareActualExecutionAdapter",
      label: "실행 어댑터 준비",
      disabled: !actions.canPrepareExecutionAdapter,
      note: null,
    };
  }
  if (!pre.isActualLaunchCommandCurrent) {
    return {
      key: "prepareActualLaunchCommand",
      label: "실행 명령 준비",
      disabled: !actions.canPrepareLaunchCommand,
      note: null,
    };
  }
  if (!pre.isBusinessExecutionRunCurrent) {
    return {
      key: "startBusinessExecution",
      label: actions.invocationPrimaryLabel,
      disabled: !actions.canStartBusinessExecution,
      note: null,
    };
  }
  if (!pre.isExecutorIntegrationAdapterCurrent) {
    return {
      key: "prepareExecutorIntegrationAdapter",
      label: "통합 어댑터 준비",
      disabled: !actions.canPrepareExecutorIntegrationAdapter,
      note: null,
    };
  }
  if (actions.canRetryExecutorConnector) {
    return {
      key: "retryExecutorConnector",
      label: "연결기 다시 시도",
      disabled: false,
      note: null,
    };
  }
  if (!pre.isExecutorConnectorResultCurrent) {
    return {
      key: "runExecutorConnector",
      label: "연결기 호출",
      disabled: !actions.canInvokeExecutorConnector,
      note: null,
    };
  }
  return { key: "none", label: "최신 상태", disabled: true, note: "현재 세션 상태에 맞게 모두 반영되었습니다." };
}

export function getExecutionSummaryView(input: {
  sessionId: string | null;
  requirementId: string | null;
  pre: PreExecutionSessionSelector;
  monitoring: BusinessExecutionMonitoringState;
  actions: ExecutionPageActionState;
  nextAction: PreLaunchActionAvailability;
}): ExecutionSummaryView {
  const { sessionId, requirementId, pre, monitoring, actions, nextAction } = input;

  const currentExecutorType =
    monitoring.view?.executorType ??
    pre.executorConnectorResult?.executorType ??
    pre.executorIntegrationAdapter?.executorType ??
    pre.businessExecutionRun?.executorType ??
    pre.actualLaunchCommand?.executorType ??
    pre.executionAssignment?.executorType ??
    null;

  const connectorLabel = connectorStatusLabel(pre.executorConnectorResult?.status);
  const runLabel = monitoring.view ? monitoring.view.progressLabel : pre.isBusinessExecutionRunCurrent ? "실행 있음" : "실행 없음";

  const kpis: ExecutionSummaryKpi[] = [
    { label: "실행기", value: currentExecutorType ? EXECUTOR_TYPE_LABELS[currentExecutorType] : "(미배정)" },
    { label: "준비도", value: pre.launchReadiness.isLaunchReady ? "준비됨" : "미준비", tone: pre.launchReadiness.isLaunchReady ? "good" : "warn" },
    { label: "실행", value: runLabel, tone: toneForRunStatus(monitoring.view?.status ?? null) },
    { label: "연결기", value: connectorLabel, tone: toneForRunStatus(pre.executorConnectorResult?.status ?? null) },
  ];

  const nextActionNote = nextAction.actionReason ? `다음 동작 안내: ${nextAction.actionReason}` : null;

  if (!sessionId) {
    return {
      hasSession: false,
      contextLine: null,
      kpis,
      primaryAction: { key: "openTasks", label: "작업 화면 열기", disabled: false, note: "실행 상태를 보려면 세션을 선택하세요." },
      nextActionNote,
    };
  }

  const primaryAction = resolvePrimaryExecutionAction({ pre, actions, nextAction });

  return {
    hasSession: true,
    contextLine: `세션 ${sessionId} · 요구사항 ${requirementId ?? "없음"}`,
    kpis,
    primaryAction,
    nextActionNote,
  };
}

export function getExecutionProgressView(pre: PreExecutionSessionSelector, actions: ExecutionPageActionState): ExecutionProgressView {
  const requestDone = pre.isBusinessExecutionApproved && actions.businessRequestValid;
  const requestInProgress =
    !requestDone && (Boolean(pre.executionRequestDraft) || Boolean(pre.businessExecutionRequest) || pre.isHandoffPreparedActive);
  const executionRequest: ExecutionProgressRow = requestDone
    ? {
        title: "실행 요청",
        statusLabel: "완료",
        tone: "good",
        detail: "이 스냅샷에 대해 요청이 기록되고 승인되었습니다.",
      }
    : requestInProgress
      ? {
          title: "실행 요청",
          statusLabel: "진행 중",
          tone: "warn",
          detail: actions.businessRequestNeedsAttention
            ? "작업을 갱신하거나 요청이 오래되었거나 유효하지 않으면 다시 작성하세요."
            : "초안, 체크포인트, 비즈니스 승인을 마치세요.",
        }
      : {
          title: "실행 요청",
          statusLabel: "시작 전",
          tone: "neutral",
          detail: "작업 화면에서 인수를 준비한 뒤, 여기서 요청을 만들고 승인하세요.",
        };

  const pkgDone = pre.isExecutionPackageAssigned;
  const pkgInProgress = !pkgDone && pre.isBusinessExecutionPackaged;
  const packageAndAssignment: ExecutionProgressRow = !requestDone
    ? { title: "패키지·배정", statusLabel: "차단됨", tone: "neutral", detail: "먼저 실행 요청을 완료하세요." }
    : pkgDone
      ? { title: "패키지·배정", statusLabel: "완료", tone: "good", detail: "작업 패키지가 있고 실행기가 배정되었습니다." }
      : pkgInProgress
        ? { title: "패키지·배정", statusLabel: "진행 중", tone: "warn", detail: "패키지가 준비됨 — 누가 실행할지 배정하세요." }
        : {
            title: "패키지·배정",
            statusLabel: "시작 전",
            tone: "warn",
            detail: "승인 후 실행 패키지를 만드세요.",
          };

  const prepDone = pre.isActualLaunchCommandCurrent;
  const prepStarted = !prepDone && (pre.isExecutorWorkOrderCurrent || pre.isBusinessLaunchIntentCurrent || pre.isExecutionBridgePayloadCurrent);
  const executionPreparation: ExecutionProgressRow = !pkgDone
    ? { title: "실행 준비", statusLabel: "차단됨", tone: "neutral", detail: "먼저 패키지와 배정을 완료하세요." }
    : prepDone
      ? { title: "실행 준비", statusLabel: "완료", tone: "good", detail: "비즈니스 실행을 위한 실행 입력이 준비되었습니다." }
      : prepStarted
        ? {
            title: "실행 준비",
            statusLabel: "진행 중",
            tone: "warn",
            detail: "아래 실행 준비 섹션에서 남은 단계를 완료하세요.",
          }
        : {
            title: "실행 준비",
            statusLabel: "시작 전",
            tone: "warn",
            detail: "배정 후 준비 체인을 따라 실행기 입력을 준비하세요.",
          };

  return { executionRequest, packageAndAssignment, executionPreparation };
}

export function getExecutionRunView(actions: ExecutionPageActionState): ExecutionRunView {
  return {
    canRetryBusinessRun: actions.canStartBusinessExecution,
    businessRunRetryBlocked: actions.blockedByActiveBusinessRun,
    businessRunRetryLabel: actions.invocationPrimaryLabel,
  };
}

export function getExecutionConnectorView(actions: ExecutionPageActionState): ExecutionConnectorView {
  return {
    canInvokeConnector: actions.canInvokeExecutorConnector,
    canRetryConnector: actions.canRetryExecutorConnector,
    connectorStaleNote: actions.hasStaleExecutorConnectorResult
      ? "저장된 연결기 결과가 현재 통합 어댑터와 일치하지 않습니다. 어댑터를 최신으로 맞춘 뒤 다시 호출하세요."
      : null,
  };
}

export function getExecutionRunAndConnectorView(actions: ExecutionPageActionState): ExecutionRunAndConnectorView {
  return { ...getExecutionRunView(actions), ...getExecutionConnectorView(actions) };
}

export function getExecutionAdvancedArtifactsView(pre: PreExecutionSessionSelector): ExecutionAdvancedArtifactsView {
  return {
    handoffPayloadReady: pre.isExecutionAssignmentHandoffCurrent,
    intakeReady: pre.isExecutorIntakeContractCurrent,
    workOrderReady: pre.isExecutorWorkOrderCurrent,
    bridgeReady: pre.isExecutionBridgePayloadCurrent,
    launchContractReady: pre.isExecutorLaunchContractCurrent,
    triggerIntentReady: pre.isExecutionTriggerIntentCurrent,
    adapterReady: pre.isActualExecutionAdapterRequestCurrent,
    launchCommandReady: pre.isActualLaunchCommandCurrent,
  };
}

export function getExecutionRunMonitoringMeta(input: {
  sessionId: string | null;
  monitoring: BusinessExecutionMonitoringState;
  timeline: { events: BusinessExecutionRunEvent[] };
}) {
  const { sessionId, monitoring, timeline } = input;
  return {
    hasSession: Boolean(sessionId),
    hasCurrentRun: Boolean(monitoring.view),
    hasPreviousRun: Boolean(monitoring.staleRunView),
    recentEvents: timeline.events,
  };
}

export type ExecutionPageViews = {
  summary: ExecutionSummaryView;
  progress: ExecutionProgressView;
  run: ExecutionRunView;
  connector: ExecutionConnectorView;
  /** Composite of run + connector for convenience */
  runAndConnector: ExecutionRunAndConnectorView;
  advanced: ExecutionAdvancedArtifactsView;
  runMeta: ReturnType<typeof getExecutionRunMonitoringMeta>;
};

export function buildExecutionPageViews(input: {
  sessionId: string | null;
  requirementId: string | null;
  pre: PreExecutionSessionSelector;
  monitoring: BusinessExecutionMonitoringState;
  actions: ExecutionPageActionState;
  nextAction: PreLaunchActionAvailability;
  timeline: { events: BusinessExecutionRunEvent[] };
}): ExecutionPageViews {
  const run = getExecutionRunView(input.actions);
  const connector = getExecutionConnectorView(input.actions);
  return {
    summary: getExecutionSummaryView({
      sessionId: input.sessionId,
      requirementId: input.requirementId,
      pre: input.pre,
      monitoring: input.monitoring,
      actions: input.actions,
      nextAction: input.nextAction,
    }),
    progress: getExecutionProgressView(input.pre, input.actions),
    run,
    connector,
    runAndConnector: { ...run, ...connector },
    advanced: getExecutionAdvancedArtifactsView(input.pre),
    runMeta: getExecutionRunMonitoringMeta({
      sessionId: input.sessionId,
      monitoring: input.monitoring,
      timeline: input.timeline,
    }),
  };
}
