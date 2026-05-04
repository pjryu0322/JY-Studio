import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { appendReviewMessage, getReviewThread, setImprovementItems } from "@/lib/prototype/prototypeReviewStore";
import { workspaceAiMemberSystemPrefix } from "@/lib/ai-member/platformAiMembers";
import { formatRunContext, formatReviewTranscript, openAiTextCompletion } from "@/lib/prototype/prototypeReviewOpenAi";
import { getRun } from "@/lib/prototype/prototypeRunStore";

/** 정리요청: 검토 대화를 전담 AI가 한 덩어리로 요약 */
export async function POST(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  let body: { projectId?: string; runId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const projectId = String(body.projectId ?? "").trim();
  const runId = String(body.runId ?? "").trim();
  if (!projectId || !runId) {
    return NextResponse.json({ success: false, message: "projectId와 runId가 필요합니다." }, { status: 400 });
  }

  try {
    await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/prototype-review/summarize");
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    throw error;
  }

  const prior = getReviewThread(projectId, runId);
  if (!prior.length) {
    return NextResponse.json({ success: false, message: "요약할 대화가 없습니다. 먼저 검토 내용을 입력해 주세요." }, { status: 400 });
  }

  appendReviewMessage(projectId, runId, "user", "[정리요청] 지금까지의 검토 내용을 전담 AI 관점에서 짧게 묶어 주세요.");
  const messages = getReviewThread(projectId, runId);
  const run = getRun(projectId, runId);

  const system = `${workspaceAiMemberSystemPrefix("prototype_review")}프로토타입 검토 대화를 사용자가 보기 좋게 요약한다.
출력: 한국어, 불릿 3~7개(각 1문장 이내), 마지막에 다음 액션 1문장. 마크다운 과용 금지.`;

  const userPayload = `[실행 맥락]
${formatRunContext(run)}

[대화 전체]
${formatReviewTranscript(messages)}`;

  const ai = await openAiTextCompletion(system, userPayload);
  if (!ai.ok) {
    return NextResponse.json({ success: false, message: ai.message, code: "OPENAI_ERROR" }, { status: 200 });
  }

  appendReviewMessage(projectId, runId, "planner", `【정리 요약】\n${ai.text}`);
  setImprovementItems(projectId, runId, []);
  return NextResponse.json({
    success: true,
    data: { messages: getReviewThread(projectId, runId), improvementItems: null },
  });
}
