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
  | "startBusinessExecution"
  | "prepareExecutorIntegrationAdapter"
  | "runExecutorConnector"
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

export type ExecutionRunAndConnectorView = {
  canRetryBusinessRun: boolean;
  businessRunRetryBlocked: boolean;
  businessRunRetryLabel: string;
  canInvokeConnector: boolean;
  canRetryConnector: boolean;
  connectorStaleNote: string | null;
};

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
  if (!status) return "Not invoked";
  if (status === "accepted") return "Accepted";
  if (status === "running") return "Running";
  if (status === "completed") return "Completed";
  return "Failed";
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

export function getExecutionSummaryView(input: {
  sessionId: string | null;
  requirementId: string | null;
  pre: PreExecutionSessionSelector;
  monitoring: BusinessExecutionMonitoringState;
  actions: ExecutionPageActionState;
  nextAction: PreLaunchActionAvailability;
}): ExecutionSummaryView {
  const { sessionId, requirementId, pre, monitoring, actions, nextAction } = input;

  const snapshot = pre.snapshot;
  const isActive = pre.isSnapshotActive;
  const isHandoffPrepared = pre.isHandoffPreparedActive;
  const handoffValidity = pre.handoffValidity;
  const isDraftApproved = pre.isExecutionDraftApproved;

  const currentExecutorType =
    monitoring.view?.executorType ??
    pre.executorConnectorResult?.executorType ??
    pre.executorIntegrationAdapter?.executorType ??
    pre.businessExecutionRun?.executorType ??
    pre.actualLaunchCommand?.executorType ??
    pre.executionAssignment?.executorType ??
    null;

  const connectorLabel = connectorStatusLabel(pre.executorConnectorResult?.status);
  const runLabel = monitoring.view ? monitoring.view.progressLabel : pre.isBusinessExecutionRunCurrent ? "Run exists" : "No run";

  const kpis: ExecutionSummaryKpi[] = [
    { label: "Executor", value: currentExecutorType ? EXECUTOR_TYPE_LABELS[currentExecutorType] : "(unassigned)" },
    { label: "Readiness", value: pre.launchReadiness.isLaunchReady ? "Ready" : "Not ready", tone: pre.launchReadiness.isLaunchReady ? "good" : "warn" },
    { label: "Run", value: runLabel, tone: toneForRunStatus(monitoring.view?.status ?? null) },
    { label: "Connector", value: connectorLabel, tone: toneForRunStatus(pre.executorConnectorResult?.status ?? null) },
  ];

  const nextActionNote = nextAction.actionReason ? `Next action note: ${nextAction.actionReason}` : null;

  if (!sessionId) {
    return {
      hasSession: false,
      contextLine: null,
      kpis,
      primaryAction: { key: "openTasks", label: "Open Tasks workspace", disabled: false, note: "Select a session to view execution status." },
      nextActionNote,
    };
  }

  const primaryAction: ExecutionSummaryView["primaryAction"] = !snapshot
    ? { key: "openTasks", label: "Open Tasks workspace", disabled: false, note: "No prepared snapshot yet." }
    : !isActive
      ? { key: "selectActiveInput", label: "Select as active input", disabled: false, note: null }
      : !isHandoffPrepared
        ? {
            key: "prepareHandoffPrepared",
            label: nextAction.actionLabel,
            disabled: !nextAction.canPrepareLaunchAction,
            note: null,
          }
        : !pre.executionRequestDraft
          ? {
              key: "createExecutionRequestDraft",
              label: "Create execution draft",
              disabled: !handoffValidity.isHandoffValid || !isHandoffPrepared,
              note: !handoffValidity.isHandoffValid ? "Handoff is not valid for the current snapshot." : null,
            }
          : !isDraftApproved
            ? {
                key: "approveExecutionDraft",
                label: "Approve for launch",
                disabled: !handoffValidity.isHandoffValid,
                note: !handoffValidity.isHandoffValid ? "Handoff is not valid for the current snapshot." : null,
              }
            : !pre.businessExecutionRequest
              ? {
                  key: "recordBusinessExecutionRequest",
                  label: "Create execution request",
                  disabled: !actions.canRecordBusinessRequest,
                  note: null,
                }
              : !pre.isBusinessExecutionApproved
                ? {
                    key: "approveBusinessExecution",
                    label: "Approve execution request",
                    disabled: !actions.canApproveBusinessExecution,
                    note: null,
                  }
                : !pre.isBusinessExecutionPackaged
                  ? {
                      key: "createBusinessExecutionPackage",
                      label: "Prepare execution package",
                      disabled: !actions.canCreateBusinessPackage,
                      note: null,
                    }
                  : !pre.isBusinessExecutionRunCurrent
                    ? {
                        key: "startBusinessExecution",
                        label: actions.invocationPrimaryLabel,
                        disabled: !actions.canStartBusinessExecution,
                        note: null,
                      }
                    : !pre.isExecutorIntegrationAdapterCurrent
                      ? {
                          key: "prepareExecutorIntegrationAdapter",
                          label: "Prepare integration adapter",
                          disabled: !actions.canPrepareExecutorIntegrationAdapter,
                          note: null,
                        }
                      : !pre.isExecutorConnectorResultCurrent
                        ? {
                            key: "runExecutorConnector",
                            label: "Invoke connector",
                            disabled: !actions.canInvokeExecutorConnector,
                            note: null,
                          }
                        : { key: "none", label: "Up to date", disabled: true, note: "Up to date for the current session state." };

  return {
    hasSession: true,
    contextLine: `sessionId ${sessionId} • requirementId ${requirementId ?? "(none)"}`,
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
    ? { title: "Execution request", statusLabel: "Complete", tone: "good", detail: "Request recorded and approved for this snapshot." }
    : requestInProgress
      ? {
          title: "Execution request",
          statusLabel: "In progress",
          tone: "warn",
          detail: actions.businessRequestNeedsAttention
            ? "Update tasks or recreate the request if it is stale or invalid."
            : "Finish draft, checkpoint, and business approval.",
        }
      : { title: "Execution request", statusLabel: "Not started", tone: "neutral", detail: "Prepare handoff in Tasks, then create and approve the request here." };

  const pkgDone = pre.isExecutionPackageAssigned;
  const pkgInProgress = !pkgDone && pre.isBusinessExecutionPackaged;
  const packageAndAssignment: ExecutionProgressRow = !requestDone
    ? { title: "Package & assignment", statusLabel: "Blocked", tone: "neutral", detail: "Complete execution request first." }
    : pkgDone
      ? { title: "Package & assignment", statusLabel: "Complete", tone: "good", detail: "Work package exists and an executor is assigned." }
      : pkgInProgress
        ? { title: "Package & assignment", statusLabel: "In progress", tone: "warn", detail: "Package is ready — assign who will run this work." }
        : {
            title: "Package & assignment",
            statusLabel: "Not started",
            tone: "warn",
            detail: "Create the execution package after approval.",
          };

  const prepDone = pre.isActualLaunchCommandCurrent;
  const prepStarted = !prepDone && (pre.isExecutorWorkOrderCurrent || pre.isBusinessLaunchIntentCurrent || pre.isExecutionBridgePayloadCurrent);
  const executionPreparation: ExecutionProgressRow = !pkgDone
    ? { title: "Execution preparation", statusLabel: "Blocked", tone: "neutral", detail: "Finish package and assignment first." }
    : prepDone
      ? { title: "Execution preparation", statusLabel: "Complete", tone: "good", detail: "Launch inputs are ready for a business run." }
      : prepStarted
        ? {
            title: "Execution preparation",
            statusLabel: "In progress",
            tone: "warn",
            detail: "Complete the remaining preparation steps (see Advanced details if needed).",
          }
        : {
            title: "Execution preparation",
            statusLabel: "Not started",
            tone: "warn",
            detail: "After assignment, prepare executor inputs through the preparation chain.",
          };

  return { executionRequest, packageAndAssignment, executionPreparation };
}

export function getExecutionRunAndConnectorView(actions: ExecutionPageActionState): ExecutionRunAndConnectorView {
  return {
    canRetryBusinessRun: actions.canStartBusinessExecution,
    businessRunRetryBlocked: actions.blockedByActiveBusinessRun,
    businessRunRetryLabel: actions.invocationPrimaryLabel,
    canInvokeConnector: actions.canInvokeExecutorConnector,
    canRetryConnector: actions.canRetryExecutorConnector,
    connectorStaleNote: actions.hasStaleExecutorConnectorResult
      ? "A stored connector result no longer matches the current integration adapter. Invoke again after the adapter is current."
      : null,
  };
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
    runAndConnector: getExecutionRunAndConnectorView(input.actions),
    advanced: getExecutionAdvancedArtifactsView(input.pre),
    runMeta: getExecutionRunMonitoringMeta({
      sessionId: input.sessionId,
      monitoring: input.monitoring,
      timeline: input.timeline,
    }),
  };
}
