import type { CursorRunResult } from "@/lib/execution/cursorExecutionAdapter";
import { isCursorCodeReflectionConfirmed } from "@/lib/execution/cursorReflectionPolicy";
import {
  relaySummaryLooksLikeFailure,
  runOpenAiRelayEvaluation,
  type TaskEvaluationResult,
} from "@/lib/execution/openAiRelayEvaluation";
import {
  countExecutionReviewAiMembers,
  tryRunExecutionReviewWithAiMembers,
} from "@/lib/execution/executionReviewWithAiMembers";
import type { ExecutionReviewerStepRecord } from "@/lib/execution/executionReviewWithAiMembers";
import { filterPathsOutsideAllowedGlobs } from "@/lib/execution/pathGlobPolicy";

export type { TaskEvaluationResult } from "@/lib/execution/openAiRelayEvaluation";
export type { ExecutionReviewerStepRecord } from "@/lib/execution/executionReviewWithAiMembers";

/** 저장소·UI에서 리뷰 생략 여부 판별 */
export const EXECUTION_REVIEW_SKIPPED_REASON_PREFIX = "review_skipped:";

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
  /** 미전달 시 projectId로 조회. 0이면 AI 리뷰·OpenAI 릴레이 평가를 모두 생략하고 통과 처리 */
  executionReviewerCount?: number;
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

  const mergedForReflection: Pick<CursorRunResult, "commitHash" | "changedFiles" | "summary"> = {
    ...params.cursorResult,
    changedFiles: files,
    summary,
  };
  if (!isCursorCodeReflectionConfirmed(mergedForReflection)) {
    return {
      result: {
        decision: "failed",
        reason:
          "git_reflection_unconfirmed: commitHash·변경 파일·요약 근거 없음 — 에이전트 수락만으로 완료할 수 없습니다.",
        suspiciousChanges: ["no_commit_no_changed_files"],
      },
      usage: null,
      reviewerSteps: [],
    };
  }

  const taskPayload = {
    ...params.task,
    acceptanceCriteria: params.acceptanceCriteria.length ? params.acceptanceCriteria : params.task.acceptanceCriteria,
  };
  const cursorPayload = { ...params.cursorResult, changedFiles: files, summary };

  if (params.projectId) {
    const reviewerCount =
      params.executionReviewerCount !== undefined
        ? params.executionReviewerCount
        : await countExecutionReviewAiMembers(params.projectId);

    if (reviewerCount === 0) {
      return {
        result: {
          decision: "done",
          reason: `${EXECUTION_REVIEW_SKIPPED_REASON_PREFIX} 리뷰 단계 생략됨 (AI 멤버 미설정)`,
          suspiciousChanges: [],
        },
        usage: null,
        reviewerSteps: [],
      };
    }

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
