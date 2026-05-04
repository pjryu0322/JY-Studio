import { resolveProvider } from "@/lib/integrations/resolveProvider";

export async function getCursorApiTokenForProject(
  projectId: string,
  options?: { workspaceAiMemberId?: string | null; actorUserId?: string | null }
): Promise<{ token: string | null; source: string }> {
  const r = await resolveProvider(projectId, "CODE_AGENT", {
    workspaceAiMemberId: options?.workspaceAiMemberId ?? null,
    actorUserId: options?.actorUserId ?? null,
  });
  if (r.provider !== "CURSOR") {
    return { token: null, source: r.source };
  }
  return { token: r.secret, source: r.source };
}
