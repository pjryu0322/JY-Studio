import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { prisma } from "@/lib/prisma";
import { getSoftDeletePreviewCounts } from "@/lib/service/projectService";

/**
 * 소프트 삭제 확인 모달용: OWNER만 조회.
 */
export async function GET(
  req: NextRequest,
  segmentData: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await segmentData.params;
    const id = String(projectId ?? "").trim();
    if (!id) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(req);
    if (userId instanceof NextResponse) {
      return userId;
    }

    const project = await prisma.project.findUnique({
      where: { id },
      select: { ownerUserId: true },
    });
    if (!project) {
      return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }
    if (project.ownerUserId !== userId) {
      return NextResponse.json(
        { success: false, message: "프로젝트 소유자만 삭제 미리보기를 조회할 수 있습니다." },
        { status: 403 }
      );
    }

    const data = await getSoftDeletePreviewCounts(id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/projects/[projectId]/delete-preview error:", error);
    return NextResponse.json(
      { success: false, message: "삭제 미리보기 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
