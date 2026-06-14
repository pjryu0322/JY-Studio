import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { prisma } from "@/lib/prisma";
import {
  parseImplementationLlmProviderConfigWire,
  sanitizeImplementationLlmProviderConfigForApi,
} from "@/lib/prototype/implementationLlmProviderConfigWire";

type Body = Readonly<{ config?: unknown | null }>;

export async function GET(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  const user = await prisma.user.findUnique({
    where: { id: String(userId) },
    select: { implementationLlmProviderConfigJson: true },
  });
  const parsed = parseImplementationLlmProviderConfigWire(user?.implementationLlmProviderConfigJson);
  return NextResponse.json({
    success: true,
    data: { config: sanitizeImplementationLlmProviderConfigForApi(parsed) },
  });
}

export async function PATCH(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  if (body.config === null) {
    await prisma.user.update({
      where: { id: String(userId) },
      data: { implementationLlmProviderConfigJson: null },
    });
    return NextResponse.json({ success: true, data: { config: null } });
  }

  const parsed = parseImplementationLlmProviderConfigWire(body.config);
  if (!parsed) {
    return NextResponse.json(
      { success: false, message: "Provider, 모델, capabilities가 필요합니다." },
      { status: 400 },
    );
  }

  const stored = {
    version: "implementation_llm_provider_config_v1",
    provider: parsed.provider ?? "openai",
    model: parsed.model,
    scope: "user",
    capabilities: parsed.capabilities,
    enabled: true,
    updatedAt: new Date().toISOString(),
  };

  await prisma.user.update({
    where: { id: String(userId) },
    data: { implementationLlmProviderConfigJson: stored },
  });

  return NextResponse.json({
    success: true,
    data: { config: sanitizeImplementationLlmProviderConfigForApi(parseImplementationLlmProviderConfigWire(stored)) },
  });
}
