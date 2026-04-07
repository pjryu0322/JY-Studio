/**
 * Stage2 GitHub monitor (ENV_TEST_STAGE2 only).
 *
 * GitHub is the source of truth:
 * - Do NOT wait for Cursor terminal completion.
 * - If branch exists → proceed.
 * - If compare ahead_by > 0 → treat as reflected and proceed immediately.
 *
 * Polling rules:
 * - interval 1~2s (jittered)
 * - no fixed sleep after reflection
 * - retries only on API failure / expected 404 progression
 */

import { fetchGithubBranchHeadExists, fetchGithubCompareSnapshot } from "@/lib/service/githubCompareService";

function sleepMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function jitteredIntervalMs(baseMs: number): number {
  const j = Math.floor(Math.random() * 250); // 0~249ms
  return Math.max(250, baseMs + j);
}

export async function waitForStage2BranchExists(input: {
  repoUrl: string;
  headBranch: string;
  githubAccessToken?: string | null;
  projectId: string;
  /** hard timeout in ms */
  timeoutMs: number;
  /** polling interval base (ms). recommended 1000~2000 */
  pollIntervalMs?: number;
}): Promise<
  | { ok: true; headSha: string | null; attempts: number; elapsedMs: number }
  | { ok: false; code: "TIMEOUT" | "API_ERROR"; message: string; attempts: number; elapsedMs: number; httpStatus?: number }
> {
  const started = Date.now();
  const intervalBase = Math.min(2000, Math.max(1000, input.pollIntervalMs ?? 1200));
  let attempts = 0;

  while (true) {
    attempts += 1;
    const res = await fetchGithubBranchHeadExists({
      repoUrl: input.repoUrl,
      branch: input.headBranch,
      githubAccessToken: input.githubAccessToken ?? null,
      projectId: input.projectId,
    });
    if (res.ok) {
      return { ok: true, headSha: res.headSha ?? null, attempts, elapsedMs: Date.now() - started };
    }
    const elapsedMs = Date.now() - started;
    if (elapsedMs >= input.timeoutMs) {
      return {
        ok: false,
        code: "TIMEOUT",
        message: `Stage2 branch exists timeout (${input.headBranch})`,
        attempts,
        elapsedMs,
        httpStatus: res.httpStatus,
      };
    }
    // 404 = expected while branch not created yet
    if (res.httpStatus != null && res.httpStatus !== 404) {
      // transient API errors: keep polling unless hard timeout hits
    }
    await sleepMs(jitteredIntervalMs(intervalBase));
  }
}

export async function getStage2CompareSnapshot(input: {
  repoUrl: string;
  baseBranch: string;
  headBranch: string;
  githubAccessToken?: string | null;
  projectId: string;
}): Promise<Awaited<ReturnType<typeof fetchGithubCompareSnapshot>>> {
  return await fetchGithubCompareSnapshot({
    repoUrl: input.repoUrl,
    base: input.baseBranch,
    head: input.headBranch,
    maxFiles: 80,
    githubAccessToken: input.githubAccessToken ?? null,
    projectId: input.projectId,
    allowUnauthenticated: true,
  });
}

export async function waitForStage2BranchReflected(input: {
  repoUrl: string;
  baseBranch: string;
  headBranch: string;
  githubAccessToken?: string | null;
  projectId: string;
  timeoutMs: number;
  pollIntervalMs?: number;
}): Promise<
  | {
      ok: true;
      compareOkAtMs: number;
      aheadBy: number;
      headSha: string | null;
      changedFiles: string[];
      diffSummary: string;
      attempts: number;
      elapsedMs: number;
    }
  | { ok: false; code: "TIMEOUT" | "COMPARE_ERROR"; message: string; attempts: number; elapsedMs: number; httpStatus?: number }
> {
  const started = Date.now();
  const intervalBase = Math.min(2000, Math.max(1000, input.pollIntervalMs ?? 1200));
  let attempts = 0;

  while (true) {
    attempts += 1;
    const compare = await getStage2CompareSnapshot({
      repoUrl: input.repoUrl,
      baseBranch: input.baseBranch,
      headBranch: input.headBranch,
      githubAccessToken: input.githubAccessToken ?? null,
      projectId: input.projectId,
    });
    if (compare.ok && compare.data.aheadBy > 0) {
      const okAt = Date.now();
      return {
        ok: true,
        compareOkAtMs: okAt,
        aheadBy: compare.data.aheadBy,
        headSha: compare.data.headSha ?? null,
        changedFiles: compare.data.changedFiles,
        diffSummary: compare.data.diffSummary,
        attempts,
        elapsedMs: okAt - started,
      };
    }

    const elapsedMs = Date.now() - started;
    if (elapsedMs >= input.timeoutMs) {
      return {
        ok: false,
        code: "TIMEOUT",
        message: `Stage2 branch reflected timeout (${input.baseBranch}...${input.headBranch})`,
        attempts,
        elapsedMs,
      };
    }

    // compare API failure → keep retrying (source of truth remains GitHub; only hard timeout fails)
    await sleepMs(jitteredIntervalMs(intervalBase));
  }
}

