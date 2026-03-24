import type { AiMemberActionExecutionMode } from "@prisma/client";
import { internalAgentExecutorShell } from "@/lib/ai-member/executors/internalAgentExecutorShell";
import { manualAgentExecutor } from "@/lib/ai-member/executors/manualAgentExecutor";
import { openAIExecutorShell } from "@/lib/ai-member/executors/openAIExecutorShell";
import type { AiMemberActionExecutor } from "@/lib/ai-member/executors/types";
import { stubExecutor } from "@/lib/ai-member/executors/stubExecutor";

export function selectExecutorForMode(mode: AiMemberActionExecutionMode): AiMemberActionExecutor {
  switch (mode) {
    case "STUB":
      return stubExecutor;
    case "MANUAL_AGENT":
      return manualAgentExecutor;
    case "OPENAI":
      return openAIExecutorShell;
    case "INTERNAL_AGENT":
      return internalAgentExecutorShell;
    default:
      return stubExecutor;
  }
}

export type { ActionForExecution, AiMemberActionExecutor, ExecutorOutput } from "@/lib/ai-member/executors/types";
