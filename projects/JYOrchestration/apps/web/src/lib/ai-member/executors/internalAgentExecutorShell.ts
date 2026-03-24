import type { ActionForExecution, AiMemberActionExecutor, ExecutorOutput } from "@/lib/ai-member/executors/types";

/** 내부 에이전트 런타임 연동 전 셸 — 연결 시 이 파일에서 호출 위임 */
export const internalAgentExecutorShell: AiMemberActionExecutor = {
  name: "InternalAgentExecutorShell",
  async execute(action: ActionForExecution): Promise<ExecutorOutput> {
    void action;
    throw new Error("INTERNAL_AGENT_NOT_CONFIGURED");
  },
};
