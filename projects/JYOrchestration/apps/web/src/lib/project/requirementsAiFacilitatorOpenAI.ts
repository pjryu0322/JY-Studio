const DEFAULT_MODEL = "gpt-4o-mini";

export type RequirementsFacilitatorOpenAiResult =
  | { ok: true; text: string; model: string }
  | { ok: false; code: string; message: string };

export type RequirementsDraftOpenAiResult =
  | {
      ok: true;
      draft: {
        overview: string;
        goals: string[];
        users: string[];
        features: string[];
        excluded: string[];
        nonFunctional: string[];
        successCriteria: string[];
        openIssues: string[];
      };
      model: string;
    }
  | { ok: false; code: string; message: string };

/**
 * 요구사항 협의실용 OpenAI 호출(서버 전용). OPENAI_MODEL 미설정 시 gpt-4o-mini.
 */
export async function runRequirementsFacilitatorOpenAI(input: {
  projectName: string;
  projectDescription: string;
  stage: "requirements";
  userMessage: string;
  dialogueExcerpt: string;
}): Promise<RequirementsFacilitatorOpenAiResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };
  }

  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  const excerpt = input.dialogueExcerpt.trim().slice(0, 24_000);
  const projectName = input.projectName.trim();
  const projectDescription = input.projectDescription.trim();

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content: `당신은 소프트웨어 프로젝트의 요구사항 정리를 돕는 AI 기획자입니다.
역할: 범위·모호함·누락·역할·기능/비기능 요구를 짧게 질문하고, 확인 가능한 요구사항으로 수렴시키세요.
규칙:
- 한국어로 답합니다.
- 1회 응답은 8문장 이내, 불필요한 서론·마크다운 제목 없이 대화체로 작성합니다.
- 사용자가 특정 참가자에게 질문한 맥락이 있으면 그에 맞춰 답합니다.`,
        },
        {
          role: "user",
          content: `다음 정보를 알고 있다고 가정하고 답하세요. "어떤 프로젝트인가요?"처럼 프로젝트를 모르는 질문은 금지합니다.

[프로젝트]
- 이름: ${projectName || "(이름 없음)"}
- 설명: ${projectDescription || "(설명 없음)"}

[현재 단계]
- Requirements(요구사항)

[최근 대화 발췌]
${excerpt || "(이전 메시지 없음)"}

[이번 사용자 메시지]
${input.userMessage.trim()}`,
        },
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

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) {
    return { ok: false, code: "EMPTY", message: "OpenAI 응답 본문이 비어 있습니다." };
  }

  return { ok: true, text, model };
}

function safeJsonArray(v: unknown, max = 12): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const s = String(x ?? "").trim();
    if (!s) continue;
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

export async function runRequirementsDraftOpenAI(input: {
  projectName: string;
  projectDescription: string;
  stage: "requirements";
  dialogueExcerpt: string;
  userMessage: string;
  existingDraft?: unknown;
}): Promise<RequirementsDraftOpenAiResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };
  }
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  const excerpt = input.dialogueExcerpt.trim().slice(0, 24_000);
  const existingDraftText = input.existingDraft ? JSON.stringify(input.existingDraft).slice(0, 12_000) : "";

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
        {
          role: "system",
          content:
            "You are a senior product manager. Output only a valid JSON object. No markdown fences. Keep strings concise and actionable.",
        },
        {
          role: "user",
          content: `다음 프로젝트 요구사항 협의 대화를 바탕으로 구조화된 요구사항 초안 JSON을 생성해라.

[프로젝트]
- 이름: ${input.projectName.trim() || "(이름 없음)"}
- 설명: ${input.projectDescription.trim() || "(설명 없음)"}

[현재 단계]
- Requirements(요구사항)

[최근 대화 발췌]
${excerpt || "(이전 메시지 없음)"}

[기존 정리본(있다면)]
${existingDraftText || "(없음)"}

[사용자 최신 요청]
${input.userMessage.trim()}

[출력 JSON 스키마 - 키를 정확히 맞춰라]
{
  "overview": "프로젝트 개요(1~3문장)",
  "goals": ["목표1", ...],
  "users": ["대상 사용자/역할1", ...],
  "features": ["핵심 기능1", ...],
  "excluded": ["제외 범위1", ...],
  "nonFunctional": ["비기능 요구사항1", ...],
  "successCriteria": ["성공 기준1", ...],
  "openIssues": ["미결정 이슈1", ...]
}

[규칙]
- overview/users/features/successCriteria는 비어있지 않게(최소 1개 이상) 추론해 채워라.
- 근거가 약하면 openIssues에 '확인 필요'로 남겨라.
- 한국어로 작성.`,
        },
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

  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) {
    return { ok: false, code: "EMPTY", message: "OpenAI 응답 본문이 비어 있습니다." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, code: "JSON_PARSE", message: "OpenAI JSON 파싱에 실패했습니다." };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, code: "SCHEMA", message: "OpenAI 응답 스키마가 올바르지 않습니다." };
  }
  const o = parsed as Record<string, unknown>;
  const draft = {
    overview: String(o.overview ?? "").trim(),
    goals: safeJsonArray(o.goals),
    users: safeJsonArray(o.users),
    features: safeJsonArray(o.features),
    excluded: safeJsonArray(o.excluded),
    nonFunctional: safeJsonArray(o.nonFunctional),
    successCriteria: safeJsonArray(o.successCriteria),
    openIssues: safeJsonArray(o.openIssues),
  };
  if (!draft.overview || draft.users.length === 0 || draft.features.length === 0 || draft.successCriteria.length === 0) {
    return { ok: false, code: "SCHEMA", message: "초안 필수 항목이 비어 있습니다." };
  }
  return { ok: true, draft, model };
}

export type OpenAiModelsPingResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

/** API 키 유효성·네트워크를 가볍게 확인합니다. */
export async function pingOpenAiModelsList(): Promise<OpenAiModelsPingResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY가 설정되어 있지 않습니다." };
  }
  try {
    const res = await fetch("https://api.openai.com/v1/models?limit=1", {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, code: `HTTP_${res.status}`, message: t.slice(0, 300) || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "NETWORK", message: msg };
  }
}
