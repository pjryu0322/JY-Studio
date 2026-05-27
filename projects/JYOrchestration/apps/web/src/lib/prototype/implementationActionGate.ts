import type { ImplementationActionId } from "@/lib/prototype/implementationIntentRouterTypes";

export type ImplementationActionGateInput = Readonly<{
  actionId: ImplementationActionId;
  envOk: boolean;
  templatePlanningReady: boolean;
  implementationSeedReady: boolean;
  hasWorkUnits: boolean;
  isPlannerRunning: boolean;
  plannerCreatePending: boolean;
  protoBusy: boolean;
}>;

export type ImplementationActionGateResult =
  | Readonly<{ allowed: true }>
  | Readonly<{
      allowed: false;
      message: string;
      interviewSuggestions?: readonly string[];
    }>;

export function evaluateImplementationActionGate(input: ImplementationActionGateInput): ImplementationActionGateResult {
  if (input.actionId === "CREATE_WORK_PLAN" || input.actionId === "OPEN_PLANNER_PROMPT") {
    if (input.protoBusy) {
      return { allowed: false, message: "다른 작업이 진행 중입니다. 잠시 후 다시 시도해 주세요." };
    }
    if (input.plannerCreatePending || input.isPlannerRunning) {
      return { allowed: false, message: "이미 작업계획 생성이 진행 중입니다." };
    }
    if (!input.envOk) {
      return {
        allowed: false,
        message:
          "구현 작업안 생성 요청은 확인했습니다.\n다만 현재 실행 환경 검증이 완료되지 않아 작업계획 생성을 시작할 수 없습니다.\n\n먼저 환경설정을 완료해 주세요.",
        interviewSuggestions: ["환경설정 열기"],
      };
    }
    if (!input.templatePlanningReady) {
      return {
        allowed: false,
        message:
          "구현 작업안 생성 요청은 확인했습니다.\n다만 선택한 템플릿이 아직 확정되지 않았습니다.\nAI 추천 템플릿을 사용할 경우 별도 확정 없이 진행할 수 있고, 다른 템플릿을 선택했다면 [확정]이 필요합니다.",
        interviewSuggestions: ["환경설정 열기"],
      };
    }
    if (!input.implementationSeedReady) {
      return {
        allowed: false,
        message:
          "구현 작업안 생성 요청은 확인했습니다.\n다만 Implementation Seed 준비가 완료되지 않아 작업계획 생성을 시작할 수 없습니다.\n\n기획 산출물·Seed 상태를 확인해 주세요.",
        interviewSuggestions: ["산출물 다시 보기"],
      };
    }
    if (input.hasWorkUnits && input.actionId === "CREATE_WORK_PLAN") {
      return {
        allowed: false,
        message: "이미 작업계획이 생성되어 있습니다. 수정이 필요하면 「작업계획 다시 생성」 또는 수정 요청을 이용해 주세요.",
      };
    }
  }

  return { allowed: true };
}
