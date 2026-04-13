/**
 * MVP — Git verification stubs (in-memory; no network).
 */

export interface BranchVerifyInput {
  repoUrl: string;
  branchName: string;
}

export interface DiffSummaryInput {
  repoUrl: string;
  baseRef: string;
  headRef: string;
}

export interface DiffSummaryStub {
  filesChanged: number;
  insertions: number;
  deletions: number;
}

export interface ChangedFilesInput {
  repoUrl: string;
  ref: string;
}

export type LatestCommitInput = { repoUrl: string; branch: string };

export type CommitDiffInput = { repoUrl: string; baseSha: string; headSha: string };

let branchExists = true;
let latestSha = "mvp000000000000000000000000000000000000";
let diffText = "diff --git a/mvp b/mvp\n+ok\n";
/** Test hook: next N calls to `verifyBranchExists` return false (GIT_BRANCH_MISSING path). */
let failNextBranchChecks = 0;

export function mvpGitFailNextBranchChecks(count: number): void {
  failNextBranchChecks = Math.max(0, count);
}

export function mvpGitResetStubs(): void {
  branchExists = true;
  latestSha = "mvp000000000000000000000000000000000000";
  diffText = "diff --git a/mvp b/mvp\n+ok\n";
  failNextBranchChecks = 0;
}

export function mvpGitConfigure(input: {
  branchExists?: boolean;
  latestSha?: string;
  diffText?: string;
}): void {
  if (input.branchExists !== undefined) branchExists = input.branchExists;
  if (input.latestSha !== undefined) latestSha = input.latestSha;
  if (input.diffText !== undefined) diffText = input.diffText;
}

export async function verifyBranchExists(input: BranchVerifyInput): Promise<boolean> {
  void input;
  if (failNextBranchChecks > 0) {
    failNextBranchChecks -= 1;
    return false;
  }
  return branchExists;
}

export async function getLatestCommit(input: LatestCommitInput): Promise<{ sha: string }> {
  void input;
  return { sha: latestSha };
}

export async function getCommitDiff(input: CommitDiffInput): Promise<string> {
  void input;
  return diffText;
}

export async function summarizeDiff(_input: DiffSummaryInput): Promise<DiffSummaryStub> {
  return { filesChanged: 0, insertions: 0, deletions: 0 };
}

export async function listChangedFiles(_input: ChangedFilesInput): Promise<string[]> {
  return [];
}
