import { NextRequest, NextResponse } from "next/server";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { getPrototypeDeployStatusSnapshot } from "@/lib/prototype/prototypeDeploySnapshot";
import { appendPrototypeDeploySecurityFixWorkUnit, refreshPrototypeRunState } from "@/lib/prototype/prototypeRunPipeline";
import { getRun } from "@/lib/prototype/prototypeRunStore";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ runId: string }> },
) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  const { runId } = await segmentData.params;
  const id = String(runId ?? "").trim();
  if (!id) {
    return NextResponse.json({ success: false, message: "runId가 필요합니다." }, { status: 400 });
  }

  let body: { projectId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const projectId = String(body.projectId ?? "").trim();
  if (!projectId) {
    return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
  }

  try {
    await requireProjectPermission(
      projectId,
      userId,
      "canViewProject",
      "POST /api/prototype-runs/[runId]/deploy-security-fix-request",
    );
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    throw error;
  }

  const existing = getRun(projectId, id);
  if (!existing) {
    return NextResponse.json({ success: false, message: "해당 실행을 찾을 수 없습니다." }, { status: 404 });
  }

  const projectRow = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } });
  const projectName = String(projectRow?.name ?? "Project");

  const updated = appendPrototypeDeploySecurityFixWorkUnit(projectId, id, projectName);
  if (!updated) {
    return NextResponse.json(
      { success: false, message: "조치 요청을 생성할 수 없습니다. 보안 조치 필요 상태이고 취약점이 있는지 확인하세요." },
      { status: 409 },
    );
  }

  const run = (await refreshPrototypeRunState(projectId, id)) ?? getRun(projectId, id) ?? updated;
  const deploy = getPrototypeDeployStatusSnapshot(run);
  return NextResponse.json({ success: true, data: { run, deploy } });
}
