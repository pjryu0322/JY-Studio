import { prisma } from "@/lib/prisma";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";

export const TEAM_RUNTIME_APPROVAL_WAITING_SUMMARY_KO =
  "AI 검수·보안 통과. 사용자 승인 후 merge/deploy를 진행하세요. Task 제어에서 workflow-approve-ai-team-runtime 승인 후 동일 Task로 실행 루프를 다시 실행하세요.";

/** Blocks role-separated path after review/security; SCM/merge must not run until user approves. */
export async function haltTaskForTeamRuntimeApproval(input: Readonly<{
  execRunId: string;
  taskId: string;
}>): Promise<void> {
  await prisma.taskExecutionRun.update({
    where: { id: input.execRunId },
    data: { status: "reviewing", evaluationDecision: "done" },
  });
  await prisma.task.update({
    where: { id: input.taskId },
    data: {
      executionWorkflowStatus: EXECUTION_WORKFLOW.AWAITING_HUMAN,
      lastEvalResult: "approval_waiting",
      lastEvalSummary: TEAM_RUNTIME_APPROVAL_WAITING_SUMMARY_KO,
    },
  });
}
