import type { AiMemberActionType, AiMemberActionExecutionMode } from "@prisma/client";

export type ActionForExecution = {
  id: string;
  projectId: string;
  actionType: AiMemberActionType;
  executionMode: AiMemberActionExecutionMode;
  taskId: string | null;
  taskPromptId: string | null;
  taskRunId: string | null;
  gitChangeRequestId: string | null;
  requestPayload: unknown;
  providerKey: string | null;
  projectMember: {
    displayName: string | null;
    aiProvider: string | null;
    aiAgentKey: string | null;
  };
};

export type ExecutorOutput = {
  resultPayload: Record<string, unknown>;
  summaryText?: string;
  /** true면 완료 처리하지 않고 IN_PROGRESS 유지 */
  keepInProgress?: boolean;
};

export interface AiMemberActionExecutor {
  readonly name: string;
  execute(action: ActionForExecution): Promise<ExecutorOutput>;
}
