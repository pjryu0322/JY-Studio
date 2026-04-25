import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";

const DEFAULT_MODEL = "gpt-4o-mini";

export type ActorFlowCompletion = {
  actorsReady: boolean;
  flowsReady: boolean;
  mappingReady: boolean;
  readyForNext: boolean;
  score: number;
};

export type ActorFlowAnalyzeResult =
  | {
      ok: true;
      model: string;
      updatedFlow: RequirementsServiceFlowV1;
      aiReply: string;
      nextQuestion: string;
      openQuestions: string[];
      completion: ActorFlowCompletion;
    }
  | { ok: false; code: string; message: string };

function clampScore(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function safeText(v: unknown, max = 400): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function safeStringArray(v: unknown, max = 6): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const s = safeText(x, 160);
    if (!s) continue;
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function ensureFlowShape(v: unknown, nowIso: string): RequirementsServiceFlowV1 | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const actorsRaw = Array.isArray(o.actors) ? o.actors : [];
  const stepsRaw = Array.isArray(o.steps) ? o.steps : [];
  const actors = actorsRaw
    .map((a) => {
      const aa = a as Record<string, unknown>;
      const id = safeText(aa.id, 80);
      const name = safeText(aa.name, 60);
      const kind = safeText(aa.kind, 16) === "system" ? "system" : "human";
      const description = safeText(aa.description, 120);
      if (!id || !name) return null;
      return { id, name, kind, description };
    })
    .filter(Boolean) as RequirementsServiceFlowV1["actors"];

  const actorIds = new Set(actors.map((a) => a.id));
  const steps = stepsRaw
    .map((s) => {
      const ss = s as Record<string, unknown>;
      const id = safeText(ss.id, 120);
      const title = safeText(ss.title, 80);
      const purpose = safeText(ss.purpose, 200);
      const order = Number(ss.order);
      const primaryActorId = safeText(ss.primaryActorId, 80);
      const secondaryActorIds = safeStringArray(ss.secondaryActorIds, 6).map((x) => safeText(x, 80));
      const approved = Boolean(ss.approved);
      const updatedAt = safeText(ss.updatedAt, 40) || nowIso;
      if (!id || !title || !Number.isFinite(order)) return null;
      return {
        id,
        title,
        purpose,
        order: Math.max(1, Math.round(order)),
        primaryActorId: primaryActorId && actorIds.has(primaryActorId) ? primaryActorId : "",
        secondaryActorIds: secondaryActorIds.filter((x) => actorIds.has(x)),
        approved,
        updatedAt,
      };
    })
    .filter(Boolean) as RequirementsServiceFlowV1["steps"];

  return {
    createdAt: safeText(o.createdAt, 40) || nowIso,
    updatedAt: safeText(o.updatedAt, 40) || nowIso,
    actors,
    steps,
  };
}

/**
 * Actor/Flow stage analyzer (LLM-first).
 * Primary: OpenAI semantic reasoning. No keyword engine in main path.
 */
export async function runActorFlowAnalyzeOpenAI(input: {
  projectName: string;
  projectDescription: string;
  userMessage: string;
  latestAiQuestion: string;
  currentFlow: RequirementsServiceFlowV1 | null;
}): Promise<ActorFlowAnalyzeResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };
  }

  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  const nowIso = new Date().toISOString();
  const flowJson = JSON.stringify(input.currentFlow ?? { createdAt: nowIso, updatedAt: nowIso, actors: [], steps: [] }).slice(0, 22_000);

  const system = `당신은 "액터 및 서비스 흐름 정의" 단계 전용 분석기이자 진행자입니다.
역할:
1) 사용자의 최신 발화 의미를 해석해 액터/흐름/담당 매핑 상태를 업데이트한다.
2) 업데이트 내용을 사용자가 이해하는 짧은 문장으로 보고한다.
3) 다음으로 필요한 확인 질문을 정확히 1개만 만든다.

중요:
- 키워드 매칭이 아니라 의미 기반으로 판단한다.
- 내부적으로 다양한 페르소나(planner/service_designer 등)를 사용해도, UI 상 답변자는 항상 "AI 기획자"로 보인다.
- 출력은 반드시 JSON 1개(설명/마크다운/코드펜스 금지).

편집 원칙:
- actors는 최소 2명 이상이 되도록 채우고(필요 시 사용자/관리자/시스템을 추론), 중복 이름을 만들지 말 것.
- steps(서비스 흐름)는 최소 3단계 이상이 되도록 채우고, order는 1..N 연속으로 정렬한다.
- 각 step은 owner(primaryActorId) 1명을 갖는다(없으면 가장 그럴듯한 actor를 지정).
- 사용자가 "알아서/추천/네가 구성" 같은 위임을 하면, 현실적인 기본 초안을 보강해 완성도를 높인다.

응답 스타일:
- aiReply는 최대 2~3줄, '무엇을 반영했는지'만 짧게.
- nextQuestion은 물음표 1개만 포함한 질문 1문장.

JSON 스키마(키 이름 고정):
{
  "updatedFlow": { "createdAt": "...", "updatedAt": "...", "actors": [...], "steps": [...] },
  "aiReply": "짧은 반영 보고",
  "nextQuestion": "다음 질문 1문장?",
  "openQuestions": ["열린 질문1", "열린 질문2"],
  "completion": { "actorsReady": true, "flowsReady": true, "mappingReady": true, "readyForNext": true, "score": 0 }
}
actors item:
{ "id": "actor:...", "name": "액터명", "kind": "human|system", "description": "한줄" }
steps item:
{ "id": "step:...", "order": 1, "title": "단계명", "purpose": "한줄", "primaryActorId": "actor:...", "secondaryActorIds": [], "approved": false, "updatedAt": "..." }`;

  const user = `[프로젝트]
이름: ${input.projectName.trim() || "(이름 없음)"}
설명: ${input.projectDescription.trim() || "(설명 없음)"}

[직전 AI 질문(맥락)]
${input.latestAiQuestion.trim() || "(없음)"}

[현재 상태 JSON]
${flowJson}

[사용자 최신 발화]
${input.userMessage.trim()}`;

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
  const root = parsed as Record<string, unknown>;
  const updatedFlow = ensureFlowShape(root.updatedFlow, nowIso);
  if (!updatedFlow) return { ok: false, code: "SCHEMA", message: "updatedFlow 스키마가 올바르지 않습니다." };

  const completionRaw = (root.completion ?? {}) as Record<string, unknown>;
  const completion: ActorFlowCompletion = {
    actorsReady: Boolean(completionRaw.actorsReady),
    flowsReady: Boolean(completionRaw.flowsReady),
    mappingReady: Boolean(completionRaw.mappingReady),
    readyForNext: Boolean(completionRaw.readyForNext),
    score: clampScore(completionRaw.score),
  };

  return {
    ok: true,
    model,
    updatedFlow,
    aiReply: safeText(root.aiReply, 320) || "반영했습니다.",
    nextQuestion: safeText(root.nextQuestion, 220) || "추가로 확인할 점이 있을까요?",
    openQuestions: safeStringArray(root.openQuestions, 6),
    completion,
  };
}

