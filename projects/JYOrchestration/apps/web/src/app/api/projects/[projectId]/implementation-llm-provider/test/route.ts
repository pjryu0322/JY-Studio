import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  resolveImplementationLlmProviderConfigRecord,
  testImplementationLlmProviderConnection,
} from "@/lib/prototype/implementationLlmProviderConfig.server";
import { IMPLEMENTATION_LLM_PROVIDER_CONFIG_MISSING_MESSAGE } from "@/lib/prototype/implementationLlmProviderMessages";
import type { ImplementationLlmProviderTestResponse } from "@/lib/prototype/implementationLlmProviderConfigWire";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ projectId: string }> },
) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const { projectId } = await ctx.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json(
        {
          success: false,
          message: "projectId가 필요합니다.",
          errorCode: "bad_request",
        } satisfies ImplementationLlmProviderTestResponse,
        { status: 400 },
      );
    }

    try {
      await requireProjectPermissionById(pid, userId, "canViewProject", "POST implementation-llm-provider/test");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const resolved = await resolveImplementationLlmProviderConfigRecord({
      projectId: pid,
      actorUserId: String(userId),
    });

    const out = await testImplementationLlmProviderConnection({
      projectId: pid,
      actorUserId: String(userId),
    });

    const caps = resolved.config?.capabilities;
    const body: ImplementationLlmProviderTestResponse = {
      success: out.ok,
      message: out.ok ? out.message : out.message || IMPLEMENTATION_LLM_PROVIDER_CONFIG_MISSING_MESSAGE,
      ...(out.ok ? {} : { errorCode: "provider_config_missing" }),
      data: {
        provider: resolved.config?.provider ?? "openai",
        model: out.model ?? resolved.config?.model ?? "",
        capabilities: {
          text: caps?.text !== false,
          vision: caps?.vision === true,
          jsonMode: caps && "jsonMode" in caps && caps.jsonMode ? true : true,
        },
        trace: {
          usedEnvFallback: resolved.envFallback,
          capabilitySource: "provider_config",
        },
        providerSource: out.providerSource ?? resolved.providerSource,
      },
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error("POST implementation-llm-provider/test error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "연결 테스트 중 오류가 발생했습니다.",
        errorCode: "internal_error",
      } satisfies ImplementationLlmProviderTestResponse,
      { status: 500 },
    );
  }
}
