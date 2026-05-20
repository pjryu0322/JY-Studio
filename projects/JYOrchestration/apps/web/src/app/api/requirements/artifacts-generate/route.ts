import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { parseFeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import { generateProjectArtifact } from "@/lib/requirements/projectArtifactGenerate";
import { isProjectArtifactType } from "@/lib/requirements/projectArtifactTypes";

type Body = {
  projectId?: string;
  artifactType?: string;
  projectName?: string;
  projectDescription?: string;
  sourceStage?: string | null;
  serviceFlow?: RequirementsServiceFlowV1 | null;
  featurePlanning?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    const artifactTypeRaw = String(body.artifactType ?? "").trim();

    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }
    if (!isProjectArtifactType(artifactTypeRaw)) {
      return NextResponse.json({ success: false, message: "artifactType이 올바르지 않습니다." }, { status: 400 });
    }

    try {
      await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/requirements/artifacts-generate");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const featurePlanning =
      body.featurePlanning === undefined || body.featurePlanning === null
        ? null
        : parseFeaturePlanningSlotsArtifactV1(body.featurePlanning) ?? null;

    const artifact = generateProjectArtifact({
      artifactType: artifactTypeRaw,
      projectName: body.projectName,
      projectDescription: body.projectDescription,
      sourceStage: body.sourceStage,
      serviceFlow: (body.serviceFlow ?? null) as RequirementsServiceFlowV1 | null,
      featurePlanning,
      createdBy: "ai",
    });

    return NextResponse.json({
      success: true,
      artifact,
      meta: {
        route: "artifacts-generate",
        sideAction: true,
        orchestrationTransition: false,
      },
    });
  } catch (error) {
    console.error("POST /api/requirements/artifacts-generate error:", error);
    return NextResponse.json({ success: false, message: "문서 생성에 실패했습니다." }, { status: 500 });
  }
}
