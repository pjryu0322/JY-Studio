import { githubRestApiBase, resolveGithubOwnerRepoStrict } from "@/lib/integration/githubRestCommon";
import { encodeGithubRefBranchPath } from "@/lib/prototype/githubIntegrationBranchService";

type GithubRefResponse = Readonly<{ readonly object?: Readonly<{ readonly sha?: string }> }>;

type GithubBranchResponse = Readonly<{ readonly commit?: Readonly<{ readonly sha?: string }> }>;

export type GithubBranchLookupSource = "exact_get" | "candidate_search" | "legacy_fallback";

export type GithubBranchLookupResultV1 =
  | Readonly<{
      readonly status: "found";
      readonly branchName: string;
      readonly headSha: string;
      readonly source: GithubBranchLookupSource;
      readonly apiStatus?: number;
      readonly lookupAttempts: number;
    }>
  | Readonly<{
      readonly status: "missing";
      readonly branchName: string;
      readonly source: GithubBranchLookupSource;
      readonly apiStatus?: number;
      readonly errorMessage?: string;
      readonly lookupAttempts: number;
    }>
  | Readonly<{
      readonly status: "failed";
      readonly branchName: string;
      readonly source: GithubBranchLookupSource;
      readonly apiStatus?: number;
      readonly errorMessage: string;
      readonly lookupAttempts: number;
    }>;

export type GithubBranchLookupRetryEventV1 = Readonly<{
  readonly branchName: string;
  readonly attempt: number;
  readonly apiStatus?: number;
  readonly reason: string;
}>;

const CANONICAL_BRANCH_LOOKUP_RETRY_DELAYS_MS: readonly number[] = [0, 3000, 7000];

export function isFatalGithubBranchLookupHttpStatus(status: number): boolean {
  return status === 401 || status === 403;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

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

async function fetchGithubBranchHeadShaOnce(input: {
  readonly gitRepoUrl: string;
  readonly branchName: string;
  readonly githubToken: string;
  readonly userAgent: string;
}): Promise<
  | Readonly<{ readonly ok: true; readonly headSha: string; readonly apiStatus: number }>
  | Readonly<{ readonly ok: false; readonly apiStatus: number; readonly errorMessage: string }>
> {
  const branchName = String(input.branchName ?? "").trim();
  if (!branchName) {
    return { ok: false, apiStatus: 404, errorMessage: "branch name empty" };
  }
  const parsed = resolveGithubOwnerRepoStrict(input.gitRepoUrl);
  if (!parsed) {
    return { ok: false, apiStatus: 404, errorMessage: "invalid repository url" };
  }
  const api = githubRestApiBase();
  const owner = encodeURIComponent(parsed.owner);
  const repo = encodeURIComponent(parsed.repo);
  const refPath = encodeGithubRefBranchPath(branchName);
  if (refPath) {
    const refUrl = `${api}/repos/${owner}/${repo}/git/ref/heads/${refPath}`;
    const refRes = await githubFetchJson<GithubRefResponse>(refUrl, input.githubToken, input.userAgent);
    if (refRes.ok) {
      const headSha = String(refRes.data.object?.sha ?? "").trim();
      if (headSha) {
        return { ok: true, headSha, apiStatus: refRes.status };
      }
    } else if (isFatalGithubBranchLookupHttpStatus(refRes.status)) {
      return {
        ok: false,
        apiStatus: refRes.status,
        errorMessage: refRes.body || `ref lookup HTTP ${refRes.status}`,
      };
    }
  }

  const branchesUrl = `${api}/repos/${owner}/${repo}/branches/${encodeURIComponent(branchName)}`;
  const branchRes = await githubFetchJson<GithubBranchResponse>(
    branchesUrl,
    input.githubToken,
    input.userAgent,
  );
  if (branchRes.ok) {
    const headSha = String(branchRes.data.commit?.sha ?? "").trim();
    if (headSha) {
      return { ok: true, headSha, apiStatus: branchRes.status };
    }
    return { ok: false, apiStatus: branchRes.status, errorMessage: "branch head sha missing" };
  }
  return {
    ok: false,
    apiStatus: branchRes.status,
    errorMessage: branchRes.body || `branch lookup HTTP ${branchRes.status}`,
  };
}

export async function fetchGithubBranchByExactName(input: {
  readonly gitRepoUrl: string;
  readonly branchName: string;
  readonly token: string;
  readonly userAgent?: string;
  readonly source?: GithubBranchLookupSource;
  readonly onRetry?: (event: GithubBranchLookupRetryEventV1) => void;
}): Promise<GithubBranchLookupResultV1> {
  const branchName = String(input.branchName ?? "").trim();
  const source = input.source ?? "exact_get";
  const userAgent = input.userAgent ?? "JYOrchestration/github-branch-lookup";
  const token = input.token.trim();
  if (!branchName) {
    return {
      status: "missing",
      branchName: "",
      source,
      apiStatus: 404,
      errorMessage: "branch name empty",
      lookupAttempts: 0,
    };
  }
  if (!token) {
    return {
      status: "failed",
      branchName,
      source,
      apiStatus: 401,
      errorMessage: "github token missing",
      lookupAttempts: 0,
    };
  }

  let lastStatus = 404;
  let lastError = "branch not found";
  const maxAttempts = CANONICAL_BRANCH_LOOKUP_RETRY_DELAYS_MS.length;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const delay = CANONICAL_BRANCH_LOOKUP_RETRY_DELAYS_MS[attempt] ?? 0;
    if (delay > 0) {
      input.onRetry?.({
        branchName,
        attempt: attempt + 1,
        apiStatus: lastStatus,
        reason: "canonical_branch_lookup_retry",
      });
      await sleepMs(delay);
    }

    const once = await fetchGithubBranchHeadShaOnce({
      gitRepoUrl: input.gitRepoUrl,
      branchName,
      githubToken: token,
      userAgent,
    });
    if (once.ok) {
      return {
        status: "found",
        branchName,
        headSha: once.headSha,
        source,
        apiStatus: once.apiStatus,
        lookupAttempts: attempt + 1,
      };
    }
    lastStatus = once.apiStatus;
    lastError = once.errorMessage;
    if (isFatalGithubBranchLookupHttpStatus(once.apiStatus)) {
      return {
        status: "failed",
        branchName,
        source,
        apiStatus: once.apiStatus,
        errorMessage: once.errorMessage,
        lookupAttempts: attempt + 1,
      };
    }
  }

  return {
    status: "missing",
    branchName,
    source,
    apiStatus: lastStatus,
    errorMessage: lastError,
    lookupAttempts: maxAttempts,
  };
}

export async function searchGithubBranchesByCandidates(input: {
  readonly gitRepoUrl: string;
  readonly candidateBranches: readonly string[];
  readonly token: string;
  readonly userAgent?: string;
  readonly onRetry?: (event: GithubBranchLookupRetryEventV1) => void;
}): Promise<GithubBranchLookupResultV1> {
  const seen = new Set<string>();
  for (const raw of input.candidateBranches) {
    const branchName = String(raw ?? "").trim();
    if (!branchName || seen.has(branchName)) continue;
    seen.add(branchName);
    const result = await fetchGithubBranchByExactName({
      gitRepoUrl: input.gitRepoUrl,
      branchName,
      token: input.token,
      userAgent: input.userAgent,
      source: "candidate_search",
      onRetry: input.onRetry,
    });
    if (result.status === "found") return result;
    if (result.status === "failed") return result;
  }
  const last = [...seen][seen.size - 1] ?? "";
  return {
    status: "missing",
    branchName: last,
    source: "candidate_search",
    apiStatus: 404,
    errorMessage: "no candidate branch found",
    lookupAttempts: 1,
  };
}

export function buildCanonicalGithubVerifyBranchOrder(input: {
  readonly runWorkBranch?: string | null;
  readonly branchPlanWorkBranch?: string | null;
  readonly executionWorkBranch?: string | null;
  readonly candidateBranches?: readonly string[];
}): readonly string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const push = (branch: string | null | undefined) => {
    const b = String(branch ?? "").trim();
    if (!b || seen.has(b)) return;
    seen.add(b);
    ordered.push(b);
  };
  push(input.runWorkBranch);
  push(input.branchPlanWorkBranch);
  push(input.executionWorkBranch);
  push(input.candidateBranches?.[0]);
  for (const c of input.candidateBranches ?? []) {
    if (/^wip\/cursor\//i.test(String(c ?? ""))) push(c);
  }
  return ordered;
}
