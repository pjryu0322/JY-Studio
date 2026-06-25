/**
 * Internal operations API only — not part of the default user reference flow.
 * Do not call from project create or ideation planning UX.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { canAccessPlatformAdminConsole } from "@/lib/admin/platformAdmin";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import {
  clampMaterializeMissingLimit,
  materializeMissingReferenceContextsBatch,
} from "@/lib/project-knowledge/projectKnowledgeReferenceMaterializationBatchService";

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    let dryRun = true;
    let limit: number | undefined;
    try {
      const body = (await request.json()) as { dryRun?: unknown; limit?: unknown };
      if (body?.dryRun === false) dryRun = false;
      if (body?.dryRun === true) dryRun = true;
      limit = clampMaterializeMissingLimit(body?.limit);
    } catch {
      dryRun = true;
      limit = clampMaterializeMissingLimit(undefined);
    }

    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { globalRole: true, email: true },
    });
    const scanAsPlatformAdmin = canAccessPlatformAdminConsole(actor?.globalRole, actor?.email);

    const result = await materializeMissingReferenceContextsBatch({
      userId,
      dryRun,
      limit,
      scanAsPlatformAdmin,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST reference-selection/materialize-missing error:", error);
    return NextResponse.json({ success: false, message: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
