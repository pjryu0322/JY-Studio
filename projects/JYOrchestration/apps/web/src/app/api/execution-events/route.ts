import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get("jobId")?.trim() || "";
    if (!jobId) {
      return jsonError("jobId is required", 400);
    }

    const job = await prisma.executionJob.findUnique({
      where: { id: jobId },
      select: { id: true, projectId: true },
    });
    if (!job) {
      return jsonError("?�행 ?�업??찾을 ???�습?�다.", 404);
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    try {
      await requireProjectPermissionById(job.projectId, userId, "canViewExecution", "GET /api/execution-events");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const rows = await prisma.executionEventLog.findMany({
      where: { executionJobId: job.id },
      orderBy: { createdAt: "asc" },
      select: {
        stage: true,
        status: true,
        message: true,
        detailJson: true,
        durationMs: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({
        stage: r.stage,
        status: r.status,
        message: r.message,
        durationMs: r.durationMs,
        createdAt: r.createdAt.toISOString(),
        detailJson: r.detailJson ?? null,
      })),
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("GET /api/execution-events error:", error);
    return jsonError("?�행 ?�벤??조회 �??�류가 발생?�습?�다.", 500);
  }
}
