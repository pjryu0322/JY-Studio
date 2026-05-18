import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ integrationId: string }> }
) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  const integrationId = String((await ctx.params).integrationId ?? "").trim();
  if (!integrationId) {
    return NextResponse.json({ success: false, message: "integrationId가 필요합니다." }, { status: 400 });
  }

  let body: { displayName?: unknown; isDefault?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const row = await prisma.userIntegration.findFirst({
    where: { id: integrationId, userId },
    select: { id: true, capability: true },
  });
  if (!row) {
    return NextResponse.json({ success: false, message: "연동을 찾을 수 없습니다." }, { status: 404 });
  }

  const patchDisplay = body.displayName !== undefined;
  const displayNameRaw =
    body.displayName === undefined || body.displayName === null ? null : String(body.displayName).trim();
  const displayNameNext =
    displayNameRaw && displayNameRaw.length > 0 ? displayNameRaw.slice(0, 120) : patchDisplay ? null : undefined;

  await prisma.$transaction(async (tx) => {
    const data: { displayName?: string | null; isDefault?: boolean } = {};
    if (patchDisplay) {
      data.displayName = displayNameNext ?? null;
    }
    if (body.isDefault === true) {
      await tx.userIntegration.updateMany({
        where: { userId, capability: row.capability },
        data: { isDefault: false },
      });
      data.isDefault = true;
    } else if (body.isDefault === false) {
      data.isDefault = false;
    }
    if (Object.keys(data).length === 0) {
      return;
    }
    await tx.userIntegration.update({ where: { id: row.id }, data });
  });

  const next = await prisma.userIntegration.findUnique({
    where: { id: row.id },
    select: {
      id: true,
      provider: true,
      capability: true,
      status: true,
      displayName: true,
      isDefault: true,
      meta: true,
      updatedAt: true,
      credential: { select: { maskedPreview: true } },
    },
  });

  return NextResponse.json({
    success: true,
    message: "연동을 갱신했습니다.",
    data: next
      ? {
          id: next.id,
          provider: next.provider,
          capability: next.capability,
          status: next.status,
          displayName: next.displayName,
          isDefault: next.isDefault,
          meta: next.meta,
          updatedAt: next.updatedAt.toISOString(),
          maskedPreview: next.credential.maskedPreview,
        }
      : null,
  });
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ integrationId: string }> }
) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  const integrationId = String((await ctx.params).integrationId ?? "").trim();
  if (!integrationId) {
    return NextResponse.json({ success: false, message: "integrationId가 필요합니다." }, { status: 400 });
  }

  const row = await prisma.userIntegration.findFirst({
    where: { id: integrationId, userId },
    select: { id: true, credentialRef: true },
  });
  if (!row) {
    return NextResponse.json({ success: false, message: "연동을 찾을 수 없습니다." }, { status: 404 });
  }

  const credId = row.credentialRef;
  await prisma.$transaction(async (tx) => {
    await tx.projectIntegration.updateMany({
      where: { userIntegrationId: row.id },
      data: { userIntegrationId: null },
    });
    await tx.workspaceIntegration.updateMany({
      where: { userIntegrationId: row.id },
      data: { userIntegrationId: null },
    });
    await tx.aiMemberProvider.updateMany({
      where: { userIntegrationId: row.id },
      data: { userIntegrationId: null },
    });
    await tx.userIntegration.delete({ where: { id: row.id } });
    const remaining = await tx.userIntegration.count({ where: { credentialRef: credId } });
    if (remaining === 0) {
      await tx.integrationCredential.delete({ where: { id: credId } }).catch(() => undefined);
    }
  });

  return NextResponse.json({ success: true, message: "연동을 삭제했습니다." });
}
