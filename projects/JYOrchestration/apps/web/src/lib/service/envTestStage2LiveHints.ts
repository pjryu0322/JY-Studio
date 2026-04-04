import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";

const BN: Record<string, string> = {
  cursor: "Git 반영 대기",
  push: "원격 푸시",
  branchDetect: "Git 브랜치 반영(compare)",
  git_branch_detect: "Git 브랜치 감지",
  git_branch_reflected: "Git 반영(compare)",
  prCreation: "PR 생성",
  pr_create: "플랫폼 PR 생성",
  review: "리뷰",
  security: "보안 점검",
  scm: "SCM",
  merge: "머지·검증",
};

function bnLabel(key: string | null | undefined): string | null {
  const k = String(key ?? "").trim();
  return k ? (BN[k] ?? k) : null;
}

/**
 * Stage 2 결과 패널·GET last용: Reviewer/SCM 로그가 아직 없을 때 사용자가 병목을 이해하도록 힌트를 붙인다.
 */
/** 런타임 모니터 없을 때: 경과만으로 Git 대기 가능성 힌트 (ms) */
const STAGE2_LONG_WAIT_GIT_HINT_MS = 45_000;

export function deriveStage2LiveHints(input: {
  executionWorkflowStatus: string | null;
  taskStatus: string;
  runStatus: string | null;
  commitStatus: string | null;
  pushStatus: string | null;
  prUrl: string | null;
  lastOrchestrationCommitStatus: string | null;
  lastOrchestrationPushStatus: string | null;
  /** TaskExecutionRun 기준 경과 — 긴 대기 시 Cursor 고정 힌트 완화 */
  stage2RunElapsedMs?: number | null;
}): {
  stage2UiHint: string | null;
  stage2EstimatedBottleneck: string | null;
  stage2LivePhaseLabel: string | null;
  stage2CurrentStep: string | null;
  stage2CurrentBottleneckHint: string | null;
} {
  const wf = String(input.executionWorkflowStatus ?? "").trim();
  const rs = String(input.runStatus ?? "").trim();
  const c = String(input.commitStatus ?? "");
  const p = String(input.pushStatus ?? "");
  const taskSt = String(input.taskStatus ?? "").trim();

  const empty = {
    stage2UiHint: null as string | null,
    stage2EstimatedBottleneck: null as string | null,
    stage2LivePhaseLabel: null as string | null,
    stage2CurrentStep: null as string | null,
    stage2CurrentBottleneckHint: null as string | null,
  };

  if (wf === EXECUTION_WORKFLOW.MERGED || wf === EXECUTION_WORKFLOW.FAILED || taskSt === "FAILED") {
    return empty;
  }

  if (taskSt === "TODO" && !rs) {
    return empty;
  }

  if (taskSt === "DONE" || taskSt === "COMPLETED") {
    return empty;
  }

  const locC = String(input.lastOrchestrationCommitStatus ?? "");
  const locP = String(input.lastOrchestrationPushStatus ?? "");
  const elapsedMs = typeof input.stage2RunElapsedMs === "number" ? input.stage2RunElapsedMs : 0;
  const longRunningLikelyGitWait = elapsedMs >= STAGE2_LONG_WAIT_GIT_HINT_MS;

  const pushedEvidence =
    /pushed|pr_opened|github_compare|delegated/i.test(c) ||
    /pushed|pr_opened|github_compare|delegated/i.test(p) ||
    /pushed|pr_opened/i.test(locP);
  const commitEvidence =
    c.includes("reported") ||
    c.includes("pushed") ||
    locC.includes("reported") ||
    locC.includes("pushed");

  const pack = (
    bottleneck: string,
    hint: string,
    phase: string,
    step: string
  ): ReturnType<typeof deriveStage2LiveHints> => ({
    stage2UiHint: hint,
    stage2EstimatedBottleneck: bottleneck,
    stage2LivePhaseLabel: phase,
    stage2CurrentStep: step,
    stage2CurrentBottleneckHint: bnLabel(bottleneck),
  });

  if (rs === "awaiting_git_reflection") {
    return pack("branchDetect", "실행 중 (Git 반영 대기 · Cursor는 참고)", "Git 브랜치 반영 대기", "git_reflect");
  }

  if (wf === EXECUTION_WORKFLOW.RUNNING || rs === "running") {
    if (!commitEvidence && !pushedEvidence) {
      if (longRunningLikelyGitWait) {
        return pack(
          "git_branch_detect",
          "실행 중 (Git 반영 대기 · Cursor는 참고)",
          "Git 브랜치 반영 대기",
          "git_branch_detect"
        );
      }
      return pack("cursor", "실행 중 (Git 반영 대기 · Cursor는 참고)", "Git 반영 대기", "git_wait");
    }
    if (commitEvidence && !pushedEvidence) {
      return pack("push", "실행 중 (Git 반영 대기 · Cursor는 참고)", "원격 푸시·반영 대기", "push");
    }
    if (pushedEvidence && !input.prUrl?.trim()) {
      return pack("branchDetect", "실행 중 (Git 반영 대기 · Cursor는 참고)", "Git 브랜치 반영 대기", "git_reflect");
    }
  }

  if (
    (wf === EXECUTION_WORKFLOW.COMMITTED || wf === EXECUTION_WORKFLOW.PENDING_APPLY) &&
    !input.prUrl?.trim()
  ) {
    return pack("branchDetect", "실행 중 (Git 반영 대기 · Cursor는 참고)", "Git 브랜치 반영 대기", "git_reflect");
  }

  if ((wf === EXECUTION_WORKFLOW.PR_OPENED || Boolean(input.prUrl?.trim())) && wf !== EXECUTION_WORKFLOW.MERGED) {
    if (wf === EXECUTION_WORKFLOW.REVIEW_PENDING) {
      return pack("review", "실행 중 (다음 단계 진행)", "리뷰 대기", "review");
    }
    if (wf === EXECUTION_WORKFLOW.SECURITY_PENDING) {
      return pack("security", "실행 중 (다음 단계 진행)", "보안 점검 중", "security");
    }
    if (wf === EXECUTION_WORKFLOW.SCM_PENDING || wf === EXECUTION_WORKFLOW.MERGE_PENDING) {
      return pack("scm", "실행 중 (다음 단계 진행)", "SCM 처리 중", "scm");
    }
    return pack("prCreation", "실행 중 (다음 단계 진행)", "PR 생성·확인 대기", "pr");
  }

  if (wf === EXECUTION_WORKFLOW.REVIEW_PENDING) {
    return pack("review", "실행 중 (역할 단계 진행)", "리뷰 대기", "review");
  }
  if (wf === EXECUTION_WORKFLOW.SECURITY_PENDING) {
    return pack("security", "실행 중 (역할 단계 진행)", "보안 점검 중", "security");
  }
  if (wf === EXECUTION_WORKFLOW.SCM_PENDING || wf === EXECUTION_WORKFLOW.MERGE_PENDING) {
    return pack("scm", "실행 중 (역할 단계 진행)", "SCM·머지 처리 중", "scm");
  }

  return pack("cursor", "실행 중 (Git 반영 대기 · Cursor는 참고)", "Git 반영 대기", "git_wait");
}
