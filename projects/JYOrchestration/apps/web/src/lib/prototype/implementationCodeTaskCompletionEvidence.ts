/**
 * CodeTask 완료·통합 가능 판정에 쓰이는 GitHub 검증 증거 (SoT).
 * `githubOutcomeSaved` / Cursor 진행 상태만으로는 완료로 보지 않는다.
 */
export function hasVerifiedCodeTaskCompletionEvidence(input: {
  readonly commitSha?: string | null;
  readonly githubBranchHeadCommit?: string | null;
  readonly branchHeadCommit?: string | null;
  readonly noCodeChangeEvidence?: boolean | null;
}): boolean {
  return (
    Boolean(String(input.commitSha ?? "").trim()) ||
    Boolean(String(input.githubBranchHeadCommit ?? "").trim()) ||
    Boolean(String(input.branchHeadCommit ?? "").trim()) ||
    input.noCodeChangeEvidence === true
  );
}

export function readVerifiedCommitShaFromRun(input: {
  readonly commitSha?: string | null;
  readonly branchHeadCommitSha?: string | null;
}): string | null {
  const sha =
    String(input.commitSha ?? "").trim() ||
    String(input.branchHeadCommitSha ?? "").trim();
  return sha || null;
}
