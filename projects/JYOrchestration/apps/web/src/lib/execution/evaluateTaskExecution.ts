import type { CursorRunResult } from "@/lib/execution/cursorExecutionAdapter";
import {
  relaySummaryLooksLikeFailure,
  runOpenAiRelayEvaluation,
  type TaskEvaluationResult,
} from "@/lib/execution/openAiRelayEvaluation";
import { tryRunExecutionReviewWithAiMembers } from "@/lib/execution/executionReviewWithAiMembers";
import type { ExecutionReviewerStepRecord } from "@/lib/execution/executionReviewWithAiMembers";
import { filterPathsOutsideAllowedGlobs } from "@/lib/execution/pathGlobPolicy";

export type { TaskEvaluationResult } from "@/lib/execution/openAiRelayEvaluation";
export type { ExecutionReviewerStepRecord } from "@/lib/execution/executionReviewWithAiMembers";

const MAX_CHANGED_FILES_BEFORE_FAIL = 80;

/**
 * Cursor 결과 수집 후 정책 전처리 + OpenAI 평가. 로컬 git/diff 없음.
 */
export async function evaluateExecutionResult(params: {
  projectId?: string;
  task: {
    title: string;
    description: string | null;
    acceptanceCriteria: string[];
  };
  cursorResult: CursorRunResult;
  changedFiles: string[];
  summary: string;
  acceptanceCriteria: string[];
  stopOnTestFailure: boolean;
  stopOnOutOfScopeChange: boolean;
  allowedPathGlobs: string[];
  repoUrl: string;
}): Promise<{
  result: TaskEvaluationResult;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  reviewerSteps: ExecutionReviewerStepRecord[];
}> {
  const summary = params.summary || params.cursorResult.summary;
  const files = params.changedFiles.length ? params.changedFiles : params.cursorResult.changedFiles;

  if (params.stopOnTestFailure && relaySummaryLooksLikeFailure(summary, params.cursorResult)) {
    return {
      result: {
        decision: "failed",
        reason: `실행 요약/상태에 실패 징후(stopOnTestFailure): ${summary.slice(0, 1200)}`,
        suspiciousChanges: ["executor_summary_or_status_failure_hint"],
      },
      usage: null,
      reviewerSteps: [],
    };
  }

  if (params.stopOnOutOfScopeChange && files.length > MAX_CHANGED_FILES_BEFORE_FAIL) {
    return {
      result: {
        decision: "failed",
        reason: `변경 파일 수가 ${MAX_CHANGED_FILES_BEFORE_FAIL}을 초과하여 범위 밖 변경으로 간주합니다(stopOnOutOfScopeChange).`,
        suspiciousChanges: [`too_many_files:${files.length}`],
      },
      usage: null,
      reviewerSteps: [],
    };
  }

  if (params.stopOnOutOfScopeChange) {
    const bad = filterPathsOutsideAllowedGlobs(files, params.allowedPathGlobs);
    if (bad.length) {
      return {
        result: {
          decision: "failed",
          reason: `허용 경로 glob 밖의 변경이 보고되었습니다(stopOnOutOfScopeChange): ${bad.slice(0, 12).join(", ")}${bad.length > 12 ? "…" : ""}`,
          suspiciousChanges: bad.slice(0, 30),
        },
        usage: null,
        reviewerSteps: [],
      };
    }
  }

  const taskPayload = {
    ...params.task,
    acceptanceCriteria: params.acceptanceCriteria.length ? params.acceptanceCriteria : params.task.acceptanceCriteria,
  };
  const cursorPayload = { ...params.cursorResult, changedFiles: files, summary };

  if (params.projectId) {
    const memberPack = await tryRunExecutionReviewWithAiMembers({
      projectId: params.projectId,
      task: taskPayload,
      cursorResult: cursorPayload,
      repoUrl: params.repoUrl,
      stopOnTestFailure: params.stopOnTestFailure,
    });
    if (memberPack) {
      return {
        result: memberPack.result,
        usage: memberPack.usage,
        reviewerSteps: memberPack.steps,
      };
    }
  }

  const relay = await runOpenAiRelayEvaluation({
    task: taskPayload,
    cursorResult: cursorPayload,
    repoUrl: params.repoUrl,
    stopOnTestFailure: params.stopOnTestFailure,
  });
  return { ...relay, reviewerSteps: [] };
}

/** @deprecated evaluateExecutionResult 사용 권장 */
export const evaluateResult = evaluateExecutionResult;
