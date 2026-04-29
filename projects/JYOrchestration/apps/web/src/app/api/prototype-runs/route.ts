import { NextRequest, NextResponse } from "next/server";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { orchestrateNewPrototypeRun } from "@/lib/prototype/prototypeRunPipeline";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  let body: {
    projectId?: string;
    selectedTemplate?: string;
    promptSnapshot?: string;
    startCursorAgent?: boolean;
    plannerContext?: {
      projectDescription?: string;
      actorFlowSummary?: string;
      featureDraftTitles?: string[];
    };
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const projectId = String(body.projectId ?? "").trim();
  const selectedTemplate = String(body.selectedTemplate ?? "").trim();
  const promptSnapshot = String(body.promptSnapshot ?? "").trim();
  const startCursorAgent = Boolean(body.startCursorAgent);

  if (!projectId) {
    return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
  }
  if (!selectedTemplate) {
    return NextResponse.json({ success: false, message: "selectedTemplate이 필요합니다." }, { status: 400 });
  }
  if (!promptSnapshot) {
    return NextResponse.json({ success: false, message: "promptSnapshot이 필요합니다." }, { status: 400 });
  }

  try {
    await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/prototype-runs");
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    throw error;
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });
  if (!project) {
    return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
  }

  const ctx = body.plannerContext;
  const out = await orchestrateNewPrototypeRun({
    projectId,
    projectName: project.name,
    selectedTemplate,
    promptSnapshot,
    startCursorAgent,
    plannerActorUserId: userId,
    plannerContext: ctx
      ? {
          projectDescription: String(ctx.projectDescription ?? "").trim(),
          actorFlowSummary: String(ctx.actorFlowSummary ?? "").trim(),
          featureDraftTitles: Array.isArray(ctx.featureDraftTitles) ? ctx.featureDraftTitles.map(String) : [],
        }
      : undefined,
  });

  return NextResponse.json({
    success: true,
    data: {
      run: out.run,
      automationAvailable: out.automationAvailable,
      automationBlockReason: out.automationBlockReason,
      message: out.message,
    },
  });
}
