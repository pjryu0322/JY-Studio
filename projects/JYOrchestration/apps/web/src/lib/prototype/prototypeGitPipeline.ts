/**
 * PR / Merge 경계 — ENV_TEST 병합 서비스를 사용하지 않습니다.
 */

export type PrototypePrCreateInput = Readonly<{
  projectId: string;
  runId: string;
  branchName: string;
  title: string;
  body: string;
}>;

export type PrototypePrCreateResult =
  | { readonly ok: true; readonly prUrl: string; readonly prNumber: number }
  | { readonly ok: false; readonly blocked: true; readonly code: "NOT_IMPLEMENTED"; readonly message: string };

export type PrototypeMergeInput = Readonly<{
  projectId: string;
  runId: string;
  prNumber: number;
}>;

export type PrototypeMergeResult =
  | { readonly ok: true; readonly mergeCommitSha: string }
  | { readonly ok: false; readonly blocked: true; readonly code: "NOT_IMPLEMENTED"; readonly message: string };

export async function createPrototypePullRequest(_input: PrototypePrCreateInput): Promise<PrototypePrCreateResult> {
  return {
    ok: false,
    blocked: true,
    code: "NOT_IMPLEMENTED",
    message: "프로토타입 전용 PR 생성은 아직 연결되지 않았습니다.",
  };
}

export async function mergePrototypePullRequest(_input: PrototypeMergeInput): Promise<PrototypeMergeResult> {
  return {
    ok: false,
    blocked: true,
    code: "NOT_IMPLEMENTED",
    message: "프로토타입 전용 Merge는 아직 연결되지 않았습니다.",
  };
}
