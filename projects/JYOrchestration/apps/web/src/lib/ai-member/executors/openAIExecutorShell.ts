import type { ActionForExecution, AiMemberActionExecutor, ExecutorOutput } from "@/lib/ai-member/executors/types";

/** 향후 OpenAI API 연동 지점 — 현재는 호출 시 실패 처리되어 디스패처가 FAILED 기록 */
export const openAIExecutorShell: AiMemberActionExecutor = {
  name: "OpenAIExecutorShell",
  async execute(action: ActionForExecution): Promise<ExecutorOutput> {
    void action;
    throw new Error("OPENAI_EXECUTOR_NOT_CONFIGURED");
  },
};
