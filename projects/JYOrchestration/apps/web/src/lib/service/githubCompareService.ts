/** GitHub REST compare — 호출 시점·스코프는 실행 루프/어댑터가 결정(함수 자체는 ENV_TEST 전용 아님). */
import { resolveGithubRepositoryFromEnv } from "@/lib/integration/githubIntegrationHints";
import {
  getGithubRestToken,
  GITHUB_REST_MISSING_TOKEN_USER_MESSAGE,
} from "@/lib/integration/githubRestCommon";

async function fetchBranchTipCommitSha(input: {
  api: string;
  token: string;
  owner: string;
  repo: string;
  headRef: string;
}): Promise<string | null> {
  const ref = String(input.headRef ?? "").trim();
  if (!ref) return null;
  const url = `${input.api}/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/commits/${encodeURIComponent(ref)}`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${input.token}`,
        "User-Agent": "JYOrchestration/github-compare",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    const txt = await res.text();
    if (!res.ok) return null;
    const json = JSON.parse(txt) as { sha?: string };
    const sha = String(json.sha ?? "").trim();
    return sha || null;
  } catch {
    return null;
  }
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

/**
 * 원격에 브랜치 ref가 있는지(compare 전 선검사). 호출 스코프는 ENV_TEST 어댑터가 제한.
 * GitHub GET /repos/.../branches/{branch}
 */
export async function fetchGithubBranchHeadExists(params: {
  repoUrl: string;
  branch: string;
  githubAccessToken?: string | null;
  allowUnauthenticated?: boolean;
}): Promise<
  | { ok: true }
  | { ok: false; code: string; message: string; httpStatus?: number }
> {
  const branch = String(params.branch ?? "").trim();
  if (!branch) {
    return { ok: false, code: "BRANCH_EMPTY", message: "branch 이름이 없습니다." };
  }
  const parsed = parseGithubRepoFullNameFromUrl(params.repoUrl) ?? resolveGithubRepositoryFromEnv();
  if (!parsed) {
    return { ok: false, code: "REPO_NOT_GITHUB", message: "GitHub 저장소 URL이 아닙니다.", httpStatus: 400 };
  }
  const token = getGithubRestToken(params.githubAccessToken ?? null);
  if (!token && params.allowUnauthenticated !== true) {
    return {
      ok: false,
      code: "NO_GITHUB_TOKEN",
      message: GITHUB_REST_MISSING_TOKEN_USER_MESSAGE,
      httpStatus: 503,
    };
  }
  const { owner, repo } = parsed;
  const api = githubApiBase();
  const url = `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches/${encodeURIComponent(branch)}`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "User-Agent": "JYOrchestration/github-branch-exists",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (res.status === 404) {
      return {
        ok: false,
        code: "GITHUB_BRANCH_NOT_FOUND",
        message: "브랜치 없음 또는 아직 원격에 반영되지 않음",
        httpStatus: 404,
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        code: "GITHUB_BRANCH_ERROR",
        message: `브랜치 조회 실패 HTTP ${res.status}`,
        httpStatus: res.status,
      };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "GITHUB_BRANCH_EXCEPTION", message: msg, httpStatus: 502 };
  }
}

type CompareJson = {
  status?: string;
  ahead_by?: number;
  behind_by?: number;
  total_commits?: number;
  merge_base_commit?: { sha?: string };
  commits?: Array<{ sha?: string; commit?: { message?: string } }>;
  files?: Array<{ filename?: string; status?: string; additions?: number; deletions?: number; changes?: number; patch?: string }>;
};

export async function fetchGithubCompareSnapshot(params: {
  repoUrl: string;
  base: string;
  head: string;
  maxPatchCharsPerFile?: number;
  maxFiles?: number;
  /** execution setup에 저장된 GitHub 토큰(1순위). 없으면 env fallback. */
  githubAccessToken?: string | null;
  /**
   * 토큰이 없을 때(공개 저장소) unauthenticated compare를 시도할지.
   * ENV_TEST 전용 폴백에만 사용한다.
   */
  allowUnauthenticated?: boolean;
}): Promise<
  | {
      ok: true;
      data: {
        owner: string;
        repo: string;
        base: string;
        head: string;
        headSha: string | null;
        changedFiles: string[];
        diffSummary: string;
        aheadBy: number;
        behindBy: number;
        compareStatus: string;
      };
    }
  | { ok: false; code: string; message: string; httpStatus?: number; detail?: Record<string, unknown> }
> {
  const token = getGithubRestToken(params.githubAccessToken ?? null);
  // 웹 앱(플랫폼)에서는 execution setup의 repoUrl이 진실이다.
  // CI/런타임 env의 GITHUB_REPOSITORY 힌트가 다른 저장소를 가리키면 compare 결과가 틀어질 수 있어
  // repoUrl parse 실패 시에만 env 힌트를 사용한다.
  const parsed = parseGithubRepoFullNameFromUrl(params.repoUrl) ?? resolveGithubRepositoryFromEnv();
  if (!parsed) {
    return { ok: false, code: "REPO_NOT_GITHUB", message: "GitHub 저장소 URL이 아닙니다.", httpStatus: 400 };
  }
  const { owner, repo } = parsed;
  const api = githubApiBase();
  const url = `${api}/repos/${owner}/${repo}/compare/${encodeURIComponent(params.base)}...${encodeURIComponent(params.head)}`;
  try {
    if (!token && params.allowUnauthenticated !== true) {
      return {
        ok: false,
        code: "NO_GITHUB_TOKEN",
        message: GITHUB_REST_MISSING_TOKEN_USER_MESSAGE,
        httpStatus: 503,
      };
    }
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "User-Agent": "JYOrchestration/github-compare",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    const txt = await res.text();
    if (!res.ok) {
      // 공개 저장소 폴백을 켰지만 실패한 경우는 “토큰 부재”를 명시적으로 드러내준다.
      if (!token && params.allowUnauthenticated === true) {
        return {
          ok: false,
          code: "NO_GITHUB_TOKEN",
          message: `${GITHUB_REST_MISSING_TOKEN_USER_MESSAGE} (공개 저장소 무토큰 compare도 HTTP ${res.status}으로 실패했습니다.)`,
          httpStatus: res.status,
          detail: { body: txt.slice(0, 2000) },
        };
      }
      return { ok: false, code: "GITHUB_COMPARE_ERROR", message: `compare 실패 (HTTP ${res.status})`, httpStatus: res.status, detail: { body: txt.slice(0, 2000) } };
    }
    const json = JSON.parse(txt) as CompareJson;
    const aheadBy = Number(json.ahead_by ?? 0);
    const behindBy = Number(json.behind_by ?? 0);
    const compareStatus = String(json.status ?? "").trim() || "unknown";
    const files = Array.isArray(json.files) ? json.files : [];
    const maxFiles = Math.min(200, Math.max(1, params.maxFiles ?? 80));
    const sliced = files.slice(0, maxFiles);
    const changedFiles = sliced.map((f) => String(f.filename ?? "").trim()).filter(Boolean);
    let headSha = json.commits?.length
      ? String(json.commits[json.commits.length - 1]?.sha ?? "").trim() || null
      : null;
    if (!headSha && aheadBy > 0) {
      headSha = await fetchBranchTipCommitSha({
        api,
        token: token ?? "",
        owner,
        repo,
        headRef: params.head,
      });
    }

    const maxPatch = Math.min(10_000, Math.max(200, params.maxPatchCharsPerFile ?? 2500));
    const fileLines = sliced.map((f) => {
      const fn = String(f.filename ?? "").trim() || "(unknown)";
      const st = String(f.status ?? "").trim() || "modified";
      const delta = `+${f.additions ?? 0}/-${f.deletions ?? 0} (Δ${f.changes ?? 0})`;
      const patch = String(f.patch ?? "").trim();
      const patchPreview = patch ? patch.slice(0, maxPatch) + (patch.length > maxPatch ? "\n…(truncated)" : "") : "(patch 없음)";
      return `--- ${fn} [${st}] ${delta}\n${patchPreview}`;
    });

    const meta = [
      `status=${compareStatus}`,
      `ahead_by=${aheadBy}`,
      `behind_by=${behindBy}`,
      `total_commits=${json.total_commits ?? null}`,
      `merge_base=${json.merge_base_commit?.sha ?? null}`,
    ].join(" ");

    return {
      ok: true,
      data: {
        owner,
        repo,
        base: params.base,
        head: params.head,
        headSha,
        changedFiles,
        diffSummary: `[GitHub compare ${owner}/${repo}] ${meta}\n\n${fileLines.join("\n\n")}`,
        aheadBy,
        behindBy,
        compareStatus,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "GITHUB_COMPARE_EXCEPTION", message: msg, httpStatus: 502 };
  }
}

