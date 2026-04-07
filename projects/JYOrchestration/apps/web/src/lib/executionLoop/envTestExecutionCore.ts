/**
 * ENV_TEST Stage 1·Stage 2 공통 실행 코어: Cursor invoke(+ 타이밍) — Git 반영·PR 은 cursorExecutionAdapter·헬퍼와 연동.
 * - `executeCursorRun`: RUNNING 중 GitHub compare→PR 조기 종료는 **ENV_TEST_STAGE2**. Stage1은 원격 브랜치 확인 시 폴링 중 `runStage1EnvTestPrSmokePath`, 아니면 터미널 후 `runStage1SmokePipeline`. FINISHED 무시·브랜치 타임아웃은 Stage2 전용.
 * - Stage 2 전용 Cursor 이전 단계: `envTestExecutionPipeline.runEnvTestStage2PreCursorExecutorGate`
 * - Stage 1 PR 스모크: `envTestStage1Pipeline.runStage1SmokePipeline` (runExecutionLoop) + cursor 어댑터 조기 브랜치 경로
 * - Stage 2·reflection 통과 후 compare→PR→finalize: `runEnvTestReflectionConfirmedPipeline`
 * - Stage 2·reflection 미통과: `runEnvTestReflectionNotConfirmedGithubBypass` → `runEnvTestAfterGithubPushConfirmed` → finalize
 * - Cursor 폴링 우회(Stage2 등): `runEnvTestAfterGithubPushConfirmed` → `finalizeEnvTestPrOpenedFromGithubOnly` (Stage1 제외)
 * - PR_OPENED 이후: `runEnvTestPostPrOpenedMergeAndReadiness` (Stage1 merge vs Stage2 reviewer→scm)
 * - 책임 분리: Cursor는 코드 변경/commit/push까지만 담당, PR 생성/merge는 플랫폼(및 Stage2 SCM 분기)에서만 수행
 *
 * 실패 기준(루프): Cursor agent 폴링 timeout만으로는 FAILED 하지 않음.
 * Git 원격 브랜치 미반영(제한 시간)만 즉시 FAILED. 그 외 ENV_TEST 오류는 재시도 경로.
 */

import { isEnvTestFamilyTaskKind, isEnvTestStage1TaskKind } from "@/lib/execution/envTestTaskKind";
import {
  executeCursorRun,
  type ExecuteCursorRelayParams,
  type ExecuteCursorRunOutcome,
} from "@/lib/execution/cursorExecutionAdapter";
import { appendTaskProgressLog } from "@/lib/observability/taskProgressLog";
import { patchTaskExecutionRunStage2Timing, readEnvTestStage2TimingRecord } from "@/lib/service/envTestStage2Telemetry";
import { prisma } from "@/lib/prisma";

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

  if (isEnvTestFamilyTaskKind(tk) && !isEnvTestStage1TaskKind(tk)) {
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
    const wallMs = Date.now() - cursorStartedAt;
    let cursorMs = wallMs;
    // Stage1: 과거 폴링 중 PR 경로 제거 후에도, prCreationTimeMs가 있으면 wall에서 제외(호환).
    if (isEnvTestStage1TaskKind(tk)) {
      const row = await prisma.taskExecutionRun.findUnique({
        where: { id: ctx.execRunId },
        select: { validationOutput: true },
      });
      const timing = readEnvTestStage2TimingRecord(row?.validationOutput ?? null);
      const prMs = typeof timing?.prCreationTimeMs === "number" ? timing.prCreationTimeMs : 0;
      if (prMs > 0) {
        cursorMs = Math.max(0, wallMs - prMs);
      }
    }
    await patchTaskExecutionRunStage2Timing(ctx.execRunId, {
      executionId: ctx.execRunId,
      cursorTimeMs: cursorMs,
    });
  }

  return cursorOutcome;
}
