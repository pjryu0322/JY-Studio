import type { EnvironmentTestLastDto } from "@/components/project-spec/api";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";

/** Stage 2 결과 패널용 SCM 표시(플랫폼 fallback 구분) */
export type Stage2ScmResultDisplay = "MERGED" | "BLOCKED" | "PLATFORM_FALLBACK" | "VERIFY_FAILED";

export type Stage2ExecutorDisplay = "PASS" | "FAIL" | "—" | "실행 중" | "대기 중";

export type Stage2ReviewSecurityDisplay = "PASS" | "FAIL" | "MISSING" | "DISABLED" | "—" | "대기 중";

export type Stage2FinalDisplay = "COMPLETED" | "PARTIAL" | "FAILED" | "—";

export type Stage2ExecutionSummary = {
  taskId: string;
  finalOutcome: Stage2FinalDisplay;
  executor: Stage2ExecutorDisplay;
  reviewer: { value: Stage2ReviewSecurityDisplay; reason: string | null };
  security: { value: Stage2ReviewSecurityDisplay; reason: string | null };
  scm: { value: Stage2ScmResultDisplay | "—" | "대기 중"; reason: string | null; platformFallback: boolean };
  totalTimeMs: number | null;
  bottleneckStage: string | null;
  bottleneckMs: number | null;
  /** 서버 힌트 또는 telemetry */
  currentPhaseLabel: string | null;
  uiHintLine: string | null;
  /** 세분화된 현재 단계 키 (예: cursor_push) */
  currentPhaseKey: string | null;
  currentStepKey: string | null;
  currentBottleneckHint: string | null;
  runElapsedMsFromServer: number | null;
  cursorStatus: EnvironmentTestLastDto["stage2CursorStatus"];
  gitStatus: EnvironmentTestLastDto["stage2GitStatus"];
  platformStatus: EnvironmentTestLastDto["stage2PlatformStatus"];
};

export function mapEnvironmentTestLastToStage2Summary(last: EnvironmentTestLastDto | null): Stage2ExecutionSummary | null {
  if (!last) return null;
  const pipelineEarly =
    Boolean(last.stage2UiHint?.trim()) &&
    !last.stage2FinalOutcome &&
    String(last.workflowStatus ?? "").trim() !== EXECUTION_WORKFLOW.MERGED;

  const exBase: Stage2ExecutorDisplay =
    last.stage2ExecutorResult === "PASS" || last.stage2ExecutorResult === "FAIL"
      ? last.stage2ExecutorResult
      : "—";
  const ex: Stage2ExecutorDisplay =
    pipelineEarly && exBase === "—" ? "실행 중" : exBase;

  const rvBase: Stage2ReviewSecurityDisplay =
    last.stage2ReviewerResult === "PASS" ||
    last.stage2ReviewerResult === "FAIL" ||
    last.stage2ReviewerResult === "MISSING" ||
    last.stage2ReviewerResult === "DISABLED"
      ? last.stage2ReviewerResult
      : "—";
  const rv: Stage2ReviewSecurityDisplay =
    pipelineEarly && rvBase === "—" ? "대기 중" : rvBase;

  const svBase: Stage2ReviewSecurityDisplay =
    last.stage2SecurityResult === "PASS" ||
    last.stage2SecurityResult === "FAIL" ||
    last.stage2SecurityResult === "MISSING" ||
    last.stage2SecurityResult === "DISABLED"
      ? last.stage2SecurityResult
      : "—";
  const sv: Stage2ReviewSecurityDisplay =
    pipelineEarly && svBase === "—" ? "대기 중" : svBase;

  let scmVal: Stage2ScmResultDisplay | "—" = "—";
  if (last.stage2ScmDisplay === "PASS") scmVal = "MERGED";
  else if (last.stage2ScmDisplay === "PLATFORM_FALLBACK") scmVal = "PLATFORM_FALLBACK";
  else if (last.stage2ScmDisplay === "BLOCKED") scmVal = "BLOCKED";
  else if (last.stage2ScmDisplay === "VERIFY_FAILED") scmVal = "VERIFY_FAILED";
  const scmOut: Stage2ScmResultDisplay | "—" | "대기 중" =
    pipelineEarly && scmVal === "—" ? "대기 중" : scmVal;

  const fin: Stage2FinalDisplay =
    last.stage2FinalOutcome === "COMPLETED" ||
    last.stage2FinalOutcome === "PARTIAL" ||
    last.stage2FinalOutcome === "FAILED"
      ? last.stage2FinalOutcome
      : "—";
  const bottleneckKey =
    last.stage2RuntimeBottleneckPhase?.trim() ||
    last.stage2EstimatedBottleneck?.trim() ||
    last.stage2TopBottleneckStage?.trim() ||
    null;
  const bottleneckMs =
    typeof last.stage2RuntimeBottleneckMs === "number"
      ? last.stage2RuntimeBottleneckMs
      : typeof last.stage2TopBottleneckMs === "number"
        ? last.stage2TopBottleneckMs
        : null;

  return {
    taskId: last.taskId,
    finalOutcome: fin,
    executor: ex,
    reviewer: { value: rv, reason: last.stage2ReviewerReason ?? null },
    security: { value: sv, reason: last.stage2SecurityReason ?? null },
    scm: {
      value: scmOut,
      reason: last.stage2ScmReason ?? null,
      platformFallback: last.stage2ScmParticipant === "PLATFORM",
    },
    totalTimeMs: typeof last.stage2TotalTimeMs === "number" ? last.stage2TotalTimeMs : null,
    bottleneckStage: bottleneckKey,
    bottleneckMs,
    currentPhaseLabel: last.stage2LivePhaseLabel?.trim() || null,
    uiHintLine: last.stage2UiHint?.trim() || null,
    currentPhaseKey: last.stage2CurrentPhase?.trim() || last.stage2CurrentStep?.trim() || null,
    currentStepKey: last.stage2CurrentStep?.trim() || null,
    currentBottleneckHint: last.stage2CurrentBottleneckHint?.trim() || null,
    runElapsedMsFromServer: typeof last.stage2RunElapsedMs === "number" ? last.stage2RunElapsedMs : null,
    cursorStatus: last.stage2CursorStatus ?? null,
    gitStatus: last.stage2GitStatus ?? null,
    platformStatus: last.stage2PlatformStatus ?? null,
  };
}

const BOTTLENECK_LABELS: Record<string, string> = {
  executor: "Executor(OpenAI)",
  cursor: "Cursor",
  cursor_prepare: "Cursor 준비",
  cursor_generate: "Cursor 코드 생성",
  cursor_commit: "Cursor 커밋",
  cursor_push: "Cursor push",
  git_branch_detect: "Git 브랜치 반영 대기",
  git_branch_reflected: "Git 반영(compare)",
  platform_pr_create: "플랫폼 PR 생성",
  pr_create: "플랫폼 PR 생성",
  push: "원격 푸시",
  branchDetect: "브랜치 반영(GitHub compare)",
  prCreation: "PR 생성",
  review: "Reviewer",
  security: "Security",
  scm: "SCM",
  merge: "Merge+Verify",
  mergeVerify: "Merge verify",
};

export function stage2BottleneckLabel(stage: string | null | undefined): string {
  const s = String(stage ?? "").trim();
  if (!s) return "—";
  return BOTTLENECK_LABELS[s] ?? s;
}
