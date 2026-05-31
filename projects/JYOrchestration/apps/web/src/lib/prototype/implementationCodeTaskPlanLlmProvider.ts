import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { prisma } from "@/lib/prisma";

export type LlmCodeTaskRefinementProviderContext = Readonly<{
  readonly apiKey?: string | null;
  readonly model?: string | null;
}>;

function allowEnvOpenAiFallback(): boolean {
  return String(process.env.NODE_ENV ?? "").trim() !== "production";
}

export async function resolveLlmCodeTaskRefinementProviderContext(input: {
  readonly projectId: string;
  readonly actorUserId?: string | null;
}): Promise<LlmCodeTaskRefinementProviderContext> {
  const projectId = input.projectId.trim();
  const model = resolveOpenAiModelFromEnv();
  if (!projectId) {
    return { apiKey: null, model };
  }

  let setup: {
    openaiPlannerApiKey: string | null;
    project: { ownerUserId: string | null } | null;
  } | null = null;
  try {
    setup = await prisma.executionSetup.findUnique({
      where: { projectId },
      select: {
        openaiPlannerApiKey: true,
        project: { select: { ownerUserId: true } },
      },
    });
  } catch {
    setup = null;
  }

  const projectKey = String(setup?.openaiPlannerApiKey ?? "").trim();
  if (projectKey) {
    return { apiKey: projectKey, model };
  }

  const ownerId = String(setup?.project?.ownerUserId ?? "").trim();
  const actorId = String(input.actorUserId ?? "").trim();

  const tryLegacyUserKey = async (userId: string): Promise<string | null> => {
    if (!userId) return null;
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { defaultOpenaiApiKey: true },
      });
      const key = String(user?.defaultOpenaiApiKey ?? "").trim();
      return key || null;
    } catch {
      return null;
    }
  };

  const ownerKey = await tryLegacyUserKey(ownerId);
  if (ownerKey) return { apiKey: ownerKey, model };

  if (actorId && actorId !== ownerId) {
    const actorKey = await tryLegacyUserKey(actorId);
    if (actorKey) return { apiKey: actorKey, model };
  }

  const envKey = String(process.env.OPENAI_API_KEY ?? "").trim();
  if (envKey && allowEnvOpenAiFallback()) {
    return { apiKey: envKey, model };
  }

  return { apiKey: null, model };
}
