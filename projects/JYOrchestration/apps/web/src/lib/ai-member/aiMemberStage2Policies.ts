import type { EnvironmentTestLastDto } from "@/components/project-spec/api";

/** Stage 2 결과 패널용 SCM 표시(플랫폼 fallback 구분) */
export type Stage2ScmResultDisplay = "MERGED" | "BLOCKED" | "PLATFORM_FALLBACK" | "VERIFY_FAILED";

export type Stage2ExecutorDisplay = "PASS" | "FAIL" | "—";

export type Stage2ReviewSecurityDisplay = "PASS" | "FAIL" | "MISSING" | "DISABLED" | "—";

export type Stage2FinalDisplay = "COMPLETED" | "PARTIAL" | "FAILED" | "—";

export type Stage2ExecutionSummary = {
  taskId: string;
  finalOutcome: Stage2FinalDisplay;
  executor: Stage2ExecutorDisplay;
  reviewer: { value: Stage2ReviewSecurityDisplay; reason: string | null };
  security: { value: Stage2ReviewSecurityDisplay; reason: string | null };
  scm: { value: Stage2ScmResultDisplay | "—"; reason: string | null; platformFallback: boolean };
  totalTimeMs: number | null;
  bottleneckStage: string | null;
  bottleneckMs: number | null;
};

export function mapEnvironmentTestLastToStage2Summary(last: EnvironmentTestLastDto | null): Stage2ExecutionSummary | null {
  if (!last) return null;
  const ex: Stage2ExecutorDisplay =
    last.stage2ExecutorResult === "PASS" || last.stage2ExecutorResult === "FAIL"
      ? last.stage2ExecutorResult
      : "—";
  const rv: Stage2ReviewSecurityDisplay =
    last.stage2ReviewerResult === "PASS" ||
    last.stage2ReviewerResult === "FAIL" ||
    last.stage2ReviewerResult === "MISSING" ||
    last.stage2ReviewerResult === "DISABLED"
      ? last.stage2ReviewerResult
      : "—";
  const sv: Stage2ReviewSecurityDisplay =
    last.stage2SecurityResult === "PASS" ||
    last.stage2SecurityResult === "FAIL" ||
    last.stage2SecurityResult === "MISSING" ||
    last.stage2SecurityResult === "DISABLED"
      ? last.stage2SecurityResult
      : "—";
  let scmVal: Stage2ScmResultDisplay | "—" = "—";
  if (last.stage2ScmDisplay === "PASS") scmVal = "MERGED";
  else if (last.stage2ScmDisplay === "PLATFORM_FALLBACK") scmVal = "PLATFORM_FALLBACK";
  else if (last.stage2ScmDisplay === "BLOCKED") scmVal = "BLOCKED";
  else if (last.stage2ScmDisplay === "VERIFY_FAILED") scmVal = "VERIFY_FAILED";
  const fin: Stage2FinalDisplay =
    last.stage2FinalOutcome === "COMPLETED" ||
    last.stage2FinalOutcome === "PARTIAL" ||
    last.stage2FinalOutcome === "FAILED"
      ? last.stage2FinalOutcome
      : "—";
  return {
    taskId: last.taskId,
    finalOutcome: fin,
    executor: ex,
    reviewer: { value: rv, reason: last.stage2ReviewerReason ?? null },
    security: { value: sv, reason: last.stage2SecurityReason ?? null },
    scm: {
      value: scmVal,
      reason: last.stage2ScmReason ?? null,
      platformFallback: last.stage2ScmParticipant === "PLATFORM",
    },
    totalTimeMs: typeof last.stage2TotalTimeMs === "number" ? last.stage2TotalTimeMs : null,
    bottleneckStage: last.stage2TopBottleneckStage ?? null,
    bottleneckMs: typeof last.stage2TopBottleneckMs === "number" ? last.stage2TopBottleneckMs : null,
  };
}

const BOTTLENECK_LABELS: Record<string, string> = {
  executor: "Executor(OpenAI)",
  cursor: "Cursor",
  branchDetect: "브랜치 반영",
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
