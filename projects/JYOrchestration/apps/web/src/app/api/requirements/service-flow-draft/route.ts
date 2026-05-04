import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";

type Body = {
  projectId?: string;
  projectName?: string;
  projectDescription?: string;
  ideationAssets?: Array<{ type?: string; title?: string; content?: string }>;
};

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    const projectName = String(body.projectName ?? "").trim();
    const projectDescription = String(body.projectDescription ?? "").trim();
    const assets = Array.isArray(body.ideationAssets) ? body.ideationAssets : [];
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    try {
      await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/requirements/service-flow-draft");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ success: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." });
    }
    const model = resolveOpenAiModelFromEnv();

    const assetBlock = assets
      .map((a) => {
        const type = String(a?.type ?? "").trim();
        const title = String(a?.title ?? "").trim();
        const content = String(a?.content ?? "").trim();
        if (!content) return "";
        return `- ${type || "산출물"}${title ? `: ${title}` : ""}\n${content.slice(0, 6000)}`;
      })
      .filter(Boolean)
      .join("\n\n");

    const sys = `당신은 소프트웨어 서비스 워크숍을 진행하는 AI 서비스 설계자입니다.
목표: 아이디어 산출물을 바탕으로 액터 및 서비스 흐름 정의 단계의 7개 슬롯을 최대한 채우는 초안을 생성합니다.
규칙:
- 한국어로 작성합니다.
- 사용자가 빈 화면을 직접 작성하지 않도록, 현실적인 초안을 충분히 채웁니다.
- 각 단계는 반드시 "주 담당(primary)" 1명만 갖습니다(공동 주담당 금지).
- 보조(secondary)는 0개 이상 가능합니다.
- 액터는 사람(human) / 시스템(system)으로 구분합니다.
- 사람 액터와 시스템 액터를 모두 포함합니다.
- 아래 7개 슬롯이 채워지도록 작성합니다: humanActors, systemActors, mainFlow, actorResponsibility, exceptionFlow, accessControl, handoffToFeatures.
- 수정 요청, 반려, 재처리 같은 예외 흐름과 열람/수정 권한 범위, 다음 단계 기능 후보를 가능한 한 단계명/목적에 반영합니다.
- reviewPoints에는 아직 부족한 슬롯에 대한 질문만 넣습니다.
- 출력은 반드시 JSON 하나만 반환합니다(설명 문장 금지).`;

    const user = `프로젝트명: ${projectName || "(이름 없음)"}
프로젝트 설명: ${projectDescription || "(설명 없음)"}

[아이디어 구체화 산출물]
${assetBlock || "(산출물 없음)"}

다음 JSON 스키마로만 출력:
{
  "steps": [
    { "title": "예약 신청", "purpose": "사용자가 예약 요청 등록", "primary": "사용자", "secondary": ["시스템"] }
  ],
  "actors": [
    { "name": "사용자", "kind": "human", "description": "서비스를 사용하는 최종 사용자" }
  ],
  "reviewPoints": ["검토 질문 1", "검토 질문 2"]
}

서비스 흐름은 5~8단계로 생성하고, actor name은 단계에서 쓰는 이름과 정확히 일치시켜라.
회의록/녹취/문서 자동화 성격이면 "녹취파일 업로드", "텍스트 변환", "화자 분리", "회의록 초안 생성", "수정 요청", "최종 승인", "공유/배포" 흐름을 우선 고려하라.`;

    const res = await postOpenAiChatCompletion({
      apiKey,
      model,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      temperature: 0.3,
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, message: res.message }, { status: 500 });
    }
    const text = res.text.trim();
    if (!text) {
      return NextResponse.json({ success: false, message: "AI 응답이 비어 있습니다." }, { status: 500 });
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      // In case the model wrapped JSON in code fence
      const stripped = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      parsed = JSON.parse(stripped);
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST /api/requirements/service-flow-draft error:", error);
    return NextResponse.json({ success: false, message: "AI 초안 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}

