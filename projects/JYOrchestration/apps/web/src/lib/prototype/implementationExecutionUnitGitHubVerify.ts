export type ExecutionUnitGithubVerifyEvaluationV1 =
  | Readonly<{ readonly status: "verified"; readonly commitSha: string; readonly afterHeadSha: string }>
  | Readonly<{ readonly status: "verified_no_code_change"; readonly commitSha: string; readonly afterHeadSha: string }>
  | Readonly<{ readonly status: "failed_commit_not_created"; readonly reason: string }>;

export function evaluateExecutionUnitGithubVerifyOutcome(input: {
  readonly beforeHeadSha?: string | null;
  readonly afterHeadSha?: string | null;
  readonly noCodeChangeEvidence?: string | null;
}): ExecutionUnitGithubVerifyEvaluationV1 {
  const before = String(input.beforeHeadSha ?? "").trim();
  const after = String(input.afterHeadSha ?? "").trim();
  const noCode = String(input.noCodeChangeEvidence ?? "").trim();

  if (!after) {
    return { status: "failed_commit_not_created", reason: "github_head_commit_missing" };
  }

  if (!before) {
    return { status: "verified", commitSha: after, afterHeadSha: after };
  }

  if (before !== after) {
    return { status: "verified", commitSha: after, afterHeadSha: after };
  }

  if (noCode) {
    return { status: "verified_no_code_change", commitSha: after, afterHeadSha: after };
  }

  return { status: "failed_commit_not_created", reason: "github_no_new_commit" };
}
