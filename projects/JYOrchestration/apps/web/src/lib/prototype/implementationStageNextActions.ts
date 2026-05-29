import {
  mapImplementationChipToAction,
  type EffectiveImplementationState,
  type ImplementationStageActionId,
} from "@/lib/prototype/effectiveImplementationState";
import {
  hasDeveloperWipApprovedWithReviewQueued,
  hasReviewerOrSecurityQualityGateFailed,
  type ImplementationTaskExecutionStateV1,
} from "@/lib/prototype/implementationTaskExecutionState";
import {
  deriveImplementationPrototypeRunSyncSnapshot,
  isImplementationPrototypeComplete,
  type ImplementationPrototypeRunSyncSnapshot,
} from "@/lib/prototype/implementationPrototypeRunSync";
import {
  AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP,
  AI_DEVELOPER_REMEDIATION_REQUEST_CHIP,
  IMPLEMENTATION_PROTOTYPE_PREVIEW_CHIP,
  REVIEWER_CHECK_CHIP,
  REVIEWER_CHECK_RUN_CHIP,
  SCM_CRITERIA_CHIP,
  SECURITY_CHECK_CHIP,
  SECURITY_CHECK_RUN_CHIP,
  TASK_LIST_VIEW_CHIP,
} from "@/lib/requirements/implementationUxLabels";
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

function deriveNextActionsFromPrototypeComplete(
  prototypeSnapshot: ImplementationPrototypeRunSyncSnapshot | null | undefined,
  executionState: ImplementationTaskExecutionStateV1 | null | undefined,
): readonly ImplementationStageNextAction[] | null {
  if (!isImplementationPrototypeComplete({ executionState, prototypeSnapshot })) return null;
  return [
    {
      actionId: "SHOW_ARTIFACTS",
      label: IMPLEMENTATION_PROTOTYPE_PREVIEW_CHIP,
      priority: "primary",
      reason: "프로토타입 preview ready — 결과 확인",
    },
    {
      actionId: "REQUEST_CODE_AGENT_WIP",
      label: "변경사항 보기",
      priority: "secondary",
      reason: "구현 변경사항 확인",
    },
    {
      actionId: "SHOW_ROLE_CHECK",
      label: REVIEWER_CHECK_CHIP,
      priority: "secondary",
      reason: "후속 점검 대기 또는 완료 확인",
    },
    {
      actionId: "SHOW_ROLE_CHECK",
      label: SECURITY_CHECK_CHIP,
      priority: "tertiary",
      reason: "후속 점검 대기 또는 완료 확인",
    },
    {
      actionId: "SHOW_SCM_CHECK",
      label: SCM_CRITERIA_CHIP,
      priority: "tertiary",
      reason: "SCM 반영 기준 확인",
    },
  ];
}

function deriveNextActionsFromExecutionState(
  executionState: ImplementationTaskExecutionStateV1 | null | undefined,
  prototypeSnapshot?: ImplementationPrototypeRunSyncSnapshot | null,
): readonly ImplementationStageNextAction[] | null {
  const fromComplete = deriveNextActionsFromPrototypeComplete(prototypeSnapshot, executionState);
  if (fromComplete?.length) return fromComplete;

  if (!executionState?.items.length) return null;

  const summary = executionState.summary;

  if (hasDeveloperWipApprovedWithReviewQueued(executionState)) {
    return [
      {
        actionId: "RUN_REVIEWER_CHECK",
        label: REVIEWER_CHECK_RUN_CHIP,
        priority: "primary",
        reason: "개발자 WIP 승인 후 검수자 점검 실행",
      },
      {
        actionId: "RUN_SECURITY_CHECK",
        label: SECURITY_CHECK_RUN_CHIP,
        priority: "secondary",
        reason: "개발자 WIP 승인 후 보안 점검 실행",
      },
      {
        actionId: "SHOW_ROLE_CHECK",
        label: REVIEWER_CHECK_CHIP,
        priority: "secondary",
        reason: "검수자 점검 대상 확인",
      },
      {
        actionId: "SHOW_SCM_CHECK",
        label: SCM_CRITERIA_CHIP,
        priority: "tertiary",
        reason: "SCM 반영 기준 확인",
      },
    ];
  }

  if (hasReviewerOrSecurityQualityGateFailed(executionState)) {
    return [
      {
        actionId: "REQUEST_CODE_AGENT_WIP",
        label: AI_DEVELOPER_REMEDIATION_REQUEST_CHIP,
        priority: "primary",
        reason: "검수/보안 점검 실패 후 개발자 보완 요청",
      },
      {
        actionId: "SHOW_ARTIFACTS",
        label: TASK_LIST_VIEW_CHIP,
        priority: "secondary",
        reason: "작업목록 및 점검 결과 확인",
      },
      {
        actionId: "RUN_REVIEWER_CHECK",
        label: REVIEWER_CHECK_RUN_CHIP,
        priority: "secondary",
        reason: "검수자 점검 재실행",
      },
      {
        actionId: "RUN_SECURITY_CHECK",
        label: SECURITY_CHECK_RUN_CHIP,
        priority: "tertiary",
        reason: "보안 점검 재실행",
      },
    ];
  }

  if (summary.inProgress > 0) {
    return [
      {
        actionId: "REQUEST_CODE_AGENT_WIP",
        label: "변경사항 보기",
        priority: "primary",
        reason: "Code Agent WIP 진행 중 변경사항 확인",
      },
      {
        actionId: "REQUEST_CODE_AGENT_WIP",
        label: "구현 결과 승인",
        priority: "secondary",
        reason: "Code Agent WIP 결과 승인",
      },
    ];
  }

  if (summary.failed > 0) {
    return [
      {
        actionId: "REQUEST_CODE_AGENT_WIP",
        label: AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP,
        priority: "primary",
        reason: "실패한 구현 작업 재시도",
      },
    ];
  }

  return null;
}

export function deriveImplementationStageNextActions(
  status: ImplementationStageStatus,
  executionState?: ImplementationTaskExecutionStateV1 | null,
  prototypeSnapshot?: ImplementationPrototypeRunSyncSnapshot | null,
): readonly ImplementationStageNextAction[] {
  const fromExecution = deriveNextActionsFromExecutionState(executionState, prototypeSnapshot);
  if (fromExecution?.length) return fromExecution;

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
    case "prototype_ready":
      return deriveNextActionsFromPrototypeComplete(prototypeSnapshot, executionState) ?? [];
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
  executionState?: ImplementationTaskExecutionStateV1 | null,
): readonly string[] {
  const prototypeSnapshot = deriveImplementationPrototypeRunSyncSnapshot({
    latestRun: state.latestRun,
    workUnits: state.latestRun?.workUnits,
  });
  const status = deriveImplementationStageStatus(state, executionState);
  const nextActions = deriveImplementationStageNextActions(status, executionState, prototypeSnapshot);
  return prioritizeImplementationChipsByNextActions({ labels, nextActions });
}

