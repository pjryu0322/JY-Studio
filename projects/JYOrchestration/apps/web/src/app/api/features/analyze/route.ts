import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { runFeatureWorkspaceAnalyzeOpenAI } from "@/lib/features/featureWorkspaceOpenAI";
import type { FeatureWorkspaceV1, RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";

type Body = {
  projectId?: string;
  projectTitle?: string;
  projectDescription?: string;
  actorWorkspaceV1?: unknown;
  serviceFlowV1?: RequirementsServiceFlowV1 | null;
  featureWorkspaceV1?: FeatureWorkspaceV1 | null;
};

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    try {
      await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/features/analyze");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const projectTitle = String(body.projectTitle ?? "").trim();
    const projectDescription = String(body.projectDescription ?? "").trim();
    const flow = (body.serviceFlowV1 ?? null) as RequirementsServiceFlowV1 | null;
    const actorWorkspaceJson =
      body.actorWorkspaceV1 !== undefined && body.actorWorkspaceV1 !== null
        ? JSON.stringify(body.actorWorkspaceV1).slice(0, 24_000)
        : "";

    let existingSummary = "";
    if (body.featureWorkspaceV1 && typeof body.featureWorkspaceV1 === "object") {
      const fw = body.featureWorkspaceV1 as FeatureWorkspaceV1;
      if (fw.stages?.length) {
        existingSummary = fw.stages
          .map((s) => `${s.title}: ${s.features.map((f) => f.title).join(", ")}`)
          .join("\n")
          .slice(0, 8000);
      }
    }

    const serviceFlowJson = JSON.stringify(flow ?? {}).slice(0, 32_000);

    const result = await runFeatureWorkspaceAnalyzeOpenAI({
      projectTitle,
      projectDescription,
      serviceFlowJson,
      actorWorkspaceJson: actorWorkspaceJson || undefined,
      existingFeatureSummary: existingSummary || undefined,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, code: result.code, message: result.message },
        { status: result.code === "NO_KEY" ? 503 : 502 },
      );
    }

    return NextResponse.json({ success: true, data: { stages: result.stages }, meta: { model: result.model } });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST /api/features/analyze error:", error);
    return NextResponse.json({ success: false, message: "기능 분석 중 오류가 발생했습니다." }, { status: 500 });
  }
}
