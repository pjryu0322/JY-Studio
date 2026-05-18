import type { IntegrationCapability, IntegrationProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptIntegrationSecret } from "@/lib/integrations/credentialCrypto";
import { resolveIntegration } from "@/lib/integrations/resolveIntegration";

export { maskedPreviewForSecret } from "@/lib/integrations/integrationSecretMasking";

export type ResolveProviderResult = {
  readonly provider: IntegrationProvider;
  readonly capability: IntegrationCapability;
  /** 평문 시크릿(호출부에서 즉시 사용·로그 금지) */
  readonly secret: string | null;
  /** 디버그·UI용 비식별 출처 라벨 */
  readonly source: string;
};

type PartialResolve = {
  readonly secret: string | null;
  readonly source: string;
  readonly provider: IntegrationProvider;
};

function allowEnvOpenAiFallback(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  if (process.env.JYO_PROTOTYPE_PLANNER_ALLOW_ENV_OPENAI === "1") return true;
  if (process.env.JYO_ALLOW_OPENAI_ENV_FALLBACK === "1") return true;
  return false;
}

async function decryptUserIntegrationRow(integrationId: string): Promise<string | null> {
  const row = await prisma.userIntegration.findUnique({
    where: { id: integrationId },
    select: { status: true, credential: { select: { ciphertext: true, iv: true } } },
  });
  if (!row || row.status !== "ACTIVE") return null;
  try {
    return decryptIntegrationSecret(row.credential.ciphertext, row.credential.iv).trim() || null;
  } catch {
    return null;
  }
}

async function decryptLatestActiveUserIntegration(
  userId: string,
  provider: IntegrationProvider,
  capability: IntegrationCapability
): Promise<string | null> {
  if (!userId) return null;
  const row = await prisma.userIntegration.findFirst({
    where: { userId, provider, capability, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (!row) return null;
  return decryptUserIntegrationRow(row.id);
}

function invalidOverridePlaceholderProvider(cap: IntegrationCapability): IntegrationProvider {
  if (cap === "LLM") return "OPENAI";
  if (cap === "CODE_AGENT") return "CURSOR";
  if (cap === "SCM") return "GITHUB";
  return "VERCEL";
}

type IntegrationTierResult =
  | { readonly tier: "resolved"; readonly value: PartialResolve }
  | { readonly tier: "invalid_override" }
  | { readonly tier: "continue"; readonly ownerUserId: string };

/**
 * DB 연동 계층(핀·프로젝트 override·사용자 기본)만 시도합니다.
 * `continue` 시 `ownerUserId`는 동일 조회에서 캐시해 레거시 단계의 중복 `project` 조회를 줄입니다.
 */
async function tryIntegrationDbTier(
  projectId: string,
  capability: IntegrationCapability,
  workspaceAiMemberId: string | null
): Promise<IntegrationTierResult> {
  const ownerRow = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerUserId: true },
  });
  const ownerUserId = String(ownerRow?.ownerUserId ?? "").trim();
  if (!ownerUserId) return { tier: "continue", ownerUserId: "" };

  const ri = await resolveIntegration({
    projectId,
    capability,
    ownerUserId,
    workspaceAiMemberId,
  });

  if (ri.ok) {
    return {
      tier: "resolved",
      value: {
        secret: ri.credential,
        source: `integration.${ri.source}`,
        provider: ri.provider,
      },
    };
  }
  if (ri.code === "INVALID_OVERRIDE") {
    return { tier: "invalid_override" };
  }
  return { tier: "continue", ownerUserId };
}

function invalidOverrideResult(capability: IntegrationCapability): PartialResolve {
  return {
    secret: null,
    source: "integration.INVALID_OVERRIDE",
    provider: invalidOverridePlaceholderProvider(capability),
  };
}

/**
 * 프로젝트·capability별로 사용할 외부 연동 시크릿을 해석합니다.
 * - 먼저 `resolveIntegration`(핀 → 프로젝트 override → 사용자 기본 isDefault)을 시도합니다.
 * - `integration.INVALID_OVERRIDE`일 때는 레거시로 자동 대체하지 않습니다.
 * - `MISSING`이면 execution_setup·레거시 사용자 키·환경 변수 등 기존 체인을 따릅니다.
 */
export async function resolveProvider(
  projectId: string,
  capability: IntegrationCapability,
  options?: { workspaceAiMemberId?: string | null; actorUserId?: string | null }
): Promise<ResolveProviderResult> {
  const pid = String(projectId ?? "").trim();
  const memberId = String(options?.workspaceAiMemberId ?? "").trim() || null;
  const actorId = String(options?.actorUserId ?? "").trim();

  if (capability === "LLM") {
    const r = await resolveLlmSecretForProject(pid, memberId, actorId);
    return { provider: r.provider, capability, secret: r.secret, source: r.source };
  }

  if (capability === "CODE_AGENT") {
    const r = await resolveCodeAgentSecretForProject(pid, memberId, actorId);
    return { provider: r.provider, capability, secret: r.secret, source: r.source };
  }

  if (capability === "SCM") {
    const r = await resolveScmSecretForProject(pid, memberId, actorId);
    return { provider: r.provider, capability, secret: r.secret, source: r.source };
  }

  if (capability === "DEPLOY") {
    const r = await resolveDeploySecretForProject(pid, memberId, actorId);
    return { provider: r.provider, capability, secret: r.secret, source: r.source };
  }

  return { provider: "VERCEL", capability, secret: null, source: "not_implemented" };
}

async function resolveLlmSecretForProject(
  projectId: string,
  workspaceAiMemberId: string | null,
  actorId: string
): Promise<PartialResolve> {
  const tier = await tryIntegrationDbTier(projectId, "LLM", workspaceAiMemberId);
  if (tier.tier === "resolved") return tier.value;
  if (tier.tier === "invalid_override") return invalidOverrideResult("LLM");

  let setup: { openaiPlannerApiKey: string | null; project: { ownerUserId: string } | null } | null = null;
  try {
    setup = await prisma.executionSetup.findUnique({
      where: { projectId },
      select: { openaiPlannerApiKey: true, project: { select: { ownerUserId: true } } },
    });
  } catch {
    setup = null;
  }
  const projectKey = String(setup?.openaiPlannerApiKey ?? "").trim();
  if (projectKey) return { secret: projectKey, source: "execution_setup.openai", provider: "OPENAI" };

  const ownerId = String(setup?.project?.ownerUserId ?? tier.ownerUserId ?? "").trim();

  const ownerUiKey = await decryptLatestActiveUserIntegration(ownerId, "OPENAI", "LLM");
  if (ownerUiKey) return { secret: ownerUiKey, source: "user_integrations.owner", provider: "OPENAI" };

  if (actorId && actorId !== ownerId) {
    const actorKey = await decryptLatestActiveUserIntegration(actorId, "OPENAI", "LLM");
    if (actorKey) return { secret: actorKey, source: "user_integrations.actor", provider: "OPENAI" };
  }

  const tryLegacyUserKey = async (uid: string): Promise<string | null> => {
    if (!uid) return null;
    try {
      const u = await prisma.user.findUnique({ where: { id: uid }, select: { defaultOpenaiApiKey: true } });
      const k = String(u?.defaultOpenaiApiKey ?? "").trim();
      return k || null;
    } catch {
      return null;
    }
  };

  const legacyOwner = await tryLegacyUserKey(ownerId);
  if (legacyOwner) return { secret: legacyOwner, source: "legacy.users.defaultOpenaiApiKey.owner", provider: "OPENAI" };

  if (actorId && actorId !== ownerId) {
    const legacyActor = await tryLegacyUserKey(actorId);
    if (legacyActor) return { secret: legacyActor, source: "legacy.users.defaultOpenaiApiKey.actor", provider: "OPENAI" };
  }

  const envKey = String(process.env.OPENAI_API_KEY ?? "").trim();
  if (envKey && allowEnvOpenAiFallback()) return { secret: envKey, source: "env.OPENAI_API_KEY", provider: "OPENAI" };

  return { secret: null, source: "missing", provider: "OPENAI" };
}

async function resolveCodeAgentSecretForProject(
  projectId: string,
  workspaceAiMemberId: string | null,
  actorId: string
): Promise<PartialResolve> {
  const tier = await tryIntegrationDbTier(projectId, "CODE_AGENT", workspaceAiMemberId);
  if (tier.tier === "resolved") return tier.value;
  if (tier.tier === "invalid_override") return invalidOverrideResult("CODE_AGENT");

  let setup: { cursorApiToken: string | null; project: { ownerUserId: string } | null } | null = null;
  try {
    setup = await prisma.executionSetup.findUnique({
      where: { projectId },
      select: { cursorApiToken: true, project: { select: { ownerUserId: true } } },
    });
  } catch {
    setup = null;
  }

  const ownerId = String(setup?.project?.ownerUserId ?? tier.ownerUserId ?? "").trim();

  const ownerTok = await decryptLatestActiveUserIntegration(ownerId, "CURSOR", "CODE_AGENT");
  if (ownerTok) return { secret: ownerTok, source: "user_integrations.owner", provider: "CURSOR" };

  if (actorId && actorId !== ownerId) {
    const actorTok = await decryptLatestActiveUserIntegration(actorId, "CURSOR", "CODE_AGENT");
    if (actorTok) return { secret: actorTok, source: "user_integrations.actor", provider: "CURSOR" };
  }

  const tok = String(setup?.cursorApiToken ?? "").trim();
  if (tok) return { secret: tok, source: "execution_setup.cursor", provider: "CURSOR" };

  return { secret: null, source: "missing", provider: "CURSOR" };
}

async function resolveScmSecretForProject(
  projectId: string,
  workspaceAiMemberId: string | null,
  actorId: string
): Promise<PartialResolve> {
  const tier = await tryIntegrationDbTier(projectId, "SCM", workspaceAiMemberId);
  if (tier.tier === "resolved") return tier.value;
  if (tier.tier === "invalid_override") return invalidOverrideResult("SCM");

  let setup: { githubAccessToken: string | null; project: { ownerUserId: string } | null } | null = null;
  try {
    setup = await prisma.executionSetup.findUnique({
      where: { projectId },
      select: { githubAccessToken: true, project: { select: { ownerUserId: true } } },
    });
  } catch {
    setup = null;
  }

  const ownerId = String(setup?.project?.ownerUserId ?? tier.ownerUserId ?? "").trim();

  const ownerPat = await decryptLatestActiveUserIntegration(ownerId, "GITHUB", "SCM");
  if (ownerPat) return { secret: ownerPat, source: "user_integrations.owner", provider: "GITHUB" };

  if (actorId && actorId !== ownerId) {
    const actorPat = await decryptLatestActiveUserIntegration(actorId, "GITHUB", "SCM");
    if (actorPat) return { secret: actorPat, source: "user_integrations.actor", provider: "GITHUB" };
  }

  const gh = String(setup?.githubAccessToken ?? "").trim();
  if (gh) return { secret: gh, source: "execution_setup.github", provider: "GITHUB" };

  return { secret: null, source: "missing", provider: "GITHUB" };
}

async function resolveDeploySecretForProject(
  projectId: string,
  workspaceAiMemberId: string | null,
  actorId: string
): Promise<PartialResolve> {
  const tier = await tryIntegrationDbTier(projectId, "DEPLOY", workspaceAiMemberId);
  if (tier.tier === "resolved") return tier.value;
  if (tier.tier === "invalid_override") return invalidOverrideResult("DEPLOY");

  const ownerId = String(tier.ownerUserId ?? "").trim();

  const ownerTok = await decryptLatestActiveUserIntegration(ownerId, "VERCEL", "DEPLOY");
  if (ownerTok) return { secret: ownerTok, source: "user_integrations.owner", provider: "VERCEL" };

  if (actorId && actorId !== ownerId) {
    const actorTok = await decryptLatestActiveUserIntegration(actorId, "VERCEL", "DEPLOY");
    if (actorTok) return { secret: actorTok, source: "user_integrations.actor", provider: "VERCEL" };
  }

  return { secret: null, source: "not_implemented", provider: "VERCEL" };
}
