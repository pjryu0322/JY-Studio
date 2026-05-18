import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { pingOpenAiModelsList } from "@/lib/project/requirementsAiFacilitatorOpenAI";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { resolveProvider } from "@/lib/integrations/resolveProvider";

/**
 * 요구사항 화면용: OpenAI API 키 존재 및 최소 네트워크 검증(모델 목록 1건).
 * `?projectId=` 가 있으면 해당 프로젝트 기준 `resolveProvider(..., LLM)` 키로 검증합니다.
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await requireSessionUserId(request);
    if (gate instanceof NextResponse) {
      return gate;
    }

    const projectId = String(request.nextUrl.searchParams.get("projectId") ?? "").trim();
    let apiKeyOverride: string | null = null;
    let nonOpenAiLlm: string | null = null;
    if (projectId) {
      try {
        await requireProjectPermissionById(projectId, gate, "canViewExecution", "requirements ai-connection");
        const r = await resolveProvider(projectId, "LLM", { actorUserId: gate });
        if (r.provider === "OPENAI") apiKeyOverride = r.secret;
        else if (r.secret) nonOpenAiLlm = r.provider;
      } catch (e) {
        const denied = rbacErrorResponse(e);
        if (denied) return denied;
        throw e;
      }
    }

    if (nonOpenAiLlm) {
      return NextResponse.json({
        success: true,
        data: {
          connected: false,
          code: "NON_OPENAI_LLM",
          message: `프로젝트 LLM 연동이 OpenAI가 아닌「${nonOpenAiLlm}」로 지정되어 있습니다. 이 검사는 OpenAI(sk-) 키가 있을 때만 수행됩니다.`,
          checkedAt: new Date().toISOString(),
        },
      });
    }

    const ping = await pingOpenAiModelsList(apiKeyOverride);
    if (!ping.ok) {
      return NextResponse.json({
        success: true,
        data: {
          connected: false,
          code: ping.code,
          message: ping.message,
          checkedAt: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        connected: true,
        code: "OK",
        message: "OpenAI API에 연결되었습니다.",
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("GET /api/requirements/ai-connection error:", error);
    return NextResponse.json(
      { success: false, message: "연결 상태 확인 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
