import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { workspaceAiMemberSystemPrefix } from "@/lib/ai-member/platformAiMembers";

type Body = {
  projectId?: string;
  projectName?: string;
  projectDescription?: string;
  templateName?: string;
  slots?: Array<{ key: string; title: string; question: string; required: boolean }>;
  answers?: Record<string, string>;
  currentSlotKey?: string | null;
  userMessage?: string;
  envOk?: boolean;
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
      await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/prototype-chat/turn");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { success: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." },
        { status: 200 },
      );
    }

    const projectName = String(body.projectName ?? "").trim();
    const projectDescription = String(body.projectDescription ?? "").trim();
    const templateName = String(body.templateName ?? "").trim();
    const userMessage = String(body.userMessage ?? "").trim();
    const slots = Array.isArray(body.slots) ? body.slots : [];
    const answers = body.answers && typeof body.answers === "object" ? body.answers : {};
    const currentSlotKey = body.currentSlotKey == null ? null : String(body.currentSlotKey).trim() || null;
    const envOk = Boolean(body.envOk);

    if (!userMessage) {
      return NextResponse.json({ success: false, message: "userMessage가 필요합니다." }, { status: 400 });
    }

    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
    const system = `${workspaceAiMemberSystemPrefix("prototype_build")}화면: 프로토타입 생성.
목표: 사용자 입력을 해석해 이 화면 범위 안에서만 가이드를 제공하고, 슬롯 기반 인터뷰를 1턴씩 진행한다.
규칙:
- 한국어로 답한다.
- 이번 턴 응답은 JSON 1개만 출력한다(마크다운/코드펜스/설명 금지).
- assistantMessage는 1~4문장, 장황한 설명 금지.
- nextQuestion은 필요한 경우에만 1문장 질문(물음표 1개)로 제공하고, 없으면 null.
- outOfScope=true면, 사용자의 요청을 거절하지 말고 "프로토타입 생성 화면에서 지금 할 수 있는 것"으로 재유도한 뒤, 슬롯 질문 1개로 좁힌다.

[프로토타입 생성 범위]
- 템플릿 선택, 목표 사용자/역할, 핵심 화면/흐름, 데이터/연동, 로그인/권한, 제외 범위, 성공 기준, 배포 확인 수준
- 코드 구현/DB 상세/API 스펙 확정/배포 인프라 설계는 다음 단계(WorkUnit/실행)로 미룬다.`;

    const slotsText = JSON.stringify(slots).slice(0, 12_000);
    const answersText = JSON.stringify(answers).slice(0, 12_000);
    const user = `프로젝트: ${projectName || "(이름 없음)"}
설명: ${projectDescription || "(설명 없음)"}
템플릿: ${templateName || "(미정)"}
환경준비(envOk): ${envOk ? "yes" : "no"}

[슬롯 정의]
${slotsText || "[]"}

[현재까지 답변]
${answersText || "{}"}

[현재 질문 슬롯 key]
${currentSlotKey || "(없음)"}

[사용자 메시지]
${userMessage}

출력 JSON 스키마:
{
  "assistantMessage": "전담 AI 답변",
  "outOfScope": true|false,
  "slotKeyToFill": "slot_key" | null,
  "slotValue": "해당 슬롯에 저장할 요약 텍스트" | null,
  "nextSlotKey": "slot_key" | null,
  "nextQuestion": "질문 한 문장?" | null
}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.25,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        { success: false, code: `HTTP_${res.status}`, message: errText.slice(0, 500) || `HTTP ${res.status}` },
        { status: 200 },
      );
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) return NextResponse.json({ success: false, code: "EMPTY", message: "AI 응답 본문이 비어 있습니다." }, { status: 200 });

    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      return NextResponse.json({ success: false, code: "PARSE", message: "AI JSON 파싱에 실패했습니다." }, { status: 200 });
    }

    const root = parsed as Record<string, unknown>;
    const assistantMessage = String(root.assistantMessage ?? "").trim();
    const outOfScope = Boolean(root.outOfScope);
    const slotKeyToFill = String(root.slotKeyToFill ?? "").trim() || null;
    const slotValue = String(root.slotValue ?? "").trim() || null;
    const nextSlotKey = String(root.nextSlotKey ?? "").trim() || null;
    const nextQuestion = String(root.nextQuestion ?? "").trim() || null;

    if (!assistantMessage) {
      return NextResponse.json({ success: false, code: "SCHEMA", message: "assistantMessage가 비어 있습니다." }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      data: { assistantMessage, outOfScope, slotKeyToFill, slotValue, nextSlotKey, nextQuestion, model },
    });
  } catch (error) {
    console.error("POST /api/prototype-chat/turn error:", error);
    return NextResponse.json({ success: false, message: "AI 응답 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}

