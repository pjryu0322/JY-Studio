import { resolveGithubRepositoryFromEnv } from "@/lib/integration/githubIntegrationHints";

function getGithubToken(): string | null {
  const t = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim() || "";
  return t || null;
}

function githubApiBase(): string {
  const b = process.env.GITHUB_API_URL?.trim();
  if (b) return b.replace(/\/$/, "");
  return "https://api.github.com";
}

function parseGithubRepoFullNameFromUrl(repoUrl: string): { owner: string; repo: string } | null {
  const url = String(repoUrl ?? "").trim();
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host !== "github.com") return null;
    const seg = u.pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (seg.length < 2) return null;
    const owner = seg[0];
    let repo = seg[1];
    if (repo.endsWith(".git")) repo = repo.slice(0, -4);
    if (!owner || !repo) return null;
    return { owner, repo };
  } catch {
    return null;
  }
}

type PullCreateRes = { html_url?: string; number?: number; state?: string };

export async function createGithubPullRequestFromBranch(params: {
  repoUrl: string;
  baseBranch: string;
  headBranch: string;
  title: string;
  body?: string;
}): Promise<
  | { ok: true; data: { pullRequestUrl: string; pullRequestNumber: number; pullRequestState: string } }
  | { ok: false; code: string; message: string; httpStatus?: number; detail?: Record<string, unknown> }
> {
  const token = getGithubToken();
  if (!token) return { ok: false, code: "NO_GITHUB_TOKEN", message: "GITHUB_TOKEN(GH_TOKEN)이 필요합니다.", httpStatus: 503 };
  const envRepo = resolveGithubRepositoryFromEnv();
  const parsed = envRepo ?? parseGithubRepoFullNameFromUrl(params.repoUrl);
  if (!parsed) return { ok: false, code: "REPO_NOT_GITHUB", message: "GitHub 저장소 URL이 아닙니다.", httpStatus: 400 };
  const api = githubApiBase();
  const { owner, repo } = parsed;
  const url = `${api}/repos/${owner}/${repo}/pulls`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "JYOrchestration/pr-create",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        title: params.title,
        head: params.headBranch,
        base: params.baseBranch,
        body: params.body ?? "",
        maintainer_can_modify: true,
      }),
    });
    const txt = await res.text();
    if (!res.ok) {
      return { ok: false, code: "PR_CREATE_FAILED", message: `PR 생성 실패 (HTTP ${res.status})`, httpStatus: res.status, detail: { body: txt.slice(0, 2000) } };
    }
    const json = JSON.parse(txt) as PullCreateRes;
    const prUrl = String(json.html_url ?? "").trim();
    const prNum = Number(json.number);
    if (!prUrl || !Number.isFinite(prNum) || prNum <= 0) {
      return { ok: false, code: "PR_CREATE_INVALID_RESPONSE", message: "PR 생성 응답이 올바르지 않습니다.", httpStatus: 502, detail: { body: txt.slice(0, 2000) } };
    }
    return { ok: true, data: { pullRequestUrl: prUrl, pullRequestNumber: prNum, pullRequestState: String(json.state ?? "OPEN") } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "PR_CREATE_EXCEPTION", message: msg, httpStatus: 502 };
  }
}

