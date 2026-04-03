/**
 * GitHub PAT 저장·DB 로드 시 정규화 및 저장 직후 무결성 프로브.
 */

import { parseGitHubRepoFullName } from "@/lib/executionSetup/hardening";
import {
  githubAcceptedPermissionsLogValue,
  readGithubAcceptedPermissionsHeader,
} from "@/lib/integration/githubAcceptedPermissionsHeader";
import { githubTokenFingerprint, githubTokenPrefixForLog } from "@/lib/integration/githubTokenTrace";

function githubApiBaseForProbe(): string {
  const b = process.env.GITHUB_API_URL?.trim();
  if (b) return b.replace(/\/$/, "");
  return "https://api.github.com";
}

/** 저장·DB에서 꺼낼 때 공통: 앞뒤 공백·개행·내부 공백 제거(붙여넣기 오염 방지). */
export function sanitizeGithubPatForStorage(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/\r?\n/g, "")
    .replace(/\s/g, "");
}

/** DB에서 읽은 PAT 스냅샷(진단). 토큰 원문은 로그에 넣지 않음. */
export function logGithubPatDbLoad(input: {
  projectId: string;
  token: string | null;
  operation: string;
}): void {
  const pid = String(input.projectId ?? "").trim();
  const op = String(input.operation ?? "").trim() || "unknown";
  if (!pid) return;
  if (!input.token || !String(input.token).trim()) {
    console.info(
      `[GitHub token] op=${op} TOKEN_SOURCE=DB projectId=${pid} DB_TOKEN=missing TOKEN_LENGTH=0`
    );
    return;
  }
  const t = input.token;
  const prefix = githubTokenPrefixForLog(t);
  const len = t.length;
  const hash = githubTokenFingerprint(t);
  console.info(
    `[GitHub token] op=${op} TOKEN_SOURCE=DB projectId=${pid} ` +
      `TOKEN_PREFIX=${prefix} TOKEN_LENGTH=${len} TOKEN_HASH=${hash}`
  );
}

export type GithubPatPostSaveRepoProbeResult = {
  attempted: boolean;
  skippedReason?: string;
  httpStatus: number | null;
  xAcceptedGitHubPermissions: string | null;
  ok: boolean;
  bodySnippet?: string;
};

/**
 * 저장 직후: 방금 쓴 토큰으로 GET /repos/{owner}/{repo} 호출해 permissions 헤더 확인.
 */
export async function probeGithubPatAgainstExecutionRepo(input: {
  gitRepoUrl: string;
  token: string;
  projectId: string;
}): Promise<GithubPatPostSaveRepoProbeResult> {
  const urlTrim = String(input.gitRepoUrl ?? "").trim();
  const tok = String(input.token ?? "").trim();
  const pid = String(input.projectId ?? "").trim();
  if (!tok) {
    return { attempted: false, skippedReason: "empty_token", httpStatus: null, xAcceptedGitHubPermissions: null, ok: false };
  }
  if (!urlTrim) {
    return {
      attempted: false,
      skippedReason: "missing_git_repo_url",
      httpStatus: null,
      xAcceptedGitHubPermissions: null,
      ok: false,
    };
  }
  const full = parseGitHubRepoFullName(urlTrim);
  if (!full) {
    return {
      attempted: false,
      skippedReason: "repo_url_not_github_full_name",
      httpStatus: null,
      xAcceptedGitHubPermissions: null,
      ok: false,
    };
  }
  const [owner, repo] = full.split("/");
  if (!owner || !repo) {
    return {
      attempted: false,
      skippedReason: "parse_failed",
      httpStatus: null,
      xAcceptedGitHubPermissions: null,
      ok: false,
    };
  }
  const api = githubApiBaseForProbe();
  const path = `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  try {
    const res = await fetch(path, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${tok}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "JYOrchestration/github-pat-post-save-probe/1",
      },
    });
    const xAccepted = readGithubAcceptedPermissionsHeader(res);
    const bodySnippet = (await res.text()).slice(0, 400);
    console.info(
      `[GitHub token] op=github_pat_post_save_probe TOKEN_SOURCE=DB projectId=${pid} ` +
        `GET /repos/${owner}/${repo} HTTP ${res.status} ${githubAcceptedPermissionsLogValue(xAccepted)} ` +
        `TOKEN_HASH=${githubTokenFingerprint(tok)} TOKEN_LENGTH=${tok.length}`
    );
    return {
      attempted: true,
      httpStatus: res.status,
      xAcceptedGitHubPermissions: xAccepted,
      ok: res.ok,
      bodySnippet,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[GitHub token] op=github_pat_post_save_probe projectId=${pid} fetch_failed: ${msg.slice(0, 200)}`);
    return {
      attempted: true,
      skippedReason: "fetch_exception",
      httpStatus: null,
      xAcceptedGitHubPermissions: null,
      ok: false,
      bodySnippet: msg.slice(0, 200),
    };
  }
}
