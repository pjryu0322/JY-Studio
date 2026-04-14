/**
 * Builds {@link PlanningExecutionScreenViewModel} from {@link PlanningOriginatedExecutionViewModel} only.
 * Encodes **section visibility** and **view-model field bindings** per outward status — no engine calls.
 */

import type { PlanningOriginatedExecutionStatus } from "../contracts/planningOriginatedExecutionResponse";
import type { PlanningOriginatedExecutionViewModel } from "./planningOriginatedExecutionViewModel";
import type {
  PlanningExecutionEmphasizedSummary,
  PlanningExecutionScreenSection,
  PlanningExecutionScreenSectionBinding,
  PlanningExecutionScreenViewModel,
} from "./planningOriginatedExecutionScreenUx";

function bindings(
  pairs: ReadonlyArray<readonly [PlanningExecutionScreenSection, PlanningExecutionScreenSectionBinding["fields"]]>
): readonly PlanningExecutionScreenSectionBinding[] {
  return pairs.map(([section, fields]) => ({ section, fields }));
}

function layoutForStatus(status: PlanningOriginatedExecutionStatus): {
  sections: readonly PlanningExecutionScreenSection[];
  binds: readonly PlanningExecutionScreenSectionBinding[];
  emphasized: PlanningExecutionEmphasizedSummary | null;
} {
  const baseTop: PlanningExecutionScreenSection[] = ["INPUT_PANEL", "STATUS_BANNER"];
  const baseBottom: PlanningExecutionScreenSection[] = ["ACTION_BAR"];

  switch (status) {
    case "BLOCKED": {
      const mid: PlanningExecutionScreenSection[] = [
        "PLANNING_RESULT_SUMMARY",
        "CONFIRMATION_BLOCKING_PANEL",
      ];
      return {
        sections: [...baseTop, ...mid, ...baseBottom],
        binds: bindings([
          ["INPUT_PANEL", ["projectId"]],
          ["STATUS_BANNER", ["statusCard"]],
          ["PLANNING_RESULT_SUMMARY", ["planningHints"]],
          ["CONFIRMATION_BLOCKING_PANEL", ["message"]],
          ["ACTION_BAR", ["actions"]],
        ]),
        emphasized: "BLOCKING",
      };
    }
    case "NEEDS_CONFIRMATION": {
      const mid: PlanningExecutionScreenSection[] = [
        "PLANNING_RESULT_SUMMARY",
        "CONFIRMATION_BLOCKING_PANEL",
      ];
      return {
        sections: [...baseTop, ...mid, ...baseBottom],
        binds: bindings([
          ["INPUT_PANEL", ["projectId"]],
          ["STATUS_BANNER", ["statusCard"]],
          ["PLANNING_RESULT_SUMMARY", ["planningHints"]],
          ["CONFIRMATION_BLOCKING_PANEL", ["confirmationNeededSummary", "message"]],
          ["ACTION_BAR", ["actions"]],
        ]),
        emphasized: "CONFIRMATION",
      };
    }
    case "READY_FOR_EXECUTION": {
      const mid: PlanningExecutionScreenSection[] = [
        "EXECUTION_READINESS_PANEL",
        "METRICS_ROW",
        "TASK_SCREEN_SUMMARY_PANEL",
      ];
      return {
        sections: [...baseTop, ...mid, ...baseBottom],
        binds: bindings([
          ["INPUT_PANEL", ["projectId"]],
          ["STATUS_BANNER", ["statusCard"]],
          ["EXECUTION_READINESS_PANEL", ["message"]],
          ["METRICS_ROW", ["counts"]],
          ["TASK_SCREEN_SUMMARY_PANEL", ["counts"]],
          ["ACTION_BAR", ["actions"]],
        ]),
        emphasized: "READINESS",
      };
    }
    case "EXECUTION_STARTED": {
      const mid: PlanningExecutionScreenSection[] = [
        "EXECUTION_START_STATUS_PANEL",
        "METRICS_ROW",
        "TASK_SCREEN_SUMMARY_PANEL",
      ];
      return {
        sections: [...baseTop, ...mid, ...baseBottom],
        binds: bindings([
          ["INPUT_PANEL", ["projectId"]],
          ["STATUS_BANNER", ["statusCard"]],
          ["EXECUTION_START_STATUS_PANEL", ["runId", "message", "statusCard"]],
          ["METRICS_ROW", ["counts"]],
          ["TASK_SCREEN_SUMMARY_PANEL", ["counts"]],
          ["ACTION_BAR", ["actions"]],
        ]),
        emphasized: "RUN",
      };
    }
    case "EXECUTION_START_FAILED": {
      const mid: PlanningExecutionScreenSection[] = [
        "EXECUTION_READINESS_PANEL",
        "EXECUTION_START_STATUS_PANEL",
        "METRICS_ROW",
        "TASK_SCREEN_SUMMARY_PANEL",
      ];
      return {
        sections: [...baseTop, ...mid, ...baseBottom],
        binds: bindings([
          ["INPUT_PANEL", ["projectId"]],
          ["STATUS_BANNER", ["statusCard"]],
          ["EXECUTION_READINESS_PANEL", ["message"]],
          ["EXECUTION_START_STATUS_PANEL", ["message", "statusCard"]],
          ["METRICS_ROW", ["counts"]],
          ["TASK_SCREEN_SUMMARY_PANEL", ["counts"]],
          ["ACTION_BAR", ["actions"]],
        ]),
        emphasized: "EXECUTION_FAILURE",
      };
    }
  }
}

/** Compose screen layout + bindings from an existing planning-originated execution view-model. */
export function buildPlanningExecutionScreenViewModel(
  viewModel: PlanningOriginatedExecutionViewModel
): PlanningExecutionScreenViewModel {
  const status = viewModel.responseStatus;
  const { sections, binds, emphasized } = layoutForStatus(status);
  return {
    layoutVersion: 1,
    responseStatus: status,
    activeTab: null,
    visibleSections: sections,
    sectionBindings: binds,
    emphasizedSummary: emphasized,
    viewModel,
  };
}

/** Alias of {@link buildPlanningExecutionScreenViewModel}. */
export function toPlanningExecutionScreenViewModel(
  viewModel: PlanningOriginatedExecutionViewModel
): PlanningExecutionScreenViewModel {
  return buildPlanningExecutionScreenViewModel(viewModel);
}
