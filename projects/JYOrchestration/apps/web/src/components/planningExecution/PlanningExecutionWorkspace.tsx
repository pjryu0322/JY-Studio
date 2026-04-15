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
import { resolvePlanningExecutionActionBarActions } from "./planningExecutionActionModel";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";

export type PlanningExecutionWorkspaceProps = Readonly<{
  screen: PlanningExecutionScreenViewModel;
  inputText: string;
  onInputTextChange: (value: string) => void;
  onStructuralAction: (action: PlanningExecutionStructuralAction) => void;
  runStatus: (PlanningExecutionRunStatusResponse & { ok: true })["run"] | null;
  runStatusError: string | null;
  onRunStatusRefresh: (() => void) | null;
  onInspectFailure: (() => void) | null;
  onReviewConfirmation: (() => void) | null;
  /** When true, disables local input (e.g. while a request is in flight). */
  inputDisabled?: boolean;
}>;

function renderSection(
  section: PlanningExecutionScreenSection,
  props: PlanningExecutionWorkspaceProps
): ReactNode {
  const {
    screen,
    inputText,
    onInputTextChange,
    onStructuralAction,
    inputDisabled,
    runStatus,
    runStatusError,
    onRunStatusRefresh,
    onInspectFailure,
    onReviewConfirmation,
  } = props;
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
      return <PlanningExecutionConfirmationOrBlockingPanel vm={vm} onReviewConfirmation={onReviewConfirmation} />;
    case "EXECUTION_READINESS_PANEL":
      return <PlanningExecutionReadinessPanel vm={vm} />;
    case "EXECUTION_START_STATUS_PANEL":
      return (
        <PlanningExecutionExecutionStatusPanel
          vm={vm}
          runStatus={runStatus}
          runStatusError={runStatusError}
          onRunStatusRefresh={onRunStatusRefresh}
          onInspectFailure={onInspectFailure}
        />
      );
    case "METRICS_ROW":
      return <PlanningExecutionCounts counts={vm.counts} />;
    case "TASK_SCREEN_SUMMARY_PANEL":
      return <PlanningExecutionTaskList counts={vm.counts} />;
    case "ACTION_BAR":
      const effectiveActions: PlanningExecutionActionViewModel = resolvePlanningExecutionActionBarActions({
        responseStatus: screen.responseStatus,
        baseActions: vm.actions,
        runStatus: runStatus
          ? { status: runStatus.status, canInspect: runStatus.canInspect, canRetry: runStatus.canRetry }
          : null,
      });
      return (
        <PlanningExecutionActionBar
          actions={effectiveActions}
          onStructuralAction={onStructuralAction}
          disabled={inputDisabled}
          runStatusRefreshHint={false}
        />
      );
    default:
      return null;
  }
}

const SECTION_LABELS: Record<PlanningExecutionScreenSection, string> = {
  INPUT_PANEL: "계획기반실행-화면-입력-패널",
  STATUS_BANNER: "계획기반실행-화면-상태배너-패널",
  PLANNING_RESULT_SUMMARY: "계획기반실행-화면-계획요약-패널",
  CONFIRMATION_BLOCKING_PANEL: "계획기반실행-화면-확인차단-패널",
  EXECUTION_READINESS_PANEL: "계획기반실행-화면-실행준비-패널",
  EXECUTION_START_STATUS_PANEL: "계획기반실행-화면-실행상태-패널",
  METRICS_ROW: "계획기반실행-화면-지표행-섹션",
  TASK_SCREEN_SUMMARY_PANEL: "계획기반실행-화면-작업요약-패널",
  ACTION_BAR: "계획기반실행-화면-액션바-섹션",
};

export function PlanningExecutionWorkspace(props: PlanningExecutionWorkspaceProps) {
  const { screen } = props;
  const showScreenLabels = useShowScreenLabels();
  return (
    <div className="relative mx-auto flex max-w-3xl flex-col gap-4 p-4 pb-12">
      <ScreenLabel label="계획기반실행-화면-워크스페이스-섹션" visible={showScreenLabels} />
      <header className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight text-neutral-900">계획 → 실행</h1>
        <p className="text-sm text-neutral-500">입력을 바탕으로 계획을 정리하고, 준비가 되면 실행을 시작합니다.</p>
      </header>
      {screen.visibleSections.map((section) => (
        <div key={section} data-section={section} className="relative">
          <ScreenLabel label={SECTION_LABELS[section]} visible={showScreenLabels} />
          {renderSection(section, props)}
        </div>
      ))}
    </div>
  );
}
