import {
  githubRestApiBase,
  resolveGithubOwnerRepoStrict,
} from "@/lib/integration/githubRestCommon";
import { normalizeGithubPrHeadForSameRepoCreate } from "@/lib/service/githubEnvTestPullRequestService";
import { findOpenPullRequestByHeadBranch } from "@/lib/service/githubOpenPullRequestByHeadService";

export type GithubPullRequestDetail = Readonly<{
  readonly state?: string;
  readonly merged?: boolean;
  readonly title?: string;
  readonly base?: Readonly<{ readonly ref?: string }>;
  readonly head?: Readonly<{ readonly ref?: string; readonly sha?: string }>;
  readonly number?: number;
  readonly html_url?: string;
  readonly merge_commit_sha?: string | null;
  readonly mergeable?: boolean | null;
  readonly mergeable_state?: string | null;
}>;

export type GithubPullRequestFile = Readonly<{
  readonly filename?: string;
  readonly status?: string;
}>;

export type GithubPullRequestFetchError = Readonly<{
  readonly ok: false;
  readonly code: string;
  readonly message: string;
  readonly httpStatus?: number;
}>;

async function githubFetchJson<T>(
  url: string,
  token: string,
  userAgent: string,
): Promise<
  | Readonly<{ readonly ok: true; readonly data: T; readonly status: number }>
  | Readonly<{ readonly ok: false; readonly status: number; readonly body: string }>
> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": userAgent,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  const txt = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, body: txt };
  }
  try {
    return { ok: true, data: JSON.parse(txt) as T, status: res.status };
  } catch {
    return { ok: false, status: res.status, body: txt.slice(0, 500) };
  }
}

export async function fetchGithubPullRequestDetail(input: {
  readonly repoUrl: string;
  readonly pullNumber: number;
  readonly token: string;
  readonly userAgent?: string;
}): Promise<
  | Readonly<{ readonly ok: true; readonly pr: GithubPullRequestDetail }>
  | GithubPullRequestFetchError
> {
  const parsed = resolveGithubOwnerRepoStrict(input.repoUrl);
  if (!parsed) {
    return { ok: false, code: "REPO_NOT_GITHUB", message: "GitHub 저장소 URL이 아닙니다.", httpStatus: 400 };
  }
  const api = githubRestApiBase();
  const url = `${api}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/pulls/${input.pullNumber}`;
  const r = await githubFetchJson<GithubPullRequestDetail>(
    url,
    input.token,
    input.userAgent ?? "JYOrchestration/github-pr-ops",
  );
  if (!r.ok) {
    return {
      ok: false,
      code: "GITHUB_PR_FETCH_FAILED",
      message: `PR 조회 실패 HTTP ${r.status}`,
      httpStatus: r.status,
    };
  }
  return { ok: true, pr: r.data };
}

export async function fetchGithubPullRequestFiles(input: {
  readonly repoUrl: string;
  readonly pullNumber: number;
  readonly token: string;
  readonly userAgent?: string;
}): Promise<
  | Readonly<{ readonly ok: true; readonly files: readonly GithubPullRequestFile[] }>
  | GithubPullRequestFetchError
> {
  const parsed = resolveGithubOwnerRepoStrict(input.repoUrl);
  if (!parsed) {
    return { ok: false, code: "REPO_NOT_GITHUB", message: "GitHub 저장소 URL이 아닙니다.", httpStatus: 400 };
  }
  const api = githubRestApiBase();
  const url = `${api}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/pulls/${input.pullNumber}/files?per_page=100`;
  const r = await githubFetchJson<GithubPullRequestFile[]>(
    url,
    input.token,
    input.userAgent ?? "JYOrchestration/github-pr-ops-files",
  );
  if (!r.ok) {
    return {
      ok: false,
      code: "GITHUB_PR_FILES_FAILED",
      message: `PR 파일 목록 실패 HTTP ${r.status}`,
      httpStatus: r.status,
    };
  }
  const arr = Array.isArray(r.data) ? r.data : [];
  return { ok: true, files: arr };
}

export async function openOrReuseGithubPullRequest(input: {
  readonly repoUrl: string;
  readonly baseBranch: string;
  readonly headBranch: string;
  readonly githubAccessToken: string;
  readonly title: string;
  readonly body: string;
  readonly projectId?: string;
  readonly userAgent?: string;
}): Promise<
  | Readonly<{ readonly ok: true; readonly prNumber: number; readonly prUrl: string; readonly reusedExisting: boolean }>
  | Readonly<{ readonly ok: false; readonly message: string; readonly httpStatus?: number }>
> {
  const parsed = resolveGithubOwnerRepoStrict(input.repoUrl);
  if (!parsed) {
    return { ok: false, message: "GitHub 저장소 URL을 해석할 수 없습니다.", httpStatus: 400 };
  }
  const token = input.githubAccessToken.trim();
  if (!token) {
    return { ok: false, message: "GitHub Access Token이 필요합니다.", httpStatus: 503 };
  }

  const { headSentToGithub } = normalizeGithubPrHeadForSameRepoCreate(parsed.owner, input.headBranch);
  const baseBranch = input.baseBranch.trim();
  if (!headSentToGithub || !baseBranch) {
    return { ok: false, message: "base/head 브랜치가 필요합니다.", httpStatus: 400 };
  }

  const existing = await findOpenPullRequestByHeadBranch({
    repoUrl: input.repoUrl,
    headBranch: headSentToGithub,
    githubAccessToken: token,
    projectId: input.projectId,
  });
  if (existing) {
    return {
      ok: true,
      prNumber: existing.prNumber,
      prUrl: existing.prUrl,
      reusedExisting: true,
    };
  }

  const api = githubRestApiBase();
  const url = `${api}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/pulls`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": input.userAgent ?? "JYOrchestration/github-pr-ops",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: input.title,
      head: headSentToGithub,
      base: baseBranch,
      body: input.body,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      message: `GitHub PR 생성 실패 (HTTP ${res.status})`,
      httpStatus: res.status,
    };
  }
  try {
    const json = JSON.parse(text) as { number?: number; html_url?: string };
    const prNumber = typeof json.number === "number" ? json.number : undefined;
    const prUrl = typeof json.html_url === "string" ? json.html_url : undefined;
    if (!prNumber || !prUrl) {
      return { ok: false, message: "GitHub PR 응답 형식이 올바르지 않습니다.", httpStatus: 502 };
    }
    return { ok: true, prNumber, prUrl, reusedExisting: false };
  } catch {
    return { ok: false, message: "GitHub PR 응답 JSON 파싱 실패", httpStatus: 502 };
  }
}
