import { resolveGithubRepositoryFromEnv } from "@/lib/integration/githubIntegrationHints";
import {
  githubProcessEnvTokenInfo,
  logGithubTokenResolution,
  type GithubTokenSource,
} from "@/lib/integration/githubTokenTrace";

/** UI·lastEvalSummary용: 토큰 부재 시 원인을 숨기지 않는다. */
export const GITHUB_REST_MISSING_TOKEN_USER_MESSAGE =
  "GitHub 토큰이 없어 저장소 확인과 PR 생성을 진행할 수 없습니다. 실행 환경에서 GitHub 인증을 저장·검증한 뒤 다시 시도하세요. (개발 환경에서는 GITHUB_TOKEN 또는 GH_TOKEN을 설정할 수 있습니다.)";

export type GithubRestTokenResolution = {
  token: string | null;
  source: GithubTokenSource;
};

/** DB(Execution setup) 우선. ENV 폴백은 JY_ORCHESTRATION_GITHUB_DISABLE_ENV_TOKEN=1 이면 비활성화. */
export function resolveGithubRestToken(preferredToken?: string | null): GithubRestTokenResolution {
  const dbToken = String(preferredToken ?? "").trim();
  const envInfo = githubProcessEnvTokenInfo();
  const disableEnv =
    process.env.JY_ORCHESTRATION_GITHUB_DISABLE_ENV_TOKEN === "1" ||
    process.env.JY_ORCHESTRATION_GITHUB_DISABLE_ENV_TOKEN === "true";

  if (dbToken) {
    return { token: dbToken, source: "db" };
  }
  if (disableEnv) {
    if (envInfo.combined) {
      console.warn(
        `[GitHub token] WARN: JY_ORCHESTRATION_GITHUB_DISABLE_ENV_TOKEN 활성 — DB 토큰이 비어 있어 GitHub 호출 불가. ` +
          `ENV 토큰은 사용하지 않습니다.`
      );
    }
    return { token: null, source: "none" };
  }
  const envTok = envInfo.combined?.trim() ?? "";
  if (envTok) {
    return { token: envTok, source: "env" };
  }
  return { token: null, source: "none" };
}

export function getGithubRestToken(preferredToken?: string | null): string | null {
  return resolveGithubRestToken(preferredToken).token;
}

/** 토큰 확정 + 감사 로그(논리 작업 단위로 1회 호출 권장). */
export function resolveGithubRestTokenAndLog(
  operation: string,
  preferredToken?: string | null,
  opts?: { throttleKey?: string; validationEpoch?: number }
): GithubRestTokenResolution {
  const r = resolveGithubRestToken(preferredToken);
  logGithubTokenResolution({
    operation,
    token: r.token,
    source: r.source,
    validationEpoch: opts?.validationEpoch,
    throttleKey: opts?.throttleKey,
  });
  return r;
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
