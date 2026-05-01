import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { appendReviewMessage, getReviewThread, setImprovementItems } from "@/lib/prototype/prototypeReviewStore";
import { formatRunContext, formatReviewTranscript, openAiTextCompletion } from "@/lib/prototype/prototypeReviewOpenAi";
import { getRun } from "@/lib/prototype/prototypeRunStore";

export async function POST(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  let body: { projectId?: string; runId?: string; userMessage?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const projectId = String(body.projectId ?? "").trim();
  const runId = String(body.runId ?? "").trim();
  const userMessage = String(body.userMessage ?? "").trim();
  if (!projectId || !runId || !userMessage) {
    return NextResponse.json({ success: false, message: "projectId, runId, userMessage가 필요합니다." }, { status: 400 });
  }

  try {
    await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/prototype-review/chat-turn");
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    throw error;
  }

  appendReviewMessage(projectId, runId, "user", userMessage);
  const messages = getReviewThread(projectId, runId);
  const run = getRun(projectId, runId);

  const system = `당신은 JYOrchestration의 "AI기획자" 역할이다.
화면: 프로토타입 검토. 사용자·전문가가 프리뷰 결과를 보며 개선점을 논의한다.
규칙:
- 한국어, 존댓말, 2~6문장으로 간결히.
- 실행 파이프라인·Cursor·GitHub·배포 자동화 지시는 하지 않는다(이 화면 범위 밖).
- 개선 방향·확인 질문·우선순위 제안에 집중한다.
- "AI 에이전트", "리뷰어" 같은 영어식 호칭 대신 반드시 "AI기획자" 또는 "저는"으로 표현한다.`;

  const userPayload = `[프로토타입 실행 맥락]
${formatRunContext(run)}

[지금까지 대화]
${formatReviewTranscript(messages)}

위 맥락에서 마지막 사용자 메시지에 답한다.`;

  const ai = await openAiTextCompletion(system, userPayload);
  if (!ai.ok) {
    return NextResponse.json({ success: false, message: ai.message, code: "OPENAI_ERROR" }, { status: 200 });
  }

  const plannerMsg = appendReviewMessage(projectId, runId, "planner", ai.text);
  /** 대화가 바뀌면 이전 JSON 개선안은 맥락과 어긋나므로 비움 — 「개선안 다시 받기」로 재생성 */
  setImprovementItems(projectId, runId, []);
  return NextResponse.json({
    success: true,
    data: {
      messages: getReviewThread(projectId, runId),
      improvementItems: null,
      lastPlannerId: plannerMsg.id,
    },
  });
}
