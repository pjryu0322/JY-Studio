/**
 * ENV_TEST Stage 1·Stage 2 공통 실행 코어: Cursor invoke → Git 반영 → PR_OPENED 까지 동일 경로.
 * (Stage 2만 Executor ACK + PR 이후 Reviewer/Security/SCM — runExecutionLoop 에서 분기)
 */

import { isEnvTestFamilyTaskKind } from "@/lib/execution/envTestTaskKind";
import {
  executeCursorRun,
  type ExecuteCursorRelayParams,
  type ExecuteCursorRunOutcome,
} from "@/lib/execution/cursorExecutionAdapter";
import { appendTaskProgressLog } from "@/lib/observability/taskProgressLog";
import { patchTaskExecutionRunStage2Timing } from "@/lib/service/envTestStage2Telemetry";

export type EnvTestCursorToPrOpenedCoreContext = {
  projectId: string;
  taskId: string;
  actorUserId: string;
  execRunId: string;
  branchName: string;
};

/**
 * 공통 코어: Cursor 호출 + (ENV_TEST family) cursor 구간 타이밍 기록.
 * Git source of truth·FINISHED 미대기는 executeCursorRun 내부 `isEnvTestFamilyTaskKind` 분기에서 처리.
 */
export async function runEnvTestCursorToPrOpenedCore(input: {
  executeParams: ExecuteCursorRelayParams;
  ctx: EnvTestCursorToPrOpenedCoreContext;
}): Promise<ExecuteCursorRunOutcome> {
  const { executeParams, ctx } = input;
  const tk = executeParams.taskKind ?? null;

  if (isEnvTestFamilyTaskKind(tk)) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_cursor_invoke_started",
      projectId: ctx.projectId,
      taskId: ctx.taskId,
      userId: ctx.actorUserId,
      detail: {
        execRunId: ctx.execRunId,
        branch: ctx.branchName,
        pipeline: "envTestExecutionCore",
        taskKind: tk,
      },
    });
  }

  const cursorStartedAt = Date.now();
  const cursorOutcome = await executeCursorRun(executeParams);

  if (isEnvTestFamilyTaskKind(tk)) {
    await patchTaskExecutionRunStage2Timing(ctx.execRunId, {
      executionId: ctx.execRunId,
      cursorTimeMs: Date.now() - cursorStartedAt,
    });
  }

  return cursorOutcome;
}
