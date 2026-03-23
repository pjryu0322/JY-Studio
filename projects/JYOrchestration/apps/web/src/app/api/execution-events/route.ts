import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "@/lib/auth/requestUser";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { requireExecutionPipelineRead } from "@/lib/service/projectAccessGuard";

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get("jobId")?.trim() || "";
    if (!jobId) {
      return jsonError("jobId가 필요합니다.", 400);
    }

    const job = await prisma.executionJob.findUnique({
      where: { id: jobId },
      select: { id: true, projectId: true },
    });
    if (!job) {
      return jsonError("실행 작업을 찾을 수 없습니다.", 404);
    }

    const userId = getCurrentUserIdFromRequest(request);
    try {
      await requireExecutionPipelineRead(job.projectId, userId);
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
      })),
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("GET /api/execution-events error:", error);
    return jsonError("실행 이벤트 조회 중 오류가 발생했습니다.", 500);
  }
}
