import { githubRestApiBase, resolveGithubOwnerRepoStrict } from "@/lib/integration/githubRestCommon";

type GithubCompareFile = Readonly<{ readonly filename?: string }>;

type GithubCompareCommit = Readonly<{ readonly sha?: string }>;

export type GithubBranchCompareSummary = Readonly<{
  readonly aheadBy: number;
  readonly status: string;
  readonly changedFiles: readonly string[];
  readonly tipCommitSha: string | null;
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
  if (!res.ok) return { ok: false, status: res.status, body: txt.slice(0, 500) };
  try {
    return { ok: true, data: JSON.parse(txt) as T, status: res.status };
  } catch {
    return { ok: false, status: res.status, body: txt.slice(0, 500) };
  }
}

export async function fetchGithubBranchHeadSha(input: {
  readonly gitRepoUrl: string;
  readonly branch: string;
  readonly githubToken: string;
  readonly userAgent?: string;
}): Promise<
  | Readonly<{ readonly ok: true; readonly sha: string }>
  | Readonly<{ readonly ok: false; readonly status: number }>
> {
  const branch = String(input.branch ?? "").trim();
  if (!branch) return { ok: false, status: 404 };

  const parsed = resolveGithubOwnerRepoStrict(input.gitRepoUrl);
  if (!parsed) return { ok: false, status: 404 };

  const userAgent = input.userAgent ?? "JYOrchestration/github-branch-head";
  const api = githubRestApiBase();
  const owner = encodeURIComponent(parsed.owner);
  const repo = encodeURIComponent(parsed.repo);
  const refUrl = `${api}/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`;
  const refRes = await githubFetchJson<GithubRefResponse>(refUrl, input.githubToken.trim(), userAgent);
  if (!refRes.ok) return { ok: false, status: refRes.status };
  const sha = String(refRes.data?.object?.sha ?? "").trim();
  if (!sha) return { ok: false, status: 404 };
  return { ok: true, sha };
}

export async function fetchGithubBaseBranchHeadSha(input: {
  readonly gitRepoUrl: string;
  readonly baseBranch: string;
  readonly githubToken: string;
  readonly userAgent?: string;
}): Promise<
  | Readonly<{ readonly ok: true; readonly sha: string }>
  | Readonly<{ readonly ok: false; readonly status: number }>
> {
  const base = String(input.baseBranch ?? "main").trim() || "main";
  return fetchGithubBranchHeadSha({
    gitRepoUrl: input.gitRepoUrl,
    branch: base,
    githubToken: input.githubToken,
    userAgent: input.userAgent,
  });
}

type GithubCompareResponse = Readonly<{
  readonly ahead_by?: number;
  readonly status?: string;
  readonly files?: readonly GithubCompareFile[];
  readonly commits?: readonly GithubCompareCommit[];
}>;

export async function fetchGithubBranchCompareSummary(input: {
  readonly gitRepoUrl: string;
  readonly baseBranch: string;
  readonly headBranch: string;
  readonly githubToken: string;
  readonly userAgent?: string;
}): Promise<
  | Readonly<{ readonly ok: true; readonly summary: GithubBranchCompareSummary }>
  | Readonly<{ readonly ok: false; readonly status: number }>
> {
  const base = String(input.baseBranch ?? "main").trim() || "main";
  const head = String(input.headBranch ?? "").trim();
  if (!head) return { ok: false, status: 404 };

  const parsed = resolveGithubOwnerRepoStrict(input.gitRepoUrl);
  if (!parsed) return { ok: false, status: 404 };

  const userAgent = input.userAgent ?? "JYOrchestration/github-branch-head";
  const api = githubRestApiBase();
  const owner = encodeURIComponent(parsed.owner);
  const repo = encodeURIComponent(parsed.repo);
  const url = `${api}/repos/${owner}/${repo}/compare/${encodeURIComponent(`${base}...${head}`)}`;
  const res = await githubFetchJson<GithubCompareResponse>(url, input.githubToken.trim(), userAgent);
  if (!res.ok) return { ok: false, status: res.status };

  const commits = res.data.commits ?? [];
  const lastCommitSha = commits.length
    ? String(commits[commits.length - 1]?.sha ?? "").trim() || null
    : null;
  const changedFiles = (res.data.files ?? [])
    .map((f) => String(f.filename ?? "").trim())
    .filter(Boolean);

  return {
    ok: true,
    summary: {
      aheadBy: Number(res.data.ahead_by ?? 0),
      status: String(res.data.status ?? "").trim(),
      changedFiles,
      tipCommitSha: lastCommitSha,
    },
  };
}

export function branchHeadDiffIndicatesNewCommit(input: {
  readonly headSha: string;
  readonly baseHeadSha: string;
  readonly compare?: GithubBranchCompareSummary | null;
}): boolean {
  if (input.headSha !== input.baseHeadSha) return true;
  const compare = input.compare;
  if (!compare) return false;
  if (compare.aheadBy > 0) return true;
  const status = compare.status.toLowerCase();
  return status === "ahead" || status === "diverged";
}
