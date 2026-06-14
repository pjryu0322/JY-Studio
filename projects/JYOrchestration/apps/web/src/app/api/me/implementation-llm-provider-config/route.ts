import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { maskOpenAiKeyForUi } from "@/lib/executionSetup/openAiKeyMask";
import { prisma } from "@/lib/prisma";
import {
  parseImplementationLlmProviderConfigWire,
  sanitizeImplementationLlmProviderConfigForApi,
} from "@/lib/prototype/implementationLlmProviderConfigWire";

type Body = Readonly<{
  config?: unknown | null;
  implementationLlmProviderConfig?: unknown | null;
  openaiApiKey?: string | null;
  clearOpenaiApiKey?: boolean;
}>;

async function readUserProviderState(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      implementationLlmProviderConfigJson: true,
      defaultOpenaiApiKey: true,
      defaultOpenaiApiKeyMasked: true,
    },
  });
  const parsed = parseImplementationLlmProviderConfigWire(user?.implementationLlmProviderConfigJson);
  const hasDefaultOpenaiApiKey = Boolean(String(user?.defaultOpenaiApiKey ?? "").trim());
  return {
    config: sanitizeImplementationLlmProviderConfigForApi(parsed),
    hasDefaultOpenaiApiKey,
    defaultOpenaiApiKeyMasked: hasDefaultOpenaiApiKey
      ? user?.defaultOpenaiApiKeyMasked ?? maskOpenAiKeyForUi(String(user?.defaultOpenaiApiKey))
      : null,
  };
}

export async function GET(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  const state = await readUserProviderState(String(userId));
  return NextResponse.json({
    success: true,
    data: {
      config: state.config,
      implementationLlmProviderConfig: state.config,
      hasDefaultOpenaiApiKey: state.hasDefaultOpenaiApiKey,
      defaultOpenaiApiKeyMasked: state.defaultOpenaiApiKeyMasked,
    },
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

  const uid = String(userId);
  const configInput =
    body.implementationLlmProviderConfig !== undefined ? body.implementationLlmProviderConfig : body.config;

  const data: {
    implementationLlmProviderConfigJson?: unknown | null;
    defaultOpenaiApiKey?: string | null;
    defaultOpenaiApiKeyMasked?: string | null;
  } = {};

  if (body.clearOpenaiApiKey === true) {
    data.defaultOpenaiApiKey = null;
    data.defaultOpenaiApiKeyMasked = null;
  } else if (typeof body.openaiApiKey === "string") {
    const key = body.openaiApiKey.trim();
    if (key) {
      if (!key.startsWith("sk-")) {
        return NextResponse.json(
          { success: false, message: "OpenAI API 키 형식이 올바르지 않습니다." },
          { status: 400 },
        );
      }
      data.defaultOpenaiApiKey = key;
      data.defaultOpenaiApiKeyMasked = maskOpenAiKeyForUi(key);
    } else {
      data.defaultOpenaiApiKey = null;
      data.defaultOpenaiApiKeyMasked = null;
    }
  }

  if (configInput === null) {
    data.implementationLlmProviderConfigJson = null;
  } else if (configInput !== undefined) {
    const parsed = parseImplementationLlmProviderConfigWire(configInput);
    if (!parsed) {
      return NextResponse.json(
        { success: false, message: "Provider, 모델, capabilities가 필요합니다." },
        { status: 400 },
      );
    }
    data.implementationLlmProviderConfigJson = {
      version: "implementation_llm_provider_config_v1",
      provider: parsed.provider ?? "openai",
      model: parsed.model,
      scope: "user",
      apiKeyRef: "user_default_openai",
      capabilities: parsed.capabilities,
      enabled: true,
      updatedAt: new Date().toISOString(),
    };
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ success: false, message: "저장할 항목이 없습니다." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: uid }, data });

  const state = await readUserProviderState(uid);
  return NextResponse.json({
    success: true,
    message: "사용자 Provider 설정을 저장했습니다.",
    data: {
      config: state.config,
      implementationLlmProviderConfig: state.config,
      hasDefaultOpenaiApiKey: state.hasDefaultOpenaiApiKey,
      defaultOpenaiApiKeyMasked: state.defaultOpenaiApiKeyMasked,
    },
  });
}
