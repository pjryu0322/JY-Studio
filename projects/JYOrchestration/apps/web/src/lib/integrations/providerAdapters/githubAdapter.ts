import { resolveProvider } from "@/lib/integrations/resolveProvider";

export async function getGithubPatForProjectScm(
  projectId: string,
  options?: { workspaceAiMemberId?: string | null; actorUserId?: string | null }
): Promise<{ token: string | null; source: string }> {
  const r = await resolveProvider(projectId, "SCM", {
    workspaceAiMemberId: options?.workspaceAiMemberId ?? null,
    actorUserId: options?.actorUserId ?? null,
  });
  if (r.provider !== "GITHUB") {
    return { token: null, source: r.source };
  }
  return { token: r.secret, source: r.source };
}

export async function getGithubPatForProjectDeploy(
  projectId: string,
  options?: { workspaceAiMemberId?: string | null; actorUserId?: string | null }
): Promise<{ token: string | null; source: string }> {
  const r = await resolveProvider(projectId, "DEPLOY", {
    workspaceAiMemberId: options?.workspaceAiMemberId ?? null,
    actorUserId: options?.actorUserId ?? null,
  });
  if (r.provider !== "GITHUB") {
    return { token: null, source: r.source };
  }
  return { token: r.secret, source: r.source };
}
