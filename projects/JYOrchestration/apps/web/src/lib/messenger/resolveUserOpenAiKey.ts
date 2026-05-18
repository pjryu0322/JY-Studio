import { prisma } from "@/lib/prisma";
import { decryptIntegrationSecret } from "@/lib/integrations/credentialCrypto";

function allowEnvOpenAiFallback(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  if (process.env.JYO_PROTOTYPE_PLANNER_ALLOW_ENV_OPENAI === "1") return true;
  if (process.env.JYO_ALLOW_OPENAI_ENV_FALLBACK === "1") return true;
  return false;
}

/** 프로젝트 없이 사용자 계정 기준 OpenAI 키(메신저 사전 대화용). */
export async function resolveUserOpenAiApiKey(userId: string): Promise<{ key: string | null; source: string }> {
  const uid = userId.trim();
  if (!uid) return { key: null, source: "missing" };

  const row = await prisma.userIntegration.findFirst({
    where: { userId: uid, provider: "OPENAI", capability: "LLM", status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    select: { credential: { select: { ciphertext: true, iv: true } } },
  });
  if (row?.credential) {
    try {
      const k = decryptIntegrationSecret(row.credential.ciphertext, row.credential.iv).trim();
      if (k) return { key: k, source: "user_integration" };
    } catch {
      /* ignore */
    }
  }

  const u = await prisma.user.findUnique({ where: { id: uid }, select: { defaultOpenaiApiKey: true } });
  const legacy = String(u?.defaultOpenaiApiKey ?? "").trim();
  if (legacy) return { key: legacy, source: "legacy.users.defaultOpenaiApiKey" };

  const envKey = String(process.env.OPENAI_API_KEY ?? "").trim();
  if (envKey && allowEnvOpenAiFallback()) return { key: envKey, source: "env.OPENAI_API_KEY" };

  return { key: null, source: "missing" };
}
