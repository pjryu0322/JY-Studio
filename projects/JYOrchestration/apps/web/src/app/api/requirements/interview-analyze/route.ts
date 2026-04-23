import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { runInterviewAnalyzeOpenAI } from "@/lib/project/requirementsAiFacilitatorOpenAI";
import {
  emptyProblemInterviewState,
  type ProblemInterviewSlot,
  type ProblemInterviewState,
} from "@/lib/requirements/problemInterview";

type Body = {
  projectId?: string;
  projectName?: string;
  projectDescription?: string;
  userMessage?: string;
  latestAiQuestion?: string;
  currentInterviewState?: unknown;
};

function coerceInterviewState(raw: unknown, nowIso: string): ProblemInterviewState {
  if (!raw || typeof raw !== "object") return emptyProblemInterviewState(nowIso);
  const o = raw as Record<string, unknown>;
  const base = emptyProblemInterviewState(nowIso);
  return {
    ...base,
    coreUser: typeof o.coreUser === "boolean" ? o.coreUser : base.coreUser,
    painPoint: typeof o.painPoint === "boolean" ? o.painPoint : base.painPoint,
    currentMethod: typeof o.currentMethod === "boolean" ? o.currentMethod : base.currentMethod,
    needForImprovement: typeof o.needForImprovement === "boolean" ? o.needForImprovement : base.needForImprovement,
    notes: typeof o.notes === "object" && o.notes !== null ? { ...(o.notes as Record<string, string>) } : base.notes,
    partial: typeof o.partial === "object" && o.partial !== null ? { ...(o.partial as Record<string, boolean>) } : base.partial,
    askedSlots: Array.isArray(o.askedSlots)
      ? ((o.askedSlots as unknown[])
          .map((x) => String(x ?? "").trim())
          .filter(Boolean)
          .filter((x): x is ProblemInterviewSlot =>
            x === "coreUser" || x === "painPoint" || x === "currentMethod" || x === "needForImprovement"
          ) as ProblemInterviewSlot[])
      : base.askedSlots,
    active: typeof o.active === "boolean" ? o.active : base.active,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : base.updatedAt,
  };
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    const projectName = String(body.projectName ?? "").trim();
    const projectDescription = String(body.projectDescription ?? "");
    const userMessage = String(body.userMessage ?? "").trim();
    const latestAiQuestion = String(body.latestAiQuestion ?? "").trim();
    const nowIso = new Date().toISOString();
    const currentInterviewState = coerceInterviewState(body.currentInterviewState, nowIso);

    if (!userMessage) {
      return NextResponse.json({ success: false, message: "userMessage가 필요합니다." }, { status: 400 });
    }

    if (projectId) {
      try {
        await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/requirements/interview-analyze");
      } catch (error) {
        const denied = rbacErrorResponse(error);
        if (denied) return denied;
        throw error;
      }
    }

    const result = await runInterviewAnalyzeOpenAI({
      projectName,
      projectDescription,
      userMessage,
      latestAiQuestion,
      currentInterviewState,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, code: result.code, message: result.message },
        { status: result.code === "NO_KEY" ? 503 : 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.payload,
      meta: { model: result.model },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST /api/requirements/interview-analyze error:", error);
    return NextResponse.json({ success: false, message: "인터뷰 분석 중 오류가 발생했습니다." }, { status: 500 });
  }
}
