import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { workspaceAiMemberSystemPrefix } from "@/lib/ai-member/platformAiMembers";
import { extractMentionedAI } from "@/lib/service-design/serviceDesignMentionExtract";
import { runHarness } from "@/lib/service-design/serviceDesignHarnessRuntime";
import type { ServiceDesignStage } from "@/lib/service-design/serviceDesignAiHarness";
import { applyHarnessDefaultsToTurnModel } from "@/lib/service-design/serviceDesignResponsePolicy";

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
  /** Service Design 하네스: 단계 (미전달 시 ideation) */
  serviceDesignStage?: string;
  /** 명시 멘션 AI; 없으면 userMessage 내 `@@token`에서 추출 */
  mentionedAI?: string | null;
};

function parseServiceDesignStage(raw: string | undefined): ServiceDesignStage {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "service-flow" || s === "service_flow") return "service-flow";
  if (s === "feature-planning" || s === "feature_planning") return "feature-planning";
  return "ideation";
}

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

    const serviceDesignStage = parseServiceDesignStage(body.serviceDesignStage);
    const mentionedFromBody =
      body.mentionedAI == null || body.mentionedAI === ""
        ? null
        : String(body.mentionedAI).trim() || null;
    const mentionedAI = mentionedFromBody ?? extractMentionedAI(userMessage);

    const harness = await runHarness({
      input: userMessage,
      stage: serviceDesignStage,
      mentionedAI,
    });

    if (harness.validation === "FORWARD_BLOCK") {
      return NextResponse.json(
        {
          success: false,
          code: "HARNESS_FORWARD_BLOCK",
          message:
            "현재 단계에서는 해당 작업을 바로 수행할 수 없습니다. 필요한 선행 정보를 먼저 정리한 뒤 진행할 수 있습니다.",
          data: {
            responderLabel: harness.responsePolicy.responderLabel,
            harness: {
              intent: harness.intent,
              validation: harness.validation,
              responseMode: harness.responsePolicy.responseMode,
              visibleResponder: harness.routing.visibleResponder,
              finalAuthority: harness.routing.finalAuthority,
              advisors: harness.routing.internalAdvisors,
            },
          },
        },
        { status: 200 },
      );
    }

    const harnessSystemPrefix = `
${harness.responsePolicy.responseContract}

[하네스 실행 컨텍스트]
intent=${harness.intent}
validation=${harness.validation}
responseMode=${harness.responsePolicy.responseMode}
visibleResponder=${harness.responsePolicy.responderLabel}
finalAuthority=${harness.responsePolicy.finalAuthorityLabel}
advisors=${harness.responsePolicy.advisorLabels.join(", ") || "none"}
`.trim();

    const model = resolveOpenAiModelFromEnv();
    const system = `${harnessSystemPrefix}

${workspaceAiMemberSystemPrefix("prototype_build")}화면: 프로토타입 생성.
목표: 사용자 입력을 해석해 이 화면 범위 안에서만 가이드를 제공하고, 슬롯 기반 인터뷰를 1턴씩 진행한다.
규칙:
- 한국어로 답한다.
- 이번 턴 응답은 JSON 1개만 출력한다(마크다운/코드펜스/설명 금지).
- assistantMessage는 1~4문장, 장황한 설명 금지.
- responderLabel은 화면 응답자 표기(한글 라벨)로 채운다.
- advisorSummary는 내부 자문 관점이 있으면 한 줄로 요약하고, 없으면 "내부 자문 없음"으로 둔다.
- finalAuthoritySummary는 현재 단계 Primary 기준 판단을 한 줄로 요약한다.
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
  "responderLabel": "AI 분석가",
  "advisorSummary": "보안 관점에서는 ...",
  "finalAuthoritySummary": "현재 단계 기준으로는 ...",
  "assistantMessage": "최종 사용자 응답",
  "outOfScope": true|false,
  "slotKeyToFill": "slot_key" | null,
  "slotValue": "해당 슬롯에 저장할 요약 텍스트" | null,
  "nextSlotKey": "slot_key" | null,
  "nextQuestion": "질문 한 문장?" | null
}`;

    const res = await postOpenAiChatCompletion({
      apiKey,
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.25,
      responseFormatJsonObject: true,
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, code: res.code, message: res.message.slice(0, 500) || res.code },
        { status: 200 },
      );
    }

    const text = res.text;
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

    const { responderLabel, advisorSummary, finalAuthoritySummary, harnessPayload } = applyHarnessDefaultsToTurnModel(
      root,
      harness
    );

    return NextResponse.json({
      success: true,
      data: {
        assistantMessage,
        responderLabel,
        advisorSummary,
        finalAuthoritySummary,
        harness: harnessPayload,
        outOfScope,
        slotKeyToFill,
        slotValue,
        nextSlotKey,
        nextQuestion,
        model,
      },
    });
  } catch (error) {
    console.error("POST /api/prototype-chat/turn error:", error);
    return NextResponse.json({ success: false, message: "AI 응답 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
