import { EXECUTOR_TYPE_LABELS } from "@/lib/workflow/collaborationSessionResultStore";
import type { ExecutionPageActionState, PreExecutionSessionSelector } from "@/lib/workflow/businessExecutionSelectors";
import type { BusinessExecutionMonitoringState } from "@/lib/workflow/businessExecutionRunMonitoring";
import type { PreLaunchActionAvailability } from "@/lib/workflow/preLaunchActionModel";
import type { BusinessExecutionRunEvent } from "@/lib/workflow/businessExecutionRunEvent";

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

function toneForRunStatus(status: string | null | undefined): ExecutionTone {
  if (status === "completed") return "good";
  if (status === "failed") return "bad";
  if (status === "running") return "neutral";
  if (status === "accepted") return "neutral";
  // queued / idle / unknown: keep slightly cautionary but not red
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

  // Pick a single “next best” action, keeping semantics identical to existing gating.
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

export function getExecutionRunMonitoringView(input: {
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

