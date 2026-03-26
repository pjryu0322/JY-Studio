import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  getProjectSpecContext,
  updateProjectSpecContext,
} from "@/lib/service/projectSpecContextService";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId")?.trim() ?? "";
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    try {
      await requireProjectPermissionById(
        projectId,
        userId,
        "canViewProject",
        "GET /api/project-spec/context"
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const data = await getProjectSpecContext(projectId);
    if (!data) {
      return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Project Spec 컨텍스트를 조회했습니다.",
      data,
    });
  } catch (error) {
    console.error("GET /api/project-spec/context error:", error);
    return NextResponse.json(
      { success: false, message: "컨텍스트 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

type PatchBody = {
  projectId?: string;
  name?: string;
  description?: string | null;
  projectType?: string;
  coreGoals?: string | null;
  inScope?: string | null;
  outOfScope?: string | null;
  targetUsers?: string | null;
  successCriteria?: string | null;
};

export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    let body: PatchBody;
    try {
      body = (await request.json()) as PatchBody;
    } catch {
      return NextResponse.json({ success: false, message: "요청 본문이 올바른 JSON이 아닙니다." }, { status: 400 });
    }

    const projectId = String(body.projectId ?? "").trim();
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    try {
      await requireProjectPermissionById(
        projectId,
        userId,
        "canGenerateTask",
        "PATCH /api/project-spec/context"
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    if (body.name !== undefined) {
      const name = String(body.name ?? "").trim();
      if (!name) {
        return NextResponse.json({ success: false, message: "프로젝트명은 비울 수 없습니다." }, { status: 400 });
      }
    }
    if (body.projectType !== undefined) {
      const pt = String(body.projectType ?? "").trim();
      if (!pt) {
        return NextResponse.json({ success: false, message: "projectType이 비어 있습니다." }, { status: 400 });
      }
    }

    const updated = await updateProjectSpecContext(projectId, {
      name: body.name !== undefined ? String(body.name).trim() : undefined,
      description: body.description,
      projectType: body.projectType !== undefined ? String(body.projectType).trim() : undefined,
      coreGoals: body.coreGoals,
      inScope: body.inScope,
      outOfScope: body.outOfScope,
      targetUsers: body.targetUsers,
      successCriteria: body.successCriteria,
    });

    if (!updated) {
      return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Project Spec 컨텍스트가 저장되었습니다.",
      data: updated,
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("PATCH /api/project-spec/context error:", error);
    return NextResponse.json(
      { success: false, message: "컨텍스트 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
