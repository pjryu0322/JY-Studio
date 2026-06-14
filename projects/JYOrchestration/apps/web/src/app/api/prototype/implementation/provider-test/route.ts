import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { testImplementationLlmProviderConnection } from "@/lib/prototype/implementationLlmProviderConfig.server";
import { parseImplementationLlmProviderConfigWire } from "@/lib/prototype/implementationLlmProviderConfigWire";
import { IMPLEMENTATION_LLM_PROVIDER_CONFIG_MISSING_MESSAGE } from "@/lib/prototype/implementationLlmProviderMessages";

type Body = Readonly<{
  projectId?: string;
  scope?: "user" | "project";
  providerConfig?: unknown;
}>;

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const scope = body.scope === "user" ? "user" : "project";
    const projectId = String(body.projectId ?? "").trim();
    const draft = parseImplementationLlmProviderConfigWire(body.providerConfig);

    if (scope === "project" && !projectId) {
      return NextResponse.json(
        { ok: false, errorCode: "bad_request", errorMessage: "projectId가 필요합니다." },
        { status: 400 },
      );
    }

    if (scope === "project") {
      try {
        await requireProjectPermission(projectId, userId, "canViewProject", "POST provider-test");
      } catch (error) {
        const denied = rbacErrorResponse(error);
        if (denied) return denied;
        throw error;
      }

      const out = await testImplementationLlmProviderConnection({
        projectId,
        actorUserId: String(userId),
      });

      return NextResponse.json({
        ok: out.ok,
        provider: draft?.provider ?? "openai",
        model: out.model ?? draft?.model ?? "",
        capabilities: {
          text: true,
          vision: draft?.capabilities.vision === true,
          jsonMode: draft?.capabilities.jsonMode !== false,
        },
        errorCode: out.ok ? undefined : "provider_config_missing",
        errorMessage: out.ok ? undefined : out.message ?? IMPLEMENTATION_LLM_PROVIDER_CONFIG_MISSING_MESSAGE,
        trace: { usedEnvFallback: false, capabilitySource: "provider_config" },
      });
    }

    if (!draft) {
      return NextResponse.json({
        ok: false,
        provider: "openai",
        model: "",
        capabilities: { text: true, vision: false },
        errorCode: "provider_config_missing",
        errorMessage: IMPLEMENTATION_LLM_PROVIDER_CONFIG_MISSING_MESSAGE,
        trace: { usedEnvFallback: false, capabilitySource: "provider_config" },
      });
    }

    if (!projectId) {
      return NextResponse.json({
        ok: true,
        provider: draft.provider ?? "openai",
        model: draft.model,
        capabilities: draft.capabilities,
        trace: { usedEnvFallback: false, capabilitySource: "provider_config" },
      });
    }

    const out = await testImplementationLlmProviderConnection({ projectId, actorUserId: String(userId) });
    return NextResponse.json({
      ok: out.ok,
      provider: draft.provider ?? "openai",
      model: out.model ?? draft.model,
      capabilities: draft.capabilities,
      errorCode: out.ok ? undefined : "provider_config_missing",
      errorMessage: out.ok ? undefined : out.message,
      trace: { usedEnvFallback: false, capabilitySource: "provider_config" },
    });
  } catch (error) {
    console.error("POST /api/prototype/implementation/provider-test error:", error);
    return NextResponse.json(
      { ok: false, errorMessage: "Provider 테스트 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
