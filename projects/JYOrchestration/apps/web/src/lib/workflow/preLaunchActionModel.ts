import type { LaunchReadinessResult } from "@/lib/workflow/preExecutionValidation";
import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";
import type { ActiveExecutionInputSelection } from "@/lib/workflow/preExecutionStateStore";

export type PreLaunchActionAvailability = {
  canPrepareLaunchAction: boolean;
  actionLabel: string;
  actionReason?: string;
};

export function getPreLaunchActionAvailability(input: {
  active: ActiveExecutionInputSelection | null;
  snapshot: ExecutionLaunchSnapshot | undefined;
  launchReadiness: LaunchReadinessResult;
}): PreLaunchActionAvailability {
  if (!input.active) {
    return {
      canPrepareLaunchAction: false,
      actionLabel: "활성 입력 선택",
      actionReason: "선택된 활성 준비 입력이 없습니다.",
    };
  }

  if (!input.snapshot) {
    return {
      canPrepareLaunchAction: false,
      actionLabel: "작업 화면에서 스냅샷 준비",
      actionReason: "이 세션에 대한 준비 스냅샷이 없습니다.",
    };
  }

  if (!input.launchReadiness.isLaunchReady) {
    const primaryReason = input.launchReadiness.reasons[0] ?? "활성 입력이 실행 준비 상태가 아닙니다.";
    return {
      canPrepareLaunchAction: false,
      actionLabel: "준비 이슈 해결",
      actionReason: primaryReason,
    };
  }

  return {
    canPrepareLaunchAction: true,
    actionLabel: "실행 인수 준비",
    actionReason: "활성 준비 입력이 실행 준비를 만족합니다.",
  };
}

