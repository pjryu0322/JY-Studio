"use client";

import type { ReactNode } from "react";

/**
 * Planning-originated execution **workspace shell**.
 *
 * Consumes only {@link import("@jy-orch/application/public").PlanningExecutionScreenViewModel}
 * (which embeds the UI view-model). Does not read planning handoff, preparation bundle, bridge input, or seed payloads.
 */

import type {
  PlanningExecutionScreenSection,
  PlanningExecutionScreenViewModel,
  PlanningExecutionActionViewModel,
  PlanningExecutionStructuralAction,
  PlanningExecutionRunStatusResponse,
} from "@jy-orch/application/public";
import { PlanningExecutionActionBar } from "./PlanningExecutionActionBar";
import { PlanningExecutionConfirmationOrBlockingPanel } from "./PlanningExecutionConfirmationOrBlockingPanel";
import { PlanningExecutionExecutionStatusPanel } from "./PlanningExecutionExecutionStatusPanel";
import { PlanningExecutionInputPanel } from "./PlanningExecutionInputPanel";
import { PlanningExecutionPlanningSummaryPanel } from "./PlanningExecutionPlanningSummaryPanel";
import { PlanningExecutionReadinessPanel } from "./PlanningExecutionReadinessPanel";
import { PlanningExecutionStatusCard } from "./PlanningExecutionStatusCard";
import { PlanningExecutionCounts } from "./PlanningExecutionCounts";
import { PlanningExecutionTaskList } from "./PlanningExecutionTaskList";

export type PlanningExecutionWorkspaceProps = Readonly<{
  screen: PlanningExecutionScreenViewModel;
  inputText: string;
  onInputTextChange: (value: string) => void;
  onStructuralAction: (action: PlanningExecutionStructuralAction) => void;
  runStatus: (PlanningExecutionRunStatusResponse & { ok: true })["run"] | null;
  runStatusError: string | null;
  /** When true, disables local input (e.g. while a request is in flight). */
  inputDisabled?: boolean;
}>;

function renderSection(
  section: PlanningExecutionScreenSection,
  props: PlanningExecutionWorkspaceProps
): ReactNode {
  const { screen, inputText, onInputTextChange, onStructuralAction, inputDisabled, runStatus, runStatusError } = props;
  const vm = screen.viewModel;
  switch (section) {
    case "INPUT_PANEL":
      return (
        <PlanningExecutionInputPanel
          projectId={vm.projectId}
          inputText={inputText}
          onInputTextChange={onInputTextChange}
          disabled={inputDisabled}
        />
      );
    case "STATUS_BANNER":
      return <PlanningExecutionStatusCard card={vm.statusCard} />;
    case "PLANNING_RESULT_SUMMARY":
      return <PlanningExecutionPlanningSummaryPanel vm={vm} />;
    case "CONFIRMATION_BLOCKING_PANEL":
      return <PlanningExecutionConfirmationOrBlockingPanel vm={vm} />;
    case "EXECUTION_READINESS_PANEL":
      return <PlanningExecutionReadinessPanel vm={vm} />;
    case "EXECUTION_START_STATUS_PANEL":
      return <PlanningExecutionExecutionStatusPanel vm={vm} runStatus={runStatus} runStatusError={runStatusError} />;
    case "METRICS_ROW":
      return <PlanningExecutionCounts counts={vm.counts} />;
    case "TASK_SCREEN_SUMMARY_PANEL":
      return <PlanningExecutionTaskList counts={vm.counts} />;
    case "ACTION_BAR":
      const effectiveActions: PlanningExecutionActionViewModel =
        screen.responseStatus === "EXECUTION_STARTED" && runStatus?.status === "FAILED"
          ? {
              primaryAction: "INSPECT_FAILURE",
              secondaryAction: "RETRY_EXECUTION",
              availableActions: ["INSPECT_FAILURE", "RETRY_EXECUTION", ...vm.actions.availableActions],
            }
          : vm.actions;
      const runFailed = runStatus?.status === "FAILED";
      // Prefer contract-driven hints when available (run status knows if retry/inspect are meaningful).
      const preferInspect = runFailed && runStatus?.canInspect === true;
      const preferRetry = runFailed && runStatus?.canRetry === true;
      const contractActions: PlanningExecutionActionViewModel | null =
        screen.responseStatus === "EXECUTION_STARTED" && runFailed && (preferInspect || preferRetry)
          ? {
              primaryAction: preferInspect ? "INSPECT_FAILURE" : "RETRY_EXECUTION",
              secondaryAction: preferInspect && preferRetry ? "RETRY_EXECUTION" : preferRetry ? "INSPECT_FAILURE" : null,
              availableActions: [
                ...(preferInspect ? (["INSPECT_FAILURE"] as const) : (["RETRY_EXECUTION"] as const)),
                ...(preferInspect && preferRetry ? (["RETRY_EXECUTION"] as const) : preferRetry ? (["INSPECT_FAILURE"] as const) : ([] as const)),
                ...vm.actions.availableActions,
              ],
            }
          : null;
      return (
        <PlanningExecutionActionBar
          actions={contractActions ?? effectiveActions}
          onStructuralAction={onStructuralAction}
          disabled={inputDisabled}
          runStatusRefreshHint={screen.responseStatus === "EXECUTION_STARTED" && runStatus !== null}
        />
      );
    default:
      return null;
  }
}

export function PlanningExecutionWorkspace(props: PlanningExecutionWorkspaceProps) {
  const { screen } = props;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 pb-12">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight text-neutral-900">Planning → execution</h1>
        <p className="text-sm text-neutral-500">입력을 바탕으로 계획을 정리하고, 준비가 되면 실행을 시작합니다.</p>
      </header>
      {screen.visibleSections.map((section) => (
        <div key={section} data-section={section}>
          {renderSection(section, props)}
        </div>
      ))}
    </div>
  );
}
