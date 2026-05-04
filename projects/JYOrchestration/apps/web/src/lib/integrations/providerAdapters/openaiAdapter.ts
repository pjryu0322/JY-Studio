import { resolveProvider } from "@/lib/integrations/resolveProvider";

/** OpenAI Chat Completions 등에 쓸 API 키 — `resolveProvider(LLM)`에서 provider가 OPENAI일 때만 반환합니다. */
export async function getOpenAiApiKeyForProject(
  projectId: string,
  options?: { workspaceAiMemberId?: string | null; actorUserId?: string | null }
): Promise<{ apiKey: string | null; source: string }> {
  const r = await resolveProvider(projectId, "LLM", {
    workspaceAiMemberId: options?.workspaceAiMemberId ?? null,
    actorUserId: options?.actorUserId ?? null,
  });
  if (r.provider !== "OPENAI") {
    return { apiKey: null, source: r.source };
  }
  return { apiKey: r.secret, source: r.source };
}
