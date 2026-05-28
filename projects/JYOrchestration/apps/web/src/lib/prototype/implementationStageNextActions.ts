import {
  mapImplementationChipToAction,
  type EffectiveImplementationState,
  type ImplementationStageActionId,
} from "@/lib/prototype/effectiveImplementationState";
import {
  AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP,
} from "@/lib/prototype/implementationTaskListEntryMessage";
import {
  deriveImplementationStageStatus,
  type ImplementationStageStatus,
} from "@/lib/prototype/implementationStageStatus";

export type ImplementationStageNextAction = Readonly<{
  actionId: ImplementationStageActionId;
  label: string;
  priority: "primary" | "secondary" | "tertiary";
  reason: string;
}>;

export function deriveImplementationStageNextActions(
  status: ImplementationStageStatus,
): readonly ImplementationStageNextAction[] {
  switch (status) {
    case "not_ready":
      return [
        {
          actionId: "SHOW_ENV_CHECK",
          label: "환경 점검 결과",
          priority: "primary",
          reason: "구현 준비 전 환경/기획 준비 상태 확인 필요",
        },
      ];
    case "task_list_ready":
      return [
        {
          actionId: "REQUEST_CODE_AGENT_WIP",
          label: AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP,
          priority: "primary",
          reason: "구현 작업목록 기준 개발자 구현 요청",
        },
        {
          actionId: "OPEN_ENV_SETTINGS",
          label: "환경설정 열기",
          priority: "secondary",
          reason: "실행 환경 설정",
        },
      ];
    case "implementation_ready":
      return [
        {
          actionId: "GENERATE_IMPLEMENTATION_WORK_PLAN",
          label: "구현 작업안 초안 생성",
          priority: "primary",
          reason: "구현 준비정보가 준비되어 작업안 초안 생성 가능",
        },
      ];
    case "work_plan_drafted":
      return [
        {
          actionId: "CONFIRM_IMPLEMENTATION_WORK_PLAN",
          label: "구현 작업안 확정",
          priority: "primary",
          reason: "작업안 초안을 확정해 실행 계획으로 전환",
        },
        {
          actionId: "EDIT_IMPLEMENTATION_SCOPE",
          label: "구현 범위 수정",
          priority: "secondary",
          reason: "확정 전 범위 조정 가능",
        },
      ];
    case "work_plan_confirmed":
      return [
        {
          actionId: "CONFIRM_MOCK_IMPLEMENTATION",
          label: "Mock 기반 구현 진행",
          priority: "primary",
          reason: "확정된 작업 계획을 기반으로 구현 진행",
        },
        {
          actionId: "REVIEW_DB_INTEGRATION",
          label: "DB 연동 필요성 검토",
          priority: "secondary",
          reason: "실제 저장소 필요 여부 점검",
        },
      ];
    default:
      return [];
  }
}

function chipSortIndex(
  label: string,
  nextActions: readonly ImplementationStageNextAction[],
): number {
  const actionId = mapImplementationChipToAction(label);
  const byActionId = actionId
    ? nextActions.findIndex((a) => a.actionId === actionId)
    : -1;
  if (byActionId >= 0) return byActionId;
  const byLabel = nextActions.findIndex((a) => a.label === label);
  return byLabel >= 0 ? byLabel : 999;
}

/** Reorders existing chip labels; does not add or remove labels. */
export function prioritizeImplementationChipsByNextActions(input: {
  readonly labels: readonly string[];
  readonly nextActions: readonly ImplementationStageNextAction[];
}): readonly string[] {
  const indexed = input.labels.map((label, originalIndex) => ({
    label,
    originalIndex,
    sortIndex: chipSortIndex(label, input.nextActions),
  }));
  indexed.sort((a, b) => {
    if (a.sortIndex !== b.sortIndex) return a.sortIndex - b.sortIndex;
    return a.originalIndex - b.originalIndex;
  });
  return indexed.map((row) => row.label);
}

export function prioritizeImplementationChipsForState(
  labels: readonly string[],
  state: EffectiveImplementationState,
): readonly string[] {
  const status = deriveImplementationStageStatus(state);
  const nextActions = deriveImplementationStageNextActions(status);
  return prioritizeImplementationChipsByNextActions({ labels, nextActions });
}

