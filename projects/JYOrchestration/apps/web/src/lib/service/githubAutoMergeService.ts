import { isExecutionSafeMode } from "@/lib/production/safeMode";

export const GITHUB_MERGE_ERROR_CODES = {
  SAFE_MODE: "GITHUB_MERGE_SAFE_MODE",
  NO_TOKEN: "GITHUB_MERGE_MISSING_TOKEN",
  INVALID_PR_URL: "GITHUB_MERGE_INVALID_PR_URL",
  API_ERROR: "GITHUB_MERGE_GITHUB_API_ERROR",
  NOT_MERGEABLE_YET: "GITHUB_MERGE_NOT_MERGEABLE_YET",
} as const;

function githubApiBase(): string {
  const b = process.env.GITHUB_API_URL?.trim();
  if (b) return b.replace(/\/$/, "");
  return "https://api.github.com";
}

export function isAutoMergeEnabled(): boolean {
  return process.env.EXECUTION_LOOP_AUTO_MERGE === "1";
}

export function parseGithubPrUrl(prUrl: string): { owner: string; repo: string; number: number } | null {
  const u = String(prUrl ?? "").trim();
  if (!u) return null;
  try {
    const url = new URL(u);
    const host = url.hostname.replace(/^www\./, "");
    if (host !== "github.com") return null;
    const seg = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
    // /{owner}/{repo}/pull/{number}
    const pullIdx = seg.findIndex((s) => s.toLowerCase() === "pull");
    if (seg.length < 4 || pullIdx < 0 || pullIdx + 1 >= seg.length) return null;
    const owner = seg[0];
    const repo = seg[1]?.replace(/\.git$/i, "") ?? "";
    const numRaw = seg[pullIdx + 1];
    const number = Number.parseInt(numRaw, 10);
    if (!owner || !repo || !Number.isFinite(number) || number <= 0) return null;
    return { owner, repo, number };
  } catch {
    return null;
  }
}

type PullJson = {
  state?: string;
  merged?: boolean;
  mergeable?: boolean | null;
  mergeable_state?: string;
  number?: number;
  html_url?: string;
  title?: string;
  head?: { sha?: string };
};

export async function autoMergePullRequest(params: {
  prUrl: string;
  /** Execution setup(DB)에 저장된 프로젝트 GitHub 토큰 */
  githubAccessToken: string | null | undefined;
  mergeMethod?: "merge" | "squash" | "rebase";
  commitTitle?: string;
}): Promise<
  | {
      ok: true;
      merged: boolean;
      pullRequest: { owner: string; repo: string; number: number; url: string };
      detail?: Record<string, unknown>;
    }
  | { ok: false; code: string; message: string; httpStatus?: number; detail?: Record<string, unknown> }
> {
  if (isExecutionSafeMode()) {
    return { ok: false, code: GITHUB_MERGE_ERROR_CODES.SAFE_MODE, message: "Safe mode에서 PR 자동 머지는 비활성화됩니다." };
  }
  const token = String(params.githubAccessToken ?? "").trim();
  if (!token) {
    return {
      ok: false,
      code: GITHUB_MERGE_ERROR_CODES.NO_TOKEN,
      message: "실행 환경에 저장된 GitHub 토큰이 없어 PR 자동 머지를 수행할 수 없습니다.",
      httpStatus: 503,
    };
  }
  const parsed = parseGithubPrUrl(params.prUrl);
  if (!parsed) {
    return {
      ok: false,
      code: GITHUB_MERGE_ERROR_CODES.INVALID_PR_URL,
      message: "GitHub PR URL 형식이 아닙니다.",
      httpStatus: 400,
    };
  }
  const { owner, repo, number } = parsed;
  const api = githubApiBase();

  // 1) PR 상태 조회 (이미 merged/closed면 종료)
  let pr: PullJson;
  try {
    const res = await fetch(`${api}/repos/${owner}/${repo}/pulls/${number}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "JYOrchestration/auto-merge",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    const txt = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        code: GITHUB_MERGE_ERROR_CODES.API_ERROR,
        message: `GitHub PR 조회 실패 (HTTP ${res.status})`,
        httpStatus: res.status,
        detail: { body: txt.slice(0, 2000) },
      };
    }
    pr = JSON.parse(txt) as PullJson;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, code: GITHUB_MERGE_ERROR_CODES.API_ERROR, message: msg, httpStatus: 502 };
  }

  const state = String(pr.state ?? "").toUpperCase();
  if (pr.merged === true || state === "MERGED") {
    return {
      ok: true,
      merged: true,
      pullRequest: { owner, repo, number, url: String(pr.html_url ?? params.prUrl) },
      detail: { alreadyMerged: true },
    };
  }
  if (state === "CLOSED") {
    return {
      ok: false,
      code: GITHUB_MERGE_ERROR_CODES.NOT_MERGEABLE_YET,
      message: "PR이 CLOSED 상태라 자동 머지를 수행할 수 없습니다.",
      httpStatus: 409,
      detail: { state },
    };
  }

  // 2) 머지 시도 (조건 미충족이면 405/409 등으로 거절될 수 있음)
  const mergeMethod = params.mergeMethod ?? "squash";
  try {
    const res = await fetch(`${api}/repos/${owner}/${repo}/pulls/${number}/merge`, {
      method: "PUT",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "JYOrchestration/auto-merge",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        merge_method: mergeMethod,
        ...(params.commitTitle ? { commit_title: params.commitTitle } : {}),
      }),
    });
    const txt = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        code: GITHUB_MERGE_ERROR_CODES.NOT_MERGEABLE_YET,
        message: `PR 자동 머지 거절 (HTTP ${res.status})`,
        httpStatus: res.status,
        detail: { body: txt.slice(0, 2000), mergeMethod, mergeable_state: pr.mergeable_state ?? null },
      };
    }
    return {
      ok: true,
      merged: true,
      pullRequest: { owner, repo, number, url: String(pr.html_url ?? params.prUrl) },
      detail: { mergeMethod, headSha: pr.head?.sha ?? null },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, code: GITHUB_MERGE_ERROR_CODES.API_ERROR, message: msg, httpStatus: 502 };
  }
}

