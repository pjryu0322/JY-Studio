import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  runRequirementsFacilitatorOpenAI,
  runRequirementsIdeationInterviewBootstrapOpenAI,
  runRequirementsIdeationInterviewSeedFromProjectOpenAI,
  type RequirementsAiResponseStyle,
} from "@/lib/project/requirementsAiFacilitatorOpenAI";
import { isPromptTimelineDebugServer, runWithPromptTimelineProject } from "@/lib/debug/promptTimelineDebug";
import { recordIdeationBootstrapOpenAi } from "@/lib/debug/promptTimelineStore";

type Body = {
  projectId?: string;
  projectName?: string;
  projectDescription?: string;
  stage?: string;
  userMessage?: string;
  dialogueExcerpt?: string;
  aiResponseStyle?: string;
  /** 질문 대상 멤버 id·이름 */
  targets?: Array<{ id?: string; name?: string }>;
  /** 발신자 */
  sender?: { id?: string; name?: string };
  /** 답글(스레드)용: 어떤 메시지에 대한 reply인지 */
  replyTo?: string | null;
  /** 대화 비어 있을 때 인터뷰 첫 질문만 생성(별도 시스템 프롬프트) */
  bootstrapInterview?: boolean;
  /** 직전 화면 전환 시 클라이언트가 1회 전달하는 맥락 */
  priorScreenHandoff?: string;
  /** 클라이언트 Harness 메타(서버 로직 미연동 시 무시) */
  serviceDesignStage?: string;
  mentionedAI?: string | null;
};

function parseAiResponseStyle(raw: unknown): RequirementsAiResponseStyle | undefined {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "brief" || s === "detailed" || s === "standard") return s;
  return undefined;
}

/**
 * 요구사항 협의실: 아이디어 구체화 전담 AI 응답(OpenAI). projectId가 있으면 프로젝트 조회 권한 필요.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    const body = (await request.json()) as Body;
    const bootstrapInterview = Boolean(body.bootstrapInterview);
    const projectId = String(body.projectId ?? "").trim();
    const projectName = String(body.projectName ?? "").trim();
    const projectDescription = String(body.projectDescription ?? "");
    const stageRaw = String(body.stage ?? "requirements").trim().toLowerCase();
    const userMessage = String(body.userMessage ?? "").trim();
    const dialogueExcerpt = String(body.dialogueExcerpt ?? "");
    const priorScreenHandoff = String(body.priorScreenHandoff ?? "").trim();
    const responseStyle = parseAiResponseStyle(body.aiResponseStyle);
    const targetsRaw = Array.isArray(body.targets) ? body.targets : [];
    const mentionTargetsSummary = targetsRaw
      .map((t) => {
        const id = String(t?.id ?? "").trim();
        const name = String(t?.name ?? "").trim();
        if (!id && !name) return "";
        return name ? `- ${name}${id ? ` (${id})` : ""}` : `- ${id}`;
      })
      .filter(Boolean)
      .join("\n");
    const sender = body.sender && typeof body.sender === "object" ? body.sender : null;
    const senderSummary =
      sender && (String(sender.name ?? "").trim() || String(sender.id ?? "").trim())
        ? `${String(sender.name ?? "").trim() || "발신"}${String(sender.id ?? "").trim() ? ` · ${String(sender.id).trim()}` : ""}`
        : "";

    if (!bootstrapInterview && !userMessage) {
      return NextResponse.json({ success: false, message: "userMessage가 필요합니다." }, { status: 400 });
    }

    if (bootstrapInterview && !projectId) {
      return NextResponse.json(
        { success: false, message: "인터뷰 자동 시작에는 projectId가 필요합니다." },
        { status: 400 }
      );
    }

    if (projectId) {
      try {
        await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/requirements/ai-facilitator");
      } catch (error) {
        const denied = rbacErrorResponse(error);
        if (denied) {
          return denied;
        }
        throw error;
      }
    }

    const stage = stageRaw === "requirements" ? "requirements" : "requirements";
    const result = bootstrapInterview
      ? await runWithPromptTimelineProject(projectId, async () =>
          runRequirementsIdeationInterviewBootstrapOpenAI({
            projectName,
            projectDescription,
          })
        )
      : await runRequirementsFacilitatorOpenAI({
          projectName,
          projectDescription,
          stage,
          userMessage,
          dialogueExcerpt,
          responseStyle,
          mentionTargetsSummary: mentionTargetsSummary || undefined,
          senderSummary: senderSummary || undefined,
          priorScreenHandoff: priorScreenHandoff || undefined,
        });
    if (!result.ok) {
      if (bootstrapInterview && isPromptTimelineDebugServer() && projectId) {
        recordIdeationBootstrapOpenAi({
          projectId,
          model: null,
          ok: false,
          error: `${result.code}: ${result.message}`,
          fallbackText: "무엇을 만들고 싶은가?",
        });
      }
      if (bootstrapInterview && result.code === "NO_KEY") {
        return NextResponse.json(
          { success: false, code: "NO_AI_PROVIDER", message: "AI 기획자 호출에 필요한 OpenAI 설정이 없습니다." },
          { status: 503 }
        );
      }
      return NextResponse.json({
        success: false,
        code: result.code,
        message: result.message,
      });
    }
    const replyTrim = String(result.text ?? "").trim();
    if (bootstrapInterview && !replyTrim) {
      if (bootstrapInterview && isPromptTimelineDebugServer() && projectId) {
        recordIdeationBootstrapOpenAi({
          projectId,
          model: result.model ?? null,
          promptText: result.promptText,
          ok: false,
          error: "EMPTY_REPLY",
          fallbackText: "무엇을 만들고 싶은가?",
        });
      }
      return NextResponse.json({ success: false, code: "EMPTY_REPLY", message: "bootstrapInterview 응답이 비어 있습니다." }, { status: 502 });
    }

    const seed = bootstrapInterview
      ? await runRequirementsIdeationInterviewSeedFromProjectOpenAI({
          projectName,
          projectDescription,
        })
      : null;

    if (bootstrapInterview && isPromptTimelineDebugServer() && projectId) {
      recordIdeationBootstrapOpenAi({
        projectId,
        model: result.model ?? null,
        promptText: result.promptText,
        ok: true,
        replyText: replyTrim,
        at: result.calledAt,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        reply: replyTrim,
        ...(bootstrapInterview
          ? {
              promptText: result.promptText ?? "",
              model: result.model,
              provider: result.provider ?? "openai",
              calledAt: result.calledAt ?? new Date().toISOString(),
            }
          : {}),
        seedInterviewState: seed && seed.ok ? seed.wire : null,
      },
    });
  } catch (error) {
    console.error("POST /api/requirements/ai-facilitator error:", error);
    return NextResponse.json(
      { success: false, message: "AI 응답 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
