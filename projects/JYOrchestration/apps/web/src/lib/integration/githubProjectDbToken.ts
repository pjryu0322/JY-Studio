import { sanitizeGithubPatForStorage, logGithubPatDbLoad } from "@/lib/integration/githubPatIntegrity";
import { prisma } from "@/lib/prisma";
import { withExecutionSetupSchemaHealRetry } from "@/lib/prisma/executionSetupSplitColumnsHeal";
import { githubTokenFingerprint } from "@/lib/integration/githubTokenTrace";

/** PR/merge/compare 등에서 DB 토큰 부재 시 공통 코드 */
export const GITHUB_TOKEN_MISSING_IN_PROJECT_SETTINGS = "GITHUB_TOKEN_MISSING_IN_PROJECT_SETTINGS";

export type ProjectGithubAuthResolution = {
  token: string | null;
  /** 플랫폼 GitHub API는 Execution setup(DB)만 source로 사용 */
  source: "DB";
  fingerprint: string | null;
  projectId: string;
};

/**
 * 프로젝트별 GitHub PAT — `execution_setups.githubAccessToken` 만 (서버 ENV PAT 없음).
 */
export async function resolveProjectGithubToken(projectId: string): Promise<ProjectGithubAuthResolution> {
  const pid = String(projectId ?? "").trim();
  if (!pid) {
    return { token: null, source: "DB", fingerprint: null, projectId: "" };
  }
  const row = await withExecutionSetupSchemaHealRetry(() =>
    prisma.executionSetup.findUnique({
      where: { projectId: pid },
      select: { githubAccessToken: true },
    })
  );
  const raw = String(row?.githubAccessToken ?? "");
  const t = sanitizeGithubPatForStorage(raw);
  logGithubPatDbLoad({ projectId: pid, token: t || null, operation: "resolveProjectGithubToken" });
  return {
    token: t || null,
    source: "DB",
    fingerprint: t ? githubTokenFingerprint(t) : null,
    projectId: pid,
  };
}
