import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { runFeaturePlannerTurnOpenAI } from "@/lib/features/featureWorkspaceOpenAI";
import type { FeatureWorkspaceV1, RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";

type Body = {
  projectId?: string;
  projectTitle?: string;
  projectDescription?: string;
  serviceFlowV1?: RequirementsServiceFlowV1 | null;
  selectedStageKey?: string | null;
  workspace?: FeatureWorkspaceV1 | null;
  userMessage?: string;
};

function flowExcerpt(flow: RequirementsServiceFlowV1 | null): string {
  if (!flow) return "(서비스 흐름 없음)";
  const actors = (flow.actors ?? []).map((a) => `${a.name}(${a.kind})`).join(", ");
  const steps = (flow.steps ?? [])
    .filter((s) => s.approved)
    .sort((a, b) => a.order - b.order)
    .map((s) => `- ${s.title} / 주:${s.primaryActorId} 부:${(s.secondaryActorIds ?? []).join(",")}`)
    .join("\n");
  return `actors: ${actors}\nsteps:\n${steps}`.slice(0, 14_000);
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    const userMessage = String(body.userMessage ?? "").trim();
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }
    if (!userMessage) {
      return NextResponse.json({ success: false, message: "userMessage가 필요합니다." }, { status: 400 });
    }

    try {
      await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/features/planner-turn");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const w = (body.workspace ?? null) as FeatureWorkspaceV1 | null;
    const flow = (body.serviceFlowV1 ?? null) as RequirementsServiceFlowV1 | null;
    const sk = String(body.selectedStageKey ?? "").trim();
    const stage = w?.stages?.find((s) => s.stageKey === sk) ?? w?.stages?.[0] ?? null;
    const featSum =
      stage?.features.map((f) => `- ${f.title} [p${f.priority}]${f.status ? ` ${f.status}` : ""}`).join("\n") ?? "";
    const qQueue = (stage?.plannerQuestions ?? []).map((q, i) => `${i + 1}. ${q}`).join("\n");
    const chatTail = (w?.chat ?? [])
      .slice(-12)
      .map((m) => `${m.role}: ${m.text}`)
      .join("\n---\n")
      .slice(0, 8000);

    const result = await runFeaturePlannerTurnOpenAI({
      projectTitle: String(body.projectTitle ?? "").trim(),
      projectDescription: String(body.projectDescription ?? "").trim(),
      serviceFlowExcerpt: flowExcerpt(flow),
      selectedStageTitle: stage?.title ?? "(단계 없음)",
      selectedStageFeaturesSummary: featSum,
      plannerQuestionsQueue: qQueue,
      chatTail,
      userMessage,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, code: result.code, message: result.message },
        { status: result.code === "NO_KEY" ? 503 : 502 },
      );
    }

    return NextResponse.json({ success: true, data: { text: result.text }, meta: { model: result.model } });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST /api/features/planner-turn error:", error);
    return NextResponse.json({ success: false, message: "AI 응답 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
