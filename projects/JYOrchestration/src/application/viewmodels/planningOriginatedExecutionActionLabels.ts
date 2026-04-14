/**
 * User-facing action labels for planning-originated execution.
 *
 * Structural action ids are stable and used for wiring/state machines.
 * These labels are what UX should render on buttons/menus.
 */

import type { PlanningExecutionStructuralAction } from "./planningOriginatedExecutionViewModel";

export function planningExecutionActionLabel(action: PlanningExecutionStructuralAction): string {
  switch (action) {
    case "EDIT_INPUT":
      return "입력 수정";
    case "REVIEW_CONFIRMATION":
      return "확인 검토";
    case "START_EXECUTION":
      return "실행 시작";
    case "RETRY_EXECUTION":
      return "다시 시도";
    case "INSPECT_FAILURE":
      return "실패 원인 보기";
    case "VIEW_RUN_STATUS":
      return "실행 상태 보기";
    case "REFRESH_STATUS":
      // Honest semantics: this is a re-evaluation via PREPARE_ONLY today, not a true run-status poll.
      return "상태 재평가";
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

