import { Prisma, type IntegrationCapability, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import { primaryIntegrationCapabilityForCatalogMember } from "@/lib/ai-member/platformAiMembers";
import {
  WORKSPACE_SCREEN_KEYS,
  allCatalogMemberIds,
  defaultScreenKeysForCatalogMember,
  parseWorkspaceScreenKey,
  resolveEnabledCatalogKeysForScreen,
  type WorkspaceScreenKey,
} from "@/lib/workspace-ai/workspaceScreenKeys";
import type {
  WorkspaceAiGraphMemberWire,
  WorkspaceAiIntegrationPickItemWire,
  WorkspaceAiScreenMappingWire,
} from "@/lib/workspace-ai/workspaceAiGraphWire";
import {
  engineChoicesForCapability,
  inferEnginePreferenceFromProvider,
  parseEnginePreferenceKey,
  resolveEnginePreferenceToUserIntegrationId,
} from "@/lib/workspace-ai/workspaceAiEnginePreference";

export type { WorkspaceAiGraphMemberWire } from "@/lib/workspace-ai/workspaceAiGraphWire";

function integrationDisplayNameFromMeta(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const dn = (meta as { displayName?: unknown }).displayName;
  return typeof dn === "string" && dn.trim() ? dn.trim() : null;
}

/** DB가 `20260511120000_user_integration_defaults_meta` 이전이면 P2022 — 단계적 select로 완화 */
async function findUserIntegrationsForWorkspacePicklists(userId: string): Promise<
  Array<{
    id: string;
    capability: IntegrationCapability;
    provider: string;
    meta: unknown;
    isDefault: boolean;
    credential: { maskedPreview: string | null };
  }>
> {
  const capabilityIn: IntegrationCapability[] = ["LLM", "CODE_AGENT"];
  const where = {
    userId,
    status: "ACTIVE" as const,
    capability: { in: capabilityIn },
  };
  const credential = { select: { maskedPreview: true as const } };
  const tiers: readonly Prisma.UserIntegrationSelect[] = [
    { id: true, capability: true, provider: true, meta: true, isDefault: true, credential },
    { id: true, capability: true, provider: true, meta: true, credential },
    { id: true, capability: true, provider: true, credential },
  ];
  for (const select of tiers) {
    try {
      const rows = await prisma.userIntegration.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        select,
      });
      return rows.map((r) => {
        const cred =
          "credential" in r && r.credential && typeof r.credential === "object"
            ? (r.credential as { maskedPreview: string | null })
            : { maskedPreview: null as string | null };
        return {
          id: r.id,
          capability: r.capability,
          provider: r.provider,
          meta: "meta" in r ? r.meta : null,
          isDefault: "isDefault" in r ? r.isDefault : false,
          credential: cred,
        };
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022") continue;
      throw e;
    }
  }
  return [];
}

function normalizeScreenMappingsToWire(raw: readonly { screenKey: string; autoRun?: boolean }[]): WorkspaceAiScreenMappingWire[] {
  const out: WorkspaceAiScreenMappingWire[] = [];
  for (const r of raw) {
    const p = parseWorkspaceScreenKey(r.screenKey);
    if (p) out.push({ screenKey: p, autoRun: Boolean(r.autoRun) });
  }
  out.sort((a, b) => WORKSPACE_SCREEN_KEYS.indexOf(a.screenKey) - WORKSPACE_SCREEN_KEYS.indexOf(b.screenKey));
  return out;
}

function screensToKeys(screens: readonly WorkspaceAiScreenMappingWire[]): WorkspaceScreenKey[] {
  return screens.map((s) => s.screenKey);
}

/** `prisma generate` 전에 dev가 잠근 경우 등 — 생성 클라이언트가 스키마의 신규 필드를 모를 때 */
function isPrismaUnknownFieldError(e: unknown, fieldName: string): boolean {
  return (
    e instanceof Prisma.PrismaClientValidationError &&
    e.message.includes("Unknown field") &&
    e.message.includes(fieldName)
  );
}

function isPrismaMissingColumnError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022";
}

type WorkspaceAiGraphDbRow = {
  id: string;
  catalogKey: string;
  enabled: boolean;
  enginePreference?: string | null;
  screenMappings: { screenKey: string; autoRun?: boolean }[];
  aiMemberProviders: { capability: IntegrationCapability; userIntegrationId: string | null }[];
};

async function findManyWorkspaceAiMembersForGraph(client: PrismaClient | Prisma.TransactionClient, projectId: string): Promise<WorkspaceAiGraphDbRow[]> {
  const where = { projectId };
  const orderBy = { catalogKey: "asc" as const };
  const includeFull = {
    screenMappings: { select: { screenKey: true as const, autoRun: true as const } },
    aiMemberProviders: { select: { capability: true as const, userIntegrationId: true as const } },
  };
  const includeNoAutoRun = {
    screenMappings: { select: { screenKey: true as const } },
    aiMemberProviders: { select: { capability: true as const, userIntegrationId: true as const } },
  };
  /** DB가 마이그레이션 이전이면 `enginePreference`·`autoRun` 컬럼 없음(P2022) — 존재하는 컬럼만 조회 */
  const selectLegacyShape = {
    id: true as const,
    catalogKey: true as const,
    enabled: true as const,
    screenMappings: { select: { screenKey: true as const } },
    aiMemberProviders: { select: { capability: true as const, userIntegrationId: true as const } },
  };
  try {
    const rows = await client.workspaceAiMember.findMany({
      where,
      include: includeFull,
      orderBy,
    });
    return rows as WorkspaceAiGraphDbRow[];
  } catch (e) {
    if (isPrismaUnknownFieldError(e, "autoRun")) {
      const rows = await client.workspaceAiMember.findMany({ where, include: includeNoAutoRun, orderBy });
      return rows as WorkspaceAiGraphDbRow[];
    }
    if (isPrismaMissingColumnError(e)) {
      const rows = await client.workspaceAiMember.findMany({
        where,
        select: selectLegacyShape,
        orderBy,
      });
      return rows as WorkspaceAiGraphDbRow[];
    }
    throw e;
  }
}

async function createWorkspaceScreenMappingRow(
  tx: Prisma.TransactionClient,
  args: { workspaceAiMemberId: string; screenKey: string; autoRun: boolean }
): Promise<void> {
  try {
    await tx.workspaceScreenAiMapping.create({
      data: { workspaceAiMemberId: args.workspaceAiMemberId, screenKey: args.screenKey, autoRun: args.autoRun },
    });
  } catch (e) {
    if (!isPrismaUnknownFieldError(e, "autoRun")) throw e;
    await tx.workspaceScreenAiMapping.create({
      data: { workspaceAiMemberId: args.workspaceAiMemberId, screenKey: args.screenKey },
    });
    if (!args.autoRun) return;
    try {
      await tx.$executeRaw(
        Prisma.sql`UPDATE "workspace_screen_ai_mapping" SET "autoRun" = true WHERE "workspaceAiMemberId" = ${args.workspaceAiMemberId} AND "screenKey" = ${args.screenKey}`
      );
    } catch {
      // DB에 autoRun 컬럼이 없으면 무시(마이그레이션 미적용)
    }
  }
}

/**
 * 관리 UI·보내기용 전체 그래프(카탈로그 전 행 보장).
 * DB에 `workspace_ai_member`가 하나도 없으면 레거시 기본 스크린만 채워 synthetic 행으로 반환.
 */
export async function getWorkspaceAiGraphForProject(projectId: string): Promise<WorkspaceAiGraphMemberWire[]> {
  const pid = projectId.trim();
  if (!pid) return [];

  const rows = await findManyWorkspaceAiMembersForGraph(prisma, pid);
  const byCatalog = new Map(rows.map((r) => [r.catalogKey, r]));

  const pinIds = [
    ...new Set(
      rows.flatMap((r) =>
        r.aiMemberProviders.map((p) => p.userIntegrationId).filter((x): x is string => Boolean(String(x ?? "").trim()))
      )
    ),
  ];
  const providerByIntegrationId = new Map<string, string>();
  if (pinIds.length) {
    const uis = await prisma.userIntegration.findMany({
      where: { id: { in: pinIds } },
      select: { id: true, provider: true },
    });
    for (const u of uis) providerByIntegrationId.set(u.id, u.provider);
  }

  return allCatalogMemberIds().map((catalogKey) => {
    const cap = primaryIntegrationCapabilityForCatalogMember(catalogKey);
    const row = byCatalog.get(catalogKey);
    if (row) {
      const pin = row.aiMemberProviders.find((p) => p.capability === cap)?.userIntegrationId ?? null;
      const screens = normalizeScreenMappingsToWire(row.screenMappings as { screenKey: string; autoRun?: boolean }[]);
      const screenKeys = screensToKeys(screens);
      const rawEp = row.enginePreference ?? null;
      let enginePreference: string | null = rawEp;
      if (!enginePreference && pin) {
        const prov = providerByIntegrationId.get(pin);
        enginePreference = prov ? inferEnginePreferenceFromProvider(prov) : "USER_DEFAULT";
      } else if (!enginePreference) {
        enginePreference = "USER_DEFAULT";
      }
      return {
        rowId: row.id,
        catalogKey,
        enabled: row.enabled,
        screenKeys,
        screens,
        enginePreference,
        integrationCapability: cap,
        pinnedUserIntegrationId: pin,
      };
    }
    const defSk = [...defaultScreenKeysForCatalogMember(catalogKey)];
    const defScreens: WorkspaceAiScreenMappingWire[] = defSk.map((screenKey) => ({ screenKey, autoRun: false }));
    return {
      rowId: null,
      catalogKey,
      enabled: true,
      screenKeys: defSk,
      screens: defScreens,
      enginePreference: "USER_DEFAULT",
      integrationCapability: cap,
      pinnedUserIntegrationId: null,
    };
  });
}

/** 프로젝트 소유자 Integrations — AI 멤버 연동 선택 드롭다운용 */
export async function getWorkspaceAiOwnerIntegrationPicklists(ownerUserId: string): Promise<{
  LLM: WorkspaceAiIntegrationPickItemWire[];
  CODE_AGENT: WorkspaceAiIntegrationPickItemWire[];
}> {
  const uid = ownerUserId.trim();
  if (!uid) return { LLM: [], CODE_AGENT: [] };
  const rows = await findUserIntegrationsForWorkspacePicklists(uid);
  const llm: WorkspaceAiIntegrationPickItemWire[] = [];
  const code: WorkspaceAiIntegrationPickItemWire[] = [];
  for (const r of rows) {
    const item: WorkspaceAiIntegrationPickItemWire = {
      id: r.id,
      provider: r.provider,
      displayName: integrationDisplayNameFromMeta(r.meta),
      maskedPreview: r.credential.maskedPreview,
      isDefault: r.isDefault,
    };
    if (r.capability === "LLM") llm.push(item);
    else if (r.capability === "CODE_AGENT") code.push(item);
  }
  return { LLM: llm, CODE_AGENT: code };
}

/**
 * 특정 화면에 참여하는 AI(카탈로그 키) — DB+enabled+`NEXT_PUBLIC_AI_MEMBER_*` 반영.
 * DB 그래프가 비어 있으면 레거시 1:1 기본.
 */
export async function getEnabledCatalogKeysForScreen(
  projectId: string,
  screenKey: WorkspaceScreenKey
): Promise<WorkspaceAiMemberId[]> {
  const graph = await getWorkspaceAiGraphForProject(projectId);
  return resolveEnabledCatalogKeysForScreen(graph, screenKey);
}

export type WorkspaceAiGraphSaveMemberInput = {
  readonly catalogKey: WorkspaceAiMemberId;
  readonly enabled: boolean;
  /** 하위 호환: `screens`가 없을 때만 사용(자동 실행은 false) */
  readonly screenKeys?: readonly WorkspaceScreenKey[];
  /** 화면별 참여 + 자동 실행 — 우선 사용 */
  readonly screens?: readonly { screenKey: WorkspaceScreenKey; autoRun: boolean }[];
  /** USER_DEFAULT | OPENAI | ANTHROPIC | GEMINI | CURSOR — 생략 시 레거시 핀만 적용 */
  readonly enginePreference?: string | null;
  /** @deprecated 엔진 UI 사용 시 서버가 핀을 계산합니다 */
  readonly pinnedUserIntegrationId?: string | null;
};

async function assertOwnerPinnedIntegration(input: {
  ownerUserId: string;
  capability: IntegrationCapability;
  userIntegrationId: string | null;
}): Promise<void> {
  if (!input.userIntegrationId) return;
  const ok = await prisma.userIntegration.findFirst({
    where: {
      id: input.userIntegrationId,
      userId: input.ownerUserId,
      capability: input.capability,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  if (!ok) {
    throw new Error(`invalid pinnedUserIntegrationId for ${input.capability}`);
  }
}

export async function replaceWorkspaceAiGraph(projectId: string, members: readonly WorkspaceAiGraphSaveMemberInput[]): Promise<void> {
  const pid = projectId.trim();
  if (!pid) throw new Error("projectId required");

  const project = await prisma.project.findUnique({
    where: { id: pid },
    select: { ownerUserId: true },
  });
  const ownerUserId = String(project?.ownerUserId ?? "").trim();
  if (!ownerUserId) throw new Error("project owner not found");

  const catalogSet = new Set(allCatalogMemberIds());
  for (const m of members) {
    if (!catalogSet.has(m.catalogKey)) throw new Error(`invalid catalogKey: ${m.catalogKey}`);
  }

  for (const m of members) {
    const cap = primaryIntegrationCapabilityForCatalogMember(m.catalogKey);
    if (Object.prototype.hasOwnProperty.call(m, "enginePreference")) {
      const k = parseEnginePreferenceKey(m.enginePreference ?? "USER_DEFAULT");
      const allowed = engineChoicesForCapability(cap);
      if (k && k !== "USER_DEFAULT" && !allowed.includes(k)) {
        throw new Error(`허용되지 않는 enginePreference(${k}) for ${m.catalogKey}`);
      }
    }
    const pin = m.pinnedUserIntegrationId;
    if (pin !== undefined && pin !== null && !Object.prototype.hasOwnProperty.call(m, "enginePreference")) {
      await assertOwnerPinnedIntegration({ ownerUserId, capability: cap, userIntegrationId: pin });
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const m of members) {
      const cap = primaryIntegrationCapabilityForCatalogMember(m.catalogKey);
      const hasEngineKey = Object.prototype.hasOwnProperty.call(m, "enginePreference");
      const epParsed = parseEnginePreferenceKey(m.enginePreference ?? "USER_DEFAULT");
      const epDb = !epParsed || epParsed === "USER_DEFAULT" ? null : epParsed;

      const screenList: readonly { screenKey: WorkspaceScreenKey; autoRun: boolean }[] =
        m.screens && m.screens.length > 0
          ? m.screens
          : (m.screenKeys ?? []).map((screenKey) => ({ screenKey, autoRun: false }));

      const row = await tx.workspaceAiMember.upsert({
        where: { projectId_catalogKey: { projectId: pid, catalogKey: m.catalogKey } },
        create: {
          projectId: pid,
          catalogKey: m.catalogKey,
          enabled: m.enabled,
          enginePreference: hasEngineKey ? epDb : null,
        },
        update: {
          enabled: m.enabled,
          ...(hasEngineKey ? { enginePreference: epDb } : {}),
        },
      });

      let resolvedPin: string | null;
      if (hasEngineKey) {
        if (!epParsed || epParsed === "USER_DEFAULT") {
          resolvedPin = null;
        } else {
          resolvedPin = await resolveEnginePreferenceToUserIntegrationId({
            ownerUserId,
            capability: cap,
            preference: epParsed,
          });
        }
      } else if (m.pinnedUserIntegrationId !== undefined) {
        resolvedPin = m.pinnedUserIntegrationId;
      } else {
        const ex = await tx.aiMemberProvider.findUnique({
          where: { workspaceAiMemberId_capability: { workspaceAiMemberId: row.id, capability: cap } },
          select: { userIntegrationId: true },
        });
        resolvedPin = ex?.userIntegrationId ?? null;
      }

      if (resolvedPin) {
        await assertOwnerPinnedIntegration({ ownerUserId, capability: cap, userIntegrationId: resolvedPin });
      }

      await tx.workspaceScreenAiMapping.deleteMany({ where: { workspaceAiMemberId: row.id } });
      for (const s of screenList) {
        await createWorkspaceScreenMappingRow(tx, {
          workspaceAiMemberId: row.id,
          screenKey: s.screenKey,
          autoRun: s.autoRun,
        });
      }

      await tx.aiMemberProvider.deleteMany({
        where: {
          workspaceAiMemberId: row.id,
          capability: { not: cap },
        },
      });
      await tx.aiMemberProvider.upsert({
        where: { workspaceAiMemberId_capability: { workspaceAiMemberId: row.id, capability: cap } },
        create: {
          workspaceAiMemberId: row.id,
          capability: cap,
          userIntegrationId: resolvedPin,
        },
        update: {
          userIntegrationId: resolvedPin,
        },
      });
    }
  });
}
