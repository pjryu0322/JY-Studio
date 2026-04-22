import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { isIdeationDeliverableType, type IdeationDeliverableType } from "@/lib/requirements/ideationDeliverables";
import { parseOrganizeMemoryFacts } from "@/lib/requirements/requirementsOrganizeContext";
import { getPlannerSlotSchema } from "@/lib/requirements/plannerSlots";

type Body = {
  projectId?: string;
  projectName?: string;
  projectDescription?: string;
  requestedType?: string;
  requiredSlots?: unknown;
  memoryFacts?: unknown;
  rollingSummary?: string;
  recentMessages?: string;
};

type SlotStatus = Record<string, "filled" | "missing">;

type AnalyzeResult =
  | { ok: true; ready: boolean; message: string; questions: string[]; slotStatus: SlotStatus; model: string }
  | { ok: false; code: string; message: string };

function parseRequiredSlots(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const x of raw) {
    const s = String(x ?? "").trim();
    if (!s) continue;
    out.push(s);
    if (out.length >= 12) break;
  }
  return out.length ? out : null;
}

async function runOrganizeAnalyzerOpenAI(input: {
  requestedType: IdeationDeliverableType;
  requiredSlots: readonly string[];
  projectName: string;
  projectDescription: string;
  memoryFactsText: string;
  rollingSummary: string;
  recentMessages: string;
}): Promise<AnalyzeResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
  const slots = [...input.requiredSlots].map((s) => String(s ?? "").trim()).filter(Boolean);
  const context = [
    input.memoryFactsText && `[memory_facts]\n${input.memoryFactsText}`,
    input.rollingSummary && `[saved_summary]\n${input.rollingSummary}`,
    input.recentMessages && `[recent_messages]\n${input.recentMessages}`,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 24_000);

  const system = `You are an expert product planner.
You are running an internal review (Analyzer) before writing a deliverable.
You must output ONLY valid JSON. No markdown fences.`;

  const user = `산출물 유형: ${input.requestedType}
프로젝트명: ${input.projectName || "(이름 없음)"}
프로젝트 설명: ${input.projectDescription || "(설명 없음)"}

아래 컨텍스트를 근거로, 산출물 작성에 필요한 슬롯 충족 여부를 평가하고, 부족하면 가장 가치가 큰 질문을 정확히 1개만 뽑아라.

[필수 슬롯]
${slots.map((s) => `- ${s}`).join("\n")}

[컨텍스트]
${context || "(없음)"}

[출력 JSON 스키마]
{
  "ready": true|false,
  "message": "사용자에게 보여줄 자연스러운 한두 문장(한국어). 가능하면 짧은 핵심 이해 후 질문 1개 맥락만 담을 것.",
  "questions": ["가장 중요한 질문 1개만"],
  "slotStatus": { "슬롯명": "filled"|"missing" }
}

[규칙]
- ready=true면 questions는 빈 배열.
- ready=false면 questions는 정확히 1개(문자열 하나만 담은 배열).
- 질문은 비난하지 말고, 필요한 이유를 과하게 설명하지 말고, 자연스럽게.
- slotStatus는 위 필수 슬롯 키를 모두 포함하라.
- 한국어로 작성.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.15,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return { ok: false, code: `HTTP_${res.status}`, message: `OpenAI API 오류(HTTP ${res.status}): ${errText.slice(0, 400)}` };
  }

  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) return { ok: false, code: "EMPTY", message: "OpenAI 응답 본문이 비어 있습니다." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, code: "JSON_PARSE", message: "OpenAI JSON 파싱에 실패했습니다." };
  }
  if (!parsed || typeof parsed !== "object") return { ok: false, code: "SCHEMA", message: "OpenAI 응답 스키마가 올바르지 않습니다." };
  const o = parsed as Record<string, unknown>;
  const ready = o.ready === true;
  const message = typeof o.message === "string" ? o.message.trim() : "";
  const questions = Array.isArray(o.questions) ? o.questions.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 1) : [];
  const slotStatusRaw = o.slotStatus && typeof o.slotStatus === "object" ? (o.slotStatus as Record<string, unknown>) : null;
  const slotStatus: SlotStatus = {};
  for (const s of slots) {
    const v = slotStatusRaw ? slotStatusRaw[s] : undefined;
    slotStatus[s] = v === "filled" ? "filled" : "missing";
  }

  if (!message) return { ok: false, code: "SCHEMA", message: "Analyzer message가 비어 있습니다." };
  if (ready && questions.length) return { ok: false, code: "SCHEMA", message: "ready=true인데 questions가 비어있지 않습니다." };
  if (!ready && questions.length !== 1) return { ok: false, code: "SCHEMA", message: "ready=false인데 질문이 정확히 1개가 아닙니다." };

  return { ok: true, ready, message, questions, slotStatus, model };
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    const projectName = String(body.projectName ?? "").trim();
    const projectDescription = String(body.projectDescription ?? "");
    const requestedTypeRaw = String(body.requestedType ?? "").trim();
    const rollingSummary = String(body.rollingSummary ?? "").trim();
    const recentMessages = String(body.recentMessages ?? "").trim();
    const memoryFacts = parseOrganizeMemoryFacts(body.memoryFacts);

    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }
    if (!isIdeationDeliverableType(requestedTypeRaw)) {
      return NextResponse.json({ success: false, message: "requestedType이 올바르지 않습니다." }, { status: 400 });
    }
    const requestedType = requestedTypeRaw as IdeationDeliverableType;
    const requiredSlots = parseRequiredSlots(body.requiredSlots) ?? getPlannerSlotSchema(requestedType).requiredSlots;

    try {
      await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/requirements/organize-analyze");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const memoryFactsText = memoryFacts ? JSON.stringify(memoryFacts).slice(0, 8000) : "";
    const result = await runOrganizeAnalyzerOpenAI({
      requestedType,
      requiredSlots,
      projectName,
      projectDescription,
      memoryFactsText,
      rollingSummary,
      recentMessages,
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, code: result.code, message: result.message }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ready: result.ready,
        message: result.message,
        questions: result.questions,
        slotStatus: result.slotStatus,
        model: result.model,
      },
    });
  } catch (error) {
    console.error("POST /api/requirements/organize-analyze error:", error);
    return NextResponse.json({ success: false, message: "분석 중 오류가 발생했습니다." }, { status: 500 });
  }
}

