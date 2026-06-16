import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { executeProductDefinitionChatTurn } from "@/lib/requirements/productDefinitionChatService";
import { findProjectScalarsByIdSafe } from "@/lib/service/projectFindForApi";
import { prisma } from "@/lib/prisma";
import { mergeRequirementsStateJson, parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { Prisma } from "@prisma/client";

type Body = Readonly<{
  projectId?: string;
  userMessage?: string;
  recentTranscript?: string;
}>;

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const userId = await requireSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });
    }

    const projectId = String(body.projectId ?? "").trim();
    const userMessage = String(body.userMessage ?? "").trim();
    if (!projectId || !userMessage) {
      return NextResponse.json({ success: false, message: "projectId와 userMessage가 필요합니다." }, { status: 400 });
    }

    await requireProjectPermission(projectId, userId, "canEditProject", "POST /api/requirements/product-definition-chat");

    const row = await findProjectScalarsByIdSafe(projectId);
    if (!row) {
      return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim() ?? null;
    const result = await executeProductDefinitionChatTurn({
      projectId,
      userMessage,
      requirementsStateJson: row.requirementsStateJson,
      apiKey,
      recentTranscript: String(body.recentTranscript ?? "").trim() || undefined,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, code: result.code, message: result.message }, { status: 200 });
    }

    await prisma.project.update({
      where: { id: projectId },
      data: {
        requirementsStateJson: result.mergedState as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        assistantMessage: result.assistantMessage,
        requirementsStateJson: result.mergedState,
        completedPlanning: result.completedPlanning,
      },
    });
  } catch (error) {
    const rbac = rbacErrorResponse(error);
    if (rbac) return rbac;
    console.error("POST product-definition-chat error:", error);
    return NextResponse.json({ success: false, message: "Product Definition 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
