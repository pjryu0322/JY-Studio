/**
 * Stage2 canonical progress phases (task progress log `phase` field).
 * Emitted at transition points in addition to legacy / catalog logs.
 */
import { appendTaskProgressLog } from "@/lib/observability/taskProgressLog";

export const STAGE2_PROGRESS_PHASE = {
  BRANCH_REFLECTED: "env_test_stage2_branch_reflected",
  PR_OPENED: "env_test_stage2_pr_opened",
  REVIEWER_STARTED: "env_test_stage2_reviewer_started",
  SECURITY_STARTED: "env_test_stage2_security_started",
  SCM_STARTED: "env_test_stage2_scm_started",
  MERGE_COMPLETED: "env_test_stage2_merge_completed",
  FINISHED: "env_test_stage2_finished",
} as const;

export type Stage2ProgressPhase = (typeof STAGE2_PROGRESS_PHASE)[keyof typeof STAGE2_PROGRESS_PHASE];

export function appendStage2ProgressPhase(
  phase: Stage2ProgressPhase,
  ctx: {
    projectId: string;
    taskId: string;
    actorUserId: string;
    executionId?: string | null;
    detail?: Record<string, unknown>;
  }
): void {
  appendTaskProgressLog({
    kind: "execution",
    phase,
    projectId: ctx.projectId,
    taskId: ctx.taskId,
    userId: ctx.actorUserId,
    detail: {
      ...(ctx.detail ?? {}),
      ...(ctx.executionId ? { executionId: ctx.executionId } : {}),
    },
  });
}
