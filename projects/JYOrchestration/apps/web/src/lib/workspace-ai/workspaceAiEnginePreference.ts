import { Prisma, type IntegrationCapability, type IntegrationProvider } from "@prisma/client";
import type { WorkspaceAiIntegrationCapability } from "@/lib/ai-member/platformAiMembers";
import { prisma } from "@/lib/prisma";

/** DB·API에 저장되는 엔진 선호(USER_DEFAULT = 사용자 기본 연동) */
export type WorkspaceAiEnginePreferenceKey =
  | "USER_DEFAULT"
  | "OPENAI"
  | "ANTHROPIC"
  | "GEMINI"
  | "CURSOR";

export function parseEnginePreferenceKey(raw: string | null | undefined): WorkspaceAiEnginePreferenceKey | null {
  const u = String(raw ?? "").trim().toUpperCase();
  if (u === "USER_DEFAULT" || u === "") return "USER_DEFAULT";
  if (u === "OPENAI" || u === "ANTHROPIC" || u === "GEMINI" || u === "CURSOR") return u;
  return null;
}

export function engineChoicesForCapability(cap: WorkspaceAiIntegrationCapability): readonly WorkspaceAiEnginePreferenceKey[] {
  if (cap === "CODE_AGENT") {
    return ["USER_DEFAULT", "CURSOR"];
  }
  return ["USER_DEFAULT", "OPENAI", "ANTHROPIC", "GEMINI"];
}

export function enginePreferenceLabel(key: WorkspaceAiEnginePreferenceKey): string {
  switch (key) {
    case "USER_DEFAULT":
      return "기본값 사용 (User Default)";
    case "OPENAI":
      return "OpenAI";
    case "ANTHROPIC":
      return "Claude";
    case "GEMINI":
      return "Gemini";
    case "CURSOR":
      return "Cursor";
    default:
      return key;
  }
}

export function integrationProviderForEnginePreference(
  key: Exclude<WorkspaceAiEnginePreferenceKey, "USER_DEFAULT">
): IntegrationProvider {
  switch (key) {
    case "OPENAI":
      return "OPENAI";
    case "ANTHROPIC":
      return "ANTHROPIC";
    case "GEMINI":
      return "GEMINI";
    case "CURSOR":
      return "CURSOR";
    default:
      return "OPENAI";
  }
}

/** UI 엔진 값 → Prisma provider (USER_DEFAULT 제외) */
export function enginePreferenceToProvider(
  pref: string | null | undefined
): IntegrationProvider | null {
  const k = parseEnginePreferenceKey(pref);
  if (!k || k === "USER_DEFAULT") return null;
  return integrationProviderForEnginePreference(k);
}

/** 핀 연동의 provider를 엔진 UI 값으로 역매핑(저장값이 없을 때 표시용) */
export function inferEnginePreferenceFromProvider(provider: IntegrationProvider | string): WorkspaceAiEnginePreferenceKey {
  const p = String(provider).toUpperCase();
  if (p === "CURSOR") return "CURSOR";
  if (p === "ANTHROPIC") return "ANTHROPIC";
  if (p === "GEMINI" || p === "GOOGLE_AI") return "GEMINI";
  if (p === "OPENAI" || p === "AZURE_OPENAI") return "OPENAI";
  return "USER_DEFAULT";
}

export async function resolveEnginePreferenceToUserIntegrationId(input: {
  readonly ownerUserId: string;
  readonly capability: IntegrationCapability;
  readonly preference: string | null | undefined;
}): Promise<string | null> {
  const provider = enginePreferenceToProvider(input.preference);
  if (!provider) return null;
  try {
    const hit = await prisma.userIntegration.findFirst({
      where: {
        userId: input.ownerUserId,
        capability: input.capability,
        provider,
        status: "ACTIVE",
      },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      select: { id: true },
    });
    return hit?.id ?? null;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022") {
      const hit = await prisma.userIntegration.findFirst({
        where: {
          userId: input.ownerUserId,
          capability: input.capability,
          provider,
          status: "ACTIVE",
        },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });
      return hit?.id ?? null;
    }
    return null;
  }
}
