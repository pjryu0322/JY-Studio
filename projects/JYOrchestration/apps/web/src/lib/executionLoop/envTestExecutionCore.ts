/**
 * ENV_TEST Stage 1·Stage 2 공통 실행 코어: Cursor invoke(+ 타이밍) — Git 반영·PR 은 cursorExecutionAdapter·헬퍼와 연동.
 * - Stage 2 전용 Cursor 이전 단계: `envTestExecutionPipeline.runEnvTestStage2PreCursorExecutorGate`
 * - Reflection 통과 후 compare→PR→finalize: `envTestExecutionHelpers.runEnvTestReflectionConfirmedPipeline`
 * - Reflection 미통과·GitHub compare 우회: `runEnvTestReflectionNotConfirmedGithubBypass` → `runEnvTestAfterGithubPushConfirmed` → finalize
 * - Cursor 폴링 우회: `runEnvTestAfterGithubPushConfirmed` → `finalizeEnvTestPrOpenedFromGithubOnly`
 * - PR_OPENED 이후: `runEnvTestPostPrOpenedMergeAndReadiness` (Stage1 merge vs Stage2 reviewer→scm)
 *
 * 실패 기준(루프): Cursor agent 폴링 timeout만으로는 FAILED 하지 않음.
 * Git 원격 브랜치 미반영(제한 시간)만 즉시 FAILED. 그 외 ENV_TEST 오류는 재시도 경로.
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
