/**
 * Planning-originated execution — state-specific UX copy helpers.
 *
 * Presentation boundary only:
 * - Deterministic strings (no localization infra)
 * - No engine/internal bundles
 * - Safe for UI consumption
 */

import type { PlanningOriginatedExecutionStatus } from "../contracts/planningOriginatedExecutionResponse";
import type { PlanningExecutionStatusCopy } from "./planningOriginatedExecutionViewModel";

export function planningExecutionStatusCopy(
  status: PlanningOriginatedExecutionStatus
): PlanningExecutionStatusCopy {
  switch (status) {
    case "BLOCKED":
      return {
        headline: "입력을 수정해야 합니다",
        explanation: "현재 입력으로는 계획을 확정하거나 실행 준비를 진행할 수 없습니다.",
        nextStepGuidance: "입력을 구체화하거나 범위를 줄여 다시 시도하세요.",
      };
    case "NEEDS_CONFIRMATION":
      return {
        headline: "확인이 필요합니다",
        explanation: "몇 가지 항목이 미확정 상태라 실행 준비 전에 사용자 확인이 필요합니다.",
        nextStepGuidance: "확인 검토 후 진행하거나, 입력을 수정해 불확실성을 줄이세요.",
      };
    case "READY_FOR_EXECUTION":
      return {
        headline: "실행 준비가 완료되었습니다",
        explanation: "실행에 필요한 준비가 완료되어 바로 시작할 수 있습니다.",
        nextStepGuidance: "실행 시작을 눌러 진행하세요.",
      };
    case "EXECUTION_STARTED":
      return {
        headline: "실행이 시작되었습니다",
        explanation: "실행(run)이 시작되었습니다.",
        nextStepGuidance:
          "현재는 ‘상태 재평가’로 계획/준비 결과를 다시 확인할 수 있습니다. 실행 상태 조회는 추후 제공됩니다.",
      };
    case "EXECUTION_START_FAILED":
      return {
        headline: "실행 시작에 실패했습니다",
        explanation: "실행 준비는 완료됐지만, 실행을 시작하는 과정에서 실패했습니다.",
        nextStepGuidance: "다시 시도하거나, 실패 원인 보기를 통해 상세 내용을 확인하세요.",
      };
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

