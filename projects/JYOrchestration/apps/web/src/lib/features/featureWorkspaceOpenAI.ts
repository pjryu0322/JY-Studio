import { stripJsonMarkdownFences } from "@/lib/requirements/ideationDeliverables";

const DEFAULT_MODEL = "gpt-4o-mini";

export type FeatureAnalyzeSuggestedFeatureWire = Readonly<{
  title: string;
  detail?: string;
  priority?: string;
  reason?: string;
}>;

export type FeatureAnalyzeStageWire = Readonly<{
  stageKey: string;
  title: string;
  actorMappings?: readonly string[];
  suggestedFeatures?: readonly FeatureAnalyzeSuggestedFeatureWire[];
  questions?: readonly string[];
}>;

export type FeatureAnalyzeOpenAiResult =
  | { ok: true; stages: FeatureAnalyzeStageWire[]; model: string }
  | { ok: false; code: string; message: string };

function parseAnalyzeStagesRoot(raw: unknown): FeatureAnalyzeStageWire[] {
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  const arr = Array.isArray(o.stages) ? o.stages : null;
  if (!arr) return [];
  const out: FeatureAnalyzeStageWire[] = [];
  for (const row of arr) {
    if (!row || typeof row !== "object") continue;
    const s = row as Record<string, unknown>;
    const stageKey = typeof s.stageKey === "string" ? s.stageKey.trim().slice(0, 128) : "";
    const title = typeof s.title === "string" ? s.title.trim().slice(0, 500) : "";
    if (!stageKey || !title) continue;
    const actorMappings = Array.isArray(s.actorMappings)
      ? s.actorMappings.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 48)
      : undefined;
    const questions = Array.isArray(s.questions)
      ? s.questions.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 24)
      : undefined;
    const sfRaw = Array.isArray(s.suggestedFeatures) ? s.suggestedFeatures : [];
    const suggestedFeatures: FeatureAnalyzeSuggestedFeatureWire[] = [];
    for (const fr of sfRaw) {
      if (!fr || typeof fr !== "object") continue;
      const f = fr as Record<string, unknown>;
      const t = typeof f.title === "string" ? f.title.trim().slice(0, 500) : "";
      if (!t) continue;
      const detail = typeof f.detail === "string" ? f.detail.trim().slice(0, 8000) : undefined;
      const priority = typeof f.priority === "string" ? f.priority.trim().slice(0, 32) : undefined;
      const reason = typeof f.reason === "string" ? f.reason.trim().slice(0, 2000) : undefined;
      suggestedFeatures.push({ title: t, detail, priority, reason });
      if (suggestedFeatures.length >= 12) break;
    }
    out.push({
      stageKey,
      title,
      ...(actorMappings?.length ? { actorMappings } : {}),
      ...(questions?.length ? { questions } : {}),
      ...(suggestedFeatures.length ? { suggestedFeatures } : {}),
    });
  }
  return out;
}

export async function runFeatureWorkspaceAnalyzeOpenAI(input: {
  projectTitle: string;
  projectDescription: string;
  serviceFlowJson: string;
  actorWorkspaceJson?: string;
  existingFeatureSummary?: string;
}): Promise<FeatureAnalyzeOpenAiResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };
  }
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  const actorBlock = (input.actorWorkspaceJson ?? "").trim().slice(0, 16_000);
  const existing = (input.existingFeatureSummary ?? "").trim().slice(0, 8000);

  const system = `You are a senior product architect for Korean enterprise software projects.
You analyze approved service-flow steps and actors, then propose concrete software features per step.
Output ONLY valid JSON. No markdown fences. Language for user-facing strings: Korean.`;

  const user = `[프로젝트]
이름: ${input.projectTitle || "(없음)"}
설명: ${input.projectDescription || "(없음)"}

[승인된 서비스 흐름 JSON — steps/actors/primary mappings 포함]
${input.serviceFlowJson.slice(0, 28_000)}

${actorBlock ? `[액터 워크스페이스 보조 JSON]\n${actorBlock}\n` : ""}
${existing ? `[기능 워크스페이스 기존 요약]\n${existing}\n` : ""}

[작업]
1) JSON 루트에 "stages" 배열만 둔다.
2) 각 원소는 승인된 서비스 흐름 단계와 1:1로 대응해야 한다. stageKey는 반드시 해당 step의 "id"와 동일하게 쓴다.
3) title은 해당 단계 제목과 동일하거나 짧게 정규화한다.
4) actorMappings: 이 단계에 관련된 액터 표시명 문자열 배열(주담당·부담당 반영).
5) suggestedFeatures: 이 단계에서 구현할 기능 후보(제목·상세·우선순위·근거). 우선순위 문자열은 HIGH|MEDIUM|LOW 중 하나.
6) questions: 참여자·AI기획자가 합의해야 할 확인 질문 1~4개(짧게).

[출력 스키마]
{"stages":[{"stageKey":"…","title":"…","actorMappings":["…"],"suggestedFeatures":[{"title":"…","detail":"…","priority":"HIGH|MEDIUM|LOW","reason":"…"}],"questions":["…"]}]}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
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
    return {
      ok: false,
      code: `HTTP_${res.status}`,
      message: `OpenAI API 오류(HTTP ${res.status}): ${errText.slice(0, 400)}`,
    };
  }

  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = String(body?.choices?.[0]?.message?.content ?? "").trim();
  if (!text) return { ok: false, code: "EMPTY", message: "OpenAI 응답 본문이 비어 있습니다." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonMarkdownFences(text)) as unknown;
  } catch {
    return { ok: false, code: "JSON_PARSE", message: "OpenAI JSON 파싱에 실패했습니다." };
  }

  const stages = parseAnalyzeStagesRoot(parsed);
  if (!stages.length) return { ok: false, code: "SCHEMA", message: "분석 결과 stages가 비어 있습니다." };

  return { ok: true, stages, model };
}

export type FeaturePlannerTurnOpenAiResult =
  | { ok: true; text: string; model: string }
  | { ok: false; code: string; message: string };

export async function runFeaturePlannerTurnOpenAI(input: {
  projectTitle: string;
  projectDescription: string;
  serviceFlowExcerpt: string;
  selectedStageTitle: string;
  selectedStageFeaturesSummary: string;
  plannerQuestionsQueue: string;
  chatTail: string;
  userMessage: string;
}): Promise<FeaturePlannerTurnOpenAiResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };
  }
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;

  const system = `You are the "AI 기획자" in a Korean product workspace for feature definition.
You lead clarification with exactly one focused follow-up question when ambiguity remains; otherwise summarize decisions briefly.
Rules:
- Korean, conversational tone, no markdown headings.
- Prefer 2~6 short lines; if you ask a question, ask only ONE clear question.
- Reference actors/service flow only when it helps.`;

  const user = `[프로젝트] ${input.projectTitle || "(이름 없음)"}
[설명] ${input.projectDescription || "(없음)"}

[서비스 흐름 요약]
${input.serviceFlowExcerpt.slice(0, 12_000)}

[현재 단계] ${input.selectedStageTitle}
[이 단계 기능 목록 요약]
${input.selectedStageFeaturesSummary || "(없음)"}

[남은 확인 질문 큐]
${input.plannerQuestionsQueue || "(비어 있음)"}

[최근 대화]
${input.chatTail.slice(0, 8000)}

[사용자 방금 입력]
${input.userMessage}

위 맥락에 맞게 답하세요.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return {
      ok: false,
      code: `HTTP_${res.status}`,
      message: `OpenAI API 오류(HTTP ${res.status}): ${errText.slice(0, 400)}`,
    };
  }

  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = String(body?.choices?.[0]?.message?.content ?? "").trim().slice(0, 12_000);
  if (!text) return { ok: false, code: "EMPTY", message: "OpenAI 응답 본문이 비어 있습니다." };

  return { ok: true, text, model };
}
