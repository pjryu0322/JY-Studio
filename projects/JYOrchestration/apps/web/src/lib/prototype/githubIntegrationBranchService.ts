import { githubRestApiBase, resolveGithubOwnerRepoStrict } from "@/lib/integration/githubRestCommon";
import { buildIntegrationBranchName } from "@/lib/prototype/implementationIntegrationPlan";

export function encodeGithubRefBranchPath(branch: string): string {
  const s = String(branch ?? "").trim();
  if (!s) return "";
  return s
    .split("/")
    .filter((p) => p.length > 0)
    .map((p) => encodeURIComponent(p))
    .join("/");
}

type RefResponse = Readonly<{ readonly object?: Readonly<{ readonly sha?: string }> }>;

async function githubFetchJson<T>(
  url: string,
  token: string,
  init?: RequestInit,
): Promise<
  | Readonly<{ readonly ok: true; readonly data: T; readonly status: number }>
  | Readonly<{ readonly ok: false; readonly status: number; readonly body: string }>
> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "JYOrchestration/github-integration-branch",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
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

export async function fetchBranchHeadCommitSha(input: {
  readonly repoUrl: string;
  readonly branch: string;
  readonly githubToken: string;
}): Promise<
  | Readonly<{ readonly ok: true; readonly sha: string }>
  | Readonly<{ readonly ok: false; readonly message: string; readonly httpStatus?: number }>
> {
  const parsed = resolveGithubOwnerRepoStrict(input.repoUrl);
  if (!parsed) return { ok: false, message: "GitHub 저장소 URL이 올바르지 않습니다." };
  const refPath = encodeGithubRefBranchPath(input.branch);
  if (!refPath) return { ok: false, message: "branch가 비어 있습니다." };
  const api = githubRestApiBase();
  const url = `${api}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/git/ref/heads/${refPath}`;
  const res = await githubFetchJson<RefResponse>(url, input.githubToken);
  if (!res.ok) {
    return {
      ok: false,
      message: `branch ref 조회 실패 HTTP ${res.status}`,
      httpStatus: res.status,
    };
  }
  const sha = String(res.data.object?.sha ?? "").trim();
  if (!sha) return { ok: false, message: "branch head SHA가 없습니다." };
  return { ok: true, sha };
}

export async function createGithubIntegrationBranch(input: {
  readonly repoUrl: string;
  readonly baseBranch: string;
  readonly projectId: string;
  readonly githubToken: string;
  readonly integrationBranch?: string;
  readonly now?: Date;
}): Promise<
  | Readonly<{ readonly ok: true; readonly integrationBranch: string; readonly baseCommitSha: string }>
  | Readonly<{ readonly ok: false; readonly message: string }>
> {
  const parsed = resolveGithubOwnerRepoStrict(input.repoUrl);
  if (!parsed) return { ok: false, message: "GitHub 저장소 URL이 올바르지 않습니다." };
  const token = input.githubToken.trim();
  if (!token) return { ok: false, message: "GitHub token이 필요합니다." };

  const baseHead = await fetchBranchHeadCommitSha({
    repoUrl: input.repoUrl,
    branch: input.baseBranch,
    githubToken: token,
  });
  if (!baseHead.ok) return { ok: false, message: baseHead.message };

  let branchName =
    input.integrationBranch?.trim() ||
    buildIntegrationBranchName({ projectId: input.projectId, now: input.now });

  const api = githubRestApiBase();
  const createRef = async (name: string) => {
    const url = `${api}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/git/refs`;
    return githubFetchJson<{ ref?: string }>(url, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ref: `refs/heads/${name}`,
        sha: baseHead.sha,
      }),
    });
  };

  let createRes = await createRef(branchName);
  if (!createRes.ok && createRes.status === 422) {
    branchName = buildIntegrationBranchName({ projectId: input.projectId, now: new Date() });
    createRes = await createRef(branchName);
  }
  if (!createRes.ok) {
    return {
      ok: false,
      message: `integration branch 생성 실패 HTTP ${createRes.status}: ${createRes.body}`,
    };
  }

  return { ok: true, integrationBranch: branchName, baseCommitSha: baseHead.sha };
}
