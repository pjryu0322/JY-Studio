import { resolveGithubRepositoryFromEnv } from "@/lib/integration/githubIntegrationHints";

/** UI·lastEvalSummary용: 토큰 부재 시 원인을 숨기지 않는다. */
export const GITHUB_REST_MISSING_TOKEN_USER_MESSAGE =
  "GitHub 토큰이 없어 저장소 확인과 PR 생성을 진행할 수 없습니다. 실행 환경에서 GitHub 인증을 저장·검증한 뒤 다시 시도하세요. (개발 환경에서는 GITHUB_TOKEN 또는 GH_TOKEN을 설정할 수 있습니다.)";

export function getGithubRestToken(preferredToken?: string | null): string | null {
  const p = String(preferredToken ?? "").trim();
  if (p) return p;
  const t = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim() || "";
  return t || null;
}

export function githubRestApiBase(): string {
  const b = process.env.GITHUB_API_URL?.trim();
  if (b) return b.replace(/\/$/, "");
  return "https://api.github.com";
}

/** github.com HTTPS 저장소 URL → owner/repo (PR 생성 등) */
export function parseGithubComOwnerRepoFromUrl(repoUrl: string): { owner: string; repo: string } | null {
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

/** GITHUB_REPOSITORY 등 env 우선, 없으면 github.com URL */
export function resolveGithubOwnerRepoStrict(repoUrl: string): { owner: string; repo: string } | null {
  return resolveGithubRepositoryFromEnv() ?? parseGithubComOwnerRepoFromUrl(repoUrl);
}

/** env 우선, 없으면 URL path에서 owner/repo (열린 PR head 조회 등) */
export function resolveGithubOwnerRepoLoose(repoUrl: string): { owner: string; repo: string } | null {
  const envRepo = resolveGithubRepositoryFromEnv();
  if (envRepo) return envRepo;
  try {
    const u = new URL(String(repoUrl ?? "").trim());
    const seg = u.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
    if (seg.length >= 2) {
      const owner = seg[0];
      const repo = seg[1].replace(/\.git$/i, "");
      if (owner && repo) return { owner, repo };
    }
  } catch {
    // ignore
  }
  return null;
}
