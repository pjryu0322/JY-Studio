import { Prisma, type IntegrationCapability, type IntegrationProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptIntegrationSecret } from "@/lib/integrations/credentialCrypto";

export type ResolveIntegrationSource = "AI_MEMBER_PIN" | "PROJECT_OVERRIDE" | "USER_DEFAULT";

export type ResolveIntegrationOk = {
  ok: true;
  source: ResolveIntegrationSource;
  userIntegrationId: string;
  provider: IntegrationProvider;
  capability: IntegrationCapability;
  credential: string;
  meta: Prisma.JsonValue | null;
};

export type ResolveIntegrationErr = {
  ok: false;
  code: "MISSING" | "INVALID_OVERRIDE";
  message: string;
};

export type ResolveIntegrationResult = ResolveIntegrationOk | ResolveIntegrationErr;

async function findProjectIntegrationOverrideRow(
  projectId: string,
  capability: IntegrationCapability
): Promise<{ userIntegrationId: string | null; metaOverride: Prisma.JsonValue | null } | null> {
  try {
    return await prisma.projectIntegration.findUnique({
      where: { projectId_capability: { projectId, capability } },
      select: { userIntegrationId: true, metaOverride: true },
    });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2022") throw e;
  }
  const legacy = await prisma.projectIntegration.findUnique({
    where: { projectId_capability: { projectId, capability } },
    select: { userIntegrationId: true },
  });
  return legacy ? { ...legacy, metaOverride: null as Prisma.JsonValue | null } : null;
}

function mergeMeta(
  base: Prisma.JsonValue | null,
  override: Prisma.JsonValue | null
): Prisma.JsonValue | null {
  if (override === null || override === undefined) return base;
  if (
    base &&
    typeof base === "object" &&
    !Array.isArray(base) &&
    typeof override === "object" &&
    !Array.isArray(override)
  ) {
    return { ...(base as Record<string, unknown>), ...(override as Record<string, unknown>) } as Prisma.JsonValue;
  }
  return override as Prisma.JsonValue;
}

async function tryDecryptOwnedUserIntegration(
  integrationId: string,
  expectedCapability: IntegrationCapability,
  ownerUserId: string
): Promise<
  | { ok: true; provider: IntegrationProvider; credential: string; meta: Prisma.JsonValue | null }
  | { ok: false }
> {
  const row = await prisma.userIntegration.findUnique({
    where: { id: integrationId },
    select: {
      userId: true,
      status: true,
      capability: true,
      provider: true,
      meta: true,
      credential: { select: { ciphertext: true, iv: true } },
    },
  });
  if (!row) return { ok: false };
  if (row.userId !== ownerUserId) return { ok: false };
  if (row.status !== "ACTIVE" || row.capability !== expectedCapability) return { ok: false };
  try {
    const credential = decryptIntegrationSecret(row.credential.ciphertext, row.credential.iv).trim();
    if (!credential) return { ok: false };
    return { ok: true, provider: row.provider, credential, meta: row.meta };
  } catch {
    return { ok: false };
  }
}

/**
 * 프로젝트·capability별 연동 해석.
 * 우선순위: AI 멤버 핀 → project_integrations → workspace_integrations(미러) → 사용자 기본(isDefault).
 * 레거시(execution_setup·평문 사용자 키 등)는 호출하지 않습니다 — `resolveProvider`가 MISSING 뒤 처리합니다.
 */
export async function resolveIntegration(input: {
  readonly projectId: string;
  readonly capability: IntegrationCapability;
  readonly ownerUserId: string;
  readonly workspaceAiMemberId?: string | null;
}): Promise<ResolveIntegrationResult> {
  const { projectId, capability, ownerUserId } = input;
  const memberId = String(input.workspaceAiMemberId ?? "").trim() || null;

  if (memberId) {
    const pin = await prisma.aiMemberProvider.findUnique({
      where: { workspaceAiMemberId_capability: { workspaceAiMemberId: memberId, capability } },
      select: { userIntegrationId: true },
    });
    if (pin?.userIntegrationId) {
      const hit = await tryDecryptOwnedUserIntegration(pin.userIntegrationId, capability, ownerUserId);
      if (hit.ok) {
        return {
          ok: true,
          source: "AI_MEMBER_PIN",
          userIntegrationId: pin.userIntegrationId,
          provider: hit.provider,
          capability,
          credential: hit.credential,
          meta: hit.meta,
        };
      }
      return {
        ok: false,
        code: "INVALID_OVERRIDE",
        message:
          "이 AI 멤버에 연결된 연동이 유효하지 않거나 비활성입니다. 프로젝트 Integrations 또는 멤버 설정에서 다시 지정하세요.",
      };
    }
  }

  const [projRow, wsRow] = await Promise.all([
    findProjectIntegrationOverrideRow(projectId, capability),
    prisma.workspaceIntegration.findUnique({
      where: { projectId_capability: { projectId, capability } },
      select: { userIntegrationId: true },
    }),
  ]);

  const overrideId = projRow?.userIntegrationId ?? wsRow?.userIntegrationId ?? null;
  const metaOverride = projRow && "metaOverride" in projRow ? projRow.metaOverride : null;

  if (overrideId) {
    const hit = await tryDecryptOwnedUserIntegration(overrideId, capability, ownerUserId);
    if (hit.ok) {
      return {
        ok: true,
        source: "PROJECT_OVERRIDE",
        userIntegrationId: overrideId,
        provider: hit.provider,
        capability,
        credential: hit.credential,
        meta: mergeMeta(hit.meta, metaOverride),
      };
    }
    return {
      ok: false,
      code: "INVALID_OVERRIDE",
      message:
        "프로젝트에 지정된 연동이 유효하지 않습니다. Integrations에서 자격 증명을 확인하거나 기본값으로 되돌리세요.",
    };
  }

  let def: { id: string } | null = null;
  try {
    def = await prisma.userIntegration.findFirst({
      where: {
        userId: ownerUserId,
        capability,
        isDefault: true,
        status: "ACTIVE",
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2022") throw e;
    def = await prisma.userIntegration.findFirst({
      where: { userId: ownerUserId, capability, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
  }
  if (def) {
    const hit = await tryDecryptOwnedUserIntegration(def.id, capability, ownerUserId);
    if (hit.ok) {
      return {
        ok: true,
        source: "USER_DEFAULT",
        userIntegrationId: def.id,
        provider: hit.provider,
        capability,
        credential: hit.credential,
        meta: hit.meta,
      };
    }
  }

  return {
    ok: false,
    code: "MISSING",
    message: `Integrations에서 ${capability} 역할에 맞는 연동을 등록하고, 필요 시「기본」으로 지정하세요.`,
  };
}

export type ProjectCapabilityIntegrationUiStatus = "OK" | "INVALID_OVERRIDE" | "MISSING";

export type ProjectCapabilityIntegrationUiRow = {
  readonly capability: IntegrationCapability;
  readonly status: ProjectCapabilityIntegrationUiStatus;
  /** 프로젝트 슬롯에 저장된 user_integration id (없으면 null) */
  readonly bindingUserIntegrationId: string | null;
  /** 실제로 사용될 연동 id (USER_DEFAULT일 때 기본 연동 id) */
  readonly effectiveUserIntegrationId: string | null;
  readonly source: "PROJECT_OVERRIDE" | "USER_DEFAULT" | null;
  readonly provider: IntegrationProvider | null;
  readonly maskedPreview: string | null;
  readonly displayName: string | null;
  readonly message: string | null;
};

export async function describeProjectCapabilityIntegrationRows(
  projectId: string,
  ownerUserId: string,
  capabilities: readonly IntegrationCapability[]
): Promise<ProjectCapabilityIntegrationUiRow[]> {
  type OwnerIntRow = {
    id: string;
    capability: IntegrationCapability;
    provider: IntegrationProvider;
    isDefault: boolean;
    displayName: string | null;
    credential: { maskedPreview: string | null };
  };

  const [projRows, wsRows, ownerIntsUnknown] = await Promise.all([
    prisma.projectIntegration.findMany({
      where: { projectId },
      select: { capability: true, userIntegrationId: true },
    }),
    prisma.workspaceIntegration.findMany({
      where: { projectId },
      select: { capability: true, userIntegrationId: true },
    }),
    prisma.userIntegration.findMany({
      where: { userId: ownerUserId, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        capability: true,
        provider: true,
        isDefault: true,
        displayName: true,
        credential: { select: { maskedPreview: true } },
      },
    }),
  ]);
  const ownerInts = ownerIntsUnknown as OwnerIntRow[];

  const projByCap = new Map(projRows.map((r) => [r.capability, r.userIntegrationId]));
  const wsByCap = new Map(wsRows.map((r) => [r.capability, r.userIntegrationId]));
  const byId = new Map(ownerInts.map((r) => [r.id, r]));

  const bindingMatchesCapability = (uid: string, cap: IntegrationCapability): boolean => {
    const row = byId.get(uid);
    return Boolean(row && row.capability === cap);
  };

  const out: ProjectCapabilityIntegrationUiRow[] = [];
  for (const capability of capabilities) {
    const bindingId = projByCap.get(capability) ?? wsByCap.get(capability) ?? null;

    if (bindingId) {
      const okBinding = bindingMatchesCapability(bindingId, capability);
      if (!okBinding) {
        out.push({
          capability,
          status: "INVALID_OVERRIDE",
          bindingUserIntegrationId: bindingId,
          effectiveUserIntegrationId: null,
          source: "PROJECT_OVERRIDE",
          provider: null,
          maskedPreview: null,
          displayName: null,
          message: "선택된 연동이 없거나 capability가 맞지 않습니다. Integrations에서 확인하세요.",
        });
        continue;
      }
      const row = byId.get(bindingId)!;
      out.push({
        capability,
        status: "OK",
        bindingUserIntegrationId: bindingId,
        effectiveUserIntegrationId: bindingId,
        source: "PROJECT_OVERRIDE",
        provider: row.provider,
        maskedPreview: row.credential.maskedPreview,
        displayName: row.displayName,
        message: null,
      });
      continue;
    }

    const def = ownerInts.find((r) => r.capability === capability && r.isDefault);
    if (def) {
      out.push({
        capability,
        status: "OK",
        bindingUserIntegrationId: null,
        effectiveUserIntegrationId: def.id,
        source: "USER_DEFAULT",
        provider: def.provider,
        maskedPreview: def.credential.maskedPreview,
        displayName: def.displayName,
        message: null,
      });
      continue;
    }

    out.push({
      capability,
      status: "MISSING",
      bindingUserIntegrationId: null,
      effectiveUserIntegrationId: null,
      source: null,
      provider: null,
      maskedPreview: null,
      displayName: null,
      message: "Integrations에서 먼저 연동을 등록하고, 해당 capability의 기본 연동을 지정하세요.",
    });
  }

  return out;
}
