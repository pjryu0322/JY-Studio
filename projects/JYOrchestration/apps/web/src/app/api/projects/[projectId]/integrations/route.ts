import { NextRequest, NextResponse } from "next/server";
import type { IntegrationCapability } from "@prisma/client";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { prisma } from "@/lib/prisma";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { upsertMirroredIntegrationBinding } from "@/lib/integrations/integrationBindings";
import { describeProjectCapabilityIntegrationRows } from "@/lib/integrations/resolveIntegration";

const CAPABILITIES: IntegrationCapability[] = ["LLM", "CODE_AGENT", "SCM", "DEPLOY"];

function parseCapability(raw: string): IntegrationCapability | null {
  const u = raw.trim().toUpperCase();
  return (CAPABILITIES as readonly string[]).includes(u) ? (u as IntegrationCapability) : null;
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  const projectId = String((await ctx.params).projectId ?? "").trim();
  if (!projectId) {
    return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
  }

  try {
    await requireProjectPermissionById(projectId, userId, "canViewExecution", "GET project integrations");
  } catch (e) {
    const denied = rbacErrorResponse(e);
    if (denied) return denied;
    throw e;
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerUserId: true },
  });
  if (!project) {
    return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
  }

  const ownerIntegrations = await prisma.userIntegration.findMany({
    where: { userId: project.ownerUserId, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      provider: true,
      capability: true,
      displayName: true,
      isDefault: true,
      credential: { select: { maskedPreview: true } },
    },
  });

  const projRows = await prisma.projectIntegration.findMany({
    where: { projectId },
    select: { capability: true, userIntegrationId: true },
  });
  const byCap = new Map(projRows.map((r) => [r.capability, r.userIntegrationId]));

  const capabilityRows = await describeProjectCapabilityIntegrationRows(projectId, project.ownerUserId, CAPABILITIES);

  return NextResponse.json({
    success: true,
    data: {
      ownerUserId: project.ownerUserId,
      ownerIntegrations: ownerIntegrations.map((r) => ({
        id: r.id,
        provider: r.provider,
        capability: r.capability,
        displayName: r.displayName,
        isDefault: r.isDefault,
        maskedPreview: r.credential.maskedPreview,
      })),
      bindings: Object.fromEntries(CAPABILITIES.map((c) => [c, byCap.get(c) ?? null])) as Record<
        IntegrationCapability,
        string | null
      >,
      capabilityRows,
    },
  });
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  const projectId = String((await ctx.params).projectId ?? "").trim();
  if (!projectId) {
    return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
  }

  try {
    await requireProjectPermissionById(projectId, userId, "canControlExecution", "PATCH project integrations");
  } catch (e) {
    const denied = rbacErrorResponse(e);
    if (denied) return denied;
    throw e;
  }

  let body: { bindings?: Record<string, string | null | undefined> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerUserId: true },
  });
  if (!project) {
    return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
  }

  const bindings = body.bindings ?? {};
  const entries: [IntegrationCapability, string | null][] = [];
  for (const [k, v] of Object.entries(bindings)) {
    const cap = parseCapability(k);
    if (!cap) continue;
    if (v === undefined) continue;
    const id = v === null || v === "" ? null : String(v).trim();
    if (id) {
      const ok = await prisma.userIntegration.findFirst({
        where: { id, userId: project.ownerUserId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!ok) {
        return NextResponse.json(
          { success: false, message: `선택한 연동이 프로젝트 소유자의 등록 항목이 아닙니다. (${cap})` },
          { status: 400 }
        );
      }
    }
    entries.push([cap, id]);
  }

  await prisma.$transaction(async (tx) => {
    for (const [cap, uid] of entries) {
      await upsertMirroredIntegrationBinding(tx, projectId, cap, uid);
    }
  });

  return NextResponse.json({ success: true, message: "프로젝트 연동 선택을 저장했습니다." });
}
