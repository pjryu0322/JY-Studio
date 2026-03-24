import type { ActionForExecution, AiMemberActionExecutor, ExecutorOutput } from "@/lib/ai-member/executors/types";

export const manualAgentExecutor: AiMemberActionExecutor = {
  name: "ManualAgentExecutor",
  async execute(action: ActionForExecution): Promise<ExecutorOutput> {
    return {
      keepInProgress: true,
      summaryText: "운영/사람 수동 처리 대기",
      resultPayload: {
        kind: "MANUAL_AGENT",
        awaitingManual: true,
        actionType: action.actionType,
        message: "내부 워커 또는 운영자가 처리할 때까지 IN_PROGRESS로 유지됩니다.",
        providerKey: action.providerKey,
      },
    };
  },
};
