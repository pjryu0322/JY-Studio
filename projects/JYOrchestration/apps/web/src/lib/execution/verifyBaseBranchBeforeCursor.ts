import { parseGitHubRepoFullName, probeGitBaseBranchReachable } from "@/lib/executionSetup/hardening";
import { formatGitBaseBranchConfigError, repoDisplayForGitError } from "@/lib/execution/gitBranchCursorError";
import { resolveGithubRestTokenAndLog } from "@/lib/integration/githubRestCommon";

const GITHUB_FETCH_MS = 15_000;

/**
 * Cursor API 호출 전 base branch 존재 여부를 확인합니다.
 * - github.com + DB 저장 GitHub 토큰: REST GET /repos/.../branches/{branch}
 * - 그 외: git smart HTTP info/refs (공개 저장소·도달 가능 시)
 * - 비공개 저장소이고 토큰이 없으면 info/refs가 401이면 검증 생략(Cursor에 위임).
 */
export async function verifyBaseBranchBeforeCursorExecution(params: {
  gitRepoUrl: string;
  baseBranch: string;
  /** Execution setup(DB)에 저장된 GitHub 토큰 */
  githubAccessToken?: string | null;
  projectId?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const gitRepoUrl = params.gitRepoUrl.trim();
  const baseBranch = params.baseBranch.trim();
  const repoDisplay = repoDisplayForGitError(gitRepoUrl);

  if (!baseBranch) {
    return {
      ok: false,
      message: formatGitBaseBranchConfigError({ repoDisplay, baseBranch: "(비어 있음)" }),
    };
  }

  const fullName = parseGitHubRepoFullName(gitRepoUrl);
  const { token } = resolveGithubRestTokenAndLog(
    "verify_base_branch_before_cursor",
    params.githubAccessToken ?? null,
    { projectId: params.projectId }
  );

  if (fullName && token) {
    const [owner, repo] = fullName.split("/");
    if (owner && repo) {
      const url = `https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(baseBranch)}`;
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), GITHUB_FETCH_MS);
      try {
        const res = await fetch(url, {
          method: "GET",
          redirect: "follow",
          signal: ac.signal,
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "User-Agent": "JYOrchestration-branch-verify/1",
          },
        });
        if (res.status === 404) {
          return {
            ok: false,
            message: formatGitBaseBranchConfigError({ repoDisplay, baseBranch }),
          };
        }
        if (res.ok) {
          return { ok: true };
        }
      } catch {
        // 네트워크 오류 시 아래 probe로 폴백
      } finally {
        clearTimeout(timer);
      }
    }
  }

  const probe = await probeGitBaseBranchReachable(gitRepoUrl, baseBranch);
  if (probe.ok) {
    return { ok: true };
  }

  const err = probe.error ?? "";
  if (err.includes("찾지 못했습니다") || err.includes("refs 에서")) {
    return {
      ok: false,
      message: formatGitBaseBranchConfigError({ repoDisplay, baseBranch }),
    };
  }

  return { ok: true };
}
