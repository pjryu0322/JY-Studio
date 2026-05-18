import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import {
  executionSetupSchemaDriftResponse,
  isExecutionSetupSchemaDriftError,
} from "@/lib/prisma/executionSetupSchemaMismatch";
import { withExecutionSetupSchemaHealRetry } from "@/lib/prisma/executionSetupSplitColumnsHeal";
import { requireProjectOwnedByUser } from "@/lib/service/taskOwnershipGuard";

/**
 * 프로젝트 소유자만 저장된 GitHub 토큰 전체를 일시 확인할 수 있습니다.
 * 응답 본문에만 포함되며 로그에 남기지 않습니다.
 */
export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await segmentData.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectOwnedByUser(pid, userId, "POST .../github-token/reveal");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const row = await withExecutionSetupSchemaHealRetry(() =>
      prisma.executionSetup.findUnique({
        where: { projectId: pid },
        select: { githubAccessToken: true },
      })
    );

    const tok = row?.githubAccessToken?.trim();
    if (!tok) {
      return NextResponse.json({ success: false, message: "저장된 GitHub 토큰이 없습니다." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { plaintext: tok },
    });
  } catch (e) {
    if (isExecutionSetupSchemaDriftError(e)) return executionSetupSchemaDriftResponse();
    return NextResponse.json({ success: false, message: "토큰을 불러오지 못했습니다." }, { status: 500 });
  }
}

