/**
 * 프로토타입 PR/Merge — 일반 GitHub 헬퍼만 사용. ENV_TEST PR 제목/화이트리스트 규칙 미사용.
 */

import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";
import { githubRestApiBase, resolveGithubOwnerRepoStrict } from "@/lib/integration/githubRestCommon";
import { autoMergePullRequest } from "@/lib/service/githubAutoMergeService";
import { createGithubPullRequestFromBranch } from "@/lib/service/githubPullRequestFromBranchService";
import { logPrototypePipelineEvent } from "@/lib/prototype/prototypeRunLog";

export type PrototypePrBlocked = Readonly<{ readonly blocked: true; readonly message: string }>;

function encodeGithubRefBranchPath(branch: string): string {
  const s = String(branch ?? "").trim();
  if (!s) return "";
  return s
    .split("/")
    .filter((p) => p.length > 0)
    .map((p) => encodeURIComponent(p))
    .join("/");
}

async function githubHeadRefExists(input: {
  repoUrl: string;
  headBranch: string;
  githubAccessToken: string | null;
}): Promise<{ ok: true } | { ok: false; httpStatus?: number; message: string }> {
  const token = String(input.githubAccessToken ?? "").trim();
  if (!token) return { ok: false, message: "GitHub 토큰이 없습니다." };
  const parsed = resolveGithubOwnerRepoStrict(input.repoUrl);
  if (!parsed) return { ok: false, message: "GitHub 저장소 URL이 아닙니다." };
  const refPath = encodeGithubRefBranchPath(input.headBranch);
  if (!refPath) return { ok: false, message: "headBranch가 비어 있습니다." };
  const api = githubRestApiBase();
  const url = `${api}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/git/ref/heads/${refPath}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "JYOrchestration/prototype-pr",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (res.ok) return { ok: true };
    return { ok: false, httpStatus: res.status, message: `head ref 확인 실패 (HTTP ${res.status})` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }
}

export async function waitForGithubHeadRefVisible(input: {
  repoUrl: string;
  headBranch: string;
  githubAccessToken: string | null;
  attempts: number;
  intervalMs: number;
}): Promise<{ ok: true } | { ok: false } & PrototypePrBlocked> {
  const a = Math.max(1, Math.min(30, Math.floor(input.attempts)));
  const interval = Math.max(250, Math.min(10_000, Math.floor(input.intervalMs)));
  for (let i = 1; i <= a; i += 1) {
    const res = await githubHeadRefExists({
      repoUrl: input.repoUrl,
      headBranch: input.headBranch,
      githubAccessToken: input.githubAccessToken,
    });
    if (res.ok) return { ok: true };
    if (res.httpStatus && res.httpStatus !== 404) {
      return { ok: false, blocked: true, message: res.message };
    }
    if (i < a) await new Promise((r) => setTimeout(r, interval));
  }
  return {
    ok: false,
    blocked: true,
    message: `GitHub에서 head 브랜치를 찾지 못했습니다(브랜치=${input.headBranch}). 푸시 지연/푸시 실패 가능.`,
  };
}

export async function openPrototypePr(input: Readonly<{
  run: PrototypeRun;
  projectName: string;
  repoUrl: string;
  baseBranch: string;
  githubAccessToken: string | null;
  projectId: string;
}>): Promise<
  | { readonly ok: true; readonly prUrl: string; readonly prNumber: number }
  | { readonly ok: false } & PrototypePrBlocked
> {
  // Guard: PR 생성 전에 head ref 가시성 확인(전파 지연 흡수)
  const guard = await waitForGithubHeadRefVisible({
    repoUrl: input.repoUrl,
    headBranch: input.run.branchName,
    githubAccessToken: input.githubAccessToken,
    attempts: 10,
    intervalMs: 2000,
  });
  if (!guard.ok) return guard;

  const shortId = input.run.id.replace(/-/g, "").slice(0, 8);
  const title = `[Prototype] ${input.projectName} run ${shortId}`;
  // Create PR with retry for 422 head invalid: re-check ref, then retry.
  let lastMsg: string | null = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const pr = await createGithubPullRequestFromBranch({
      repoUrl: input.repoUrl,
      baseBranch: input.baseBranch,
      headBranch: input.run.branchName,
      title,
      body: `Prototype automation run\n- template: ${input.run.selectedTemplate}\n- branch: ${input.run.branchName}`,
      githubAccessToken: input.githubAccessToken,
      projectId: input.projectId,
    });
    if (pr.ok) {
      logPrototypePipelineEvent("prototype_pr_opened", {
        projectId: input.projectId,
        runId: input.run.id,
        prNumber: pr.data.pullRequestNumber,
      });
      return { ok: true, prUrl: pr.data.pullRequestUrl, prNumber: pr.data.pullRequestNumber };
    }
    lastMsg = pr.message;
    const http = pr.httpStatus ?? null;
    const body = pr.detail && typeof pr.detail.body === "string" ? pr.detail.body : "";
    const headInvalid = http === 422 && /\"field\"\\s*:\\s*\"head\"/i.test(body) && /\"code\"\\s*:\\s*\"invalid\"/i.test(body);
    if (!headInvalid) break;
    // re-check ref, then retry
    const again = await waitForGithubHeadRefVisible({
      repoUrl: input.repoUrl,
      headBranch: input.run.branchName,
      githubAccessToken: input.githubAccessToken,
      attempts: 5,
      intervalMs: 2000,
    });
    if (!again.ok) return again;
  }
  return { ok: false, blocked: true, message: lastMsg ?? "PR 생성에 실패했습니다." };
}

export async function mergePrototypePr(input: Readonly<{
  run: PrototypeRun;
  githubAccessToken: string | null;
  projectId: string;
}>): Promise<
  | { readonly ok: true; readonly mergeSha: string | null }
  | { readonly ok: false } & PrototypePrBlocked
> {
  const url = input.run.prUrl?.trim();
  if (!url) {
    return { ok: false, blocked: true, message: "PR URL 없음" };
  }
  const mr = await autoMergePullRequest({
    prUrl: url,
    githubAccessToken: input.githubAccessToken,
    mergeMethod: "merge",
  });
  if (!mr.ok) {
    return { ok: false, blocked: true, message: mr.message };
  }
  const headSha =
    mr.ok && mr.detail && typeof (mr.detail as { headSha?: unknown }).headSha === "string"
      ? String((mr.detail as { headSha: string }).headSha).trim()
      : "";
  logPrototypePipelineEvent("prototype_merged", { projectId: input.projectId, runId: input.run.id });
  return { ok: true, mergeSha: headSha || null };
}
