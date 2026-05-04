import { NextRequest, NextResponse } from "next/server";
import type { IntegrationCapability, IntegrationProvider } from "@prisma/client";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { prisma } from "@/lib/prisma";
import { encryptIntegrationSecret } from "@/lib/integrations/credentialCrypto";
import {
  parseIntegrationCapability,
  parseIntegrationProvider,
  validateUserIntegrationSecret,
} from "@/lib/integrations/integrationRegistration";
import { maskedPreviewForSecret } from "@/lib/integrations/integrationSecretMasking";

export async function GET(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  const rows = await prisma.userIntegration.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
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
    data: rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      capability: r.capability,
      status: r.status,
      displayName: r.displayName,
      isDefault: r.isDefault,
      meta: r.meta,
      updatedAt: r.updatedAt.toISOString(),
      maskedPreview: r.credential.maskedPreview,
    })),
  });
}

export async function POST(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  let body: {
    provider?: unknown;
    capability?: unknown;
    secret?: unknown;
    meta?: unknown;
    displayName?: unknown;
    isDefault?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const p = parseIntegrationProvider(body.provider);
  const c = parseIntegrationCapability(body.capability);
  const secret = String(body.secret ?? "").trim();
  if (!p || !c) {
    return NextResponse.json({ success: false, message: "provider·capability가 필요합니다." }, { status: 400 });
  }
  const provider = p as IntegrationProvider;
  const capability = c as IntegrationCapability;
  if (!secret) {
    return NextResponse.json({ success: false, message: "secret이 필요합니다." }, { status: 400 });
  }

  const validation = validateUserIntegrationSecret(p, c, secret);
  if (validation) {
    return NextResponse.json({ success: false, message: validation }, { status: 400 });
  }

  let enc: { ciphertextB64: string; ivB64: string };
  try {
    enc = encryptIntegrationSecret(secret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message: msg }, { status: 503 });
  }

  const maskedPreview = maskedPreviewForSecret(provider, secret);
  const displayNameRaw = body.displayName === undefined || body.displayName === null ? null : String(body.displayName).trim();
  const displayName = displayNameRaw && displayNameRaw.length > 0 ? displayNameRaw.slice(0, 120) : null;
  const wantDefaultExplicit = body.isDefault === true;

  try {
    const row = await prisma.$transaction(async (tx) => {
      const existingForCap = await tx.userIntegration.count({ where: { userId, capability } });
      const hasDefault = await tx.userIntegration.findFirst({
        where: { userId, capability, isDefault: true },
        select: { id: true },
      });
      const setAsDefault = wantDefaultExplicit || !hasDefault || existingForCap === 0;

      const cred = await tx.integrationCredential.create({
        data: {
          ciphertext: enc.ciphertextB64,
          iv: enc.ivB64,
          algorithm: "aes-256-gcm",
          maskedPreview,
        },
      });
      if (setAsDefault) {
        await tx.userIntegration.updateMany({
          where: { userId, capability },
          data: { isDefault: false },
        });
      }
      return tx.userIntegration.create({
        data: {
          userId,
          provider,
          capability,
          credentialRef: cred.id,
          displayName: displayName ?? undefined,
          isDefault: setAsDefault,
          meta: body.meta === undefined || body.meta === null ? undefined : (body.meta as object),
          status: "ACTIVE",
        },
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
    });

    return NextResponse.json({
      success: true,
      message: "연동을 저장했습니다.",
      data: {
        id: row.id,
        provider: row.provider,
        capability: row.capability,
        status: row.status,
        displayName: row.displayName,
        isDefault: row.isDefault,
        meta: row.meta,
        updatedAt: row.updatedAt.toISOString(),
        maskedPreview: row.credential.maskedPreview,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint")) {
      return NextResponse.json(
        { success: false, message: "동일 provider·capability 연동이 이미 있습니다. 삭제 후 다시 등록하세요." },
        { status: 409 }
      );
    }
    console.error("POST /api/me/integrations", e);
    return NextResponse.json({ success: false, message: "저장에 실패했습니다." }, { status: 500 });
  }
}
