import { prisma } from "@/lib/prisma";
import { withExecutionSetupSchemaHealRetry } from "@/lib/prisma/executionSetupSplitColumnsHeal";

/** GitHub REST용: Execution setup에 저장된 프로젝트별 토큰만 (ENV 사용 안 함). */
export async function fetchGithubAccessTokenForProject(projectId: string): Promise<string | null> {
  const pid = String(projectId ?? "").trim();
  if (!pid) return null;
  const row = await withExecutionSetupSchemaHealRetry(() =>
    prisma.executionSetup.findUnique({
      where: { projectId: pid },
      select: { githubAccessToken: true },
    })
  );
  const t = String(row?.githubAccessToken ?? "").trim();
  return t || null;
}
