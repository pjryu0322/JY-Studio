import {
  formatListFieldAsBullets,
  normalizeSpecContextFromUnknown,
  type SpecContextGenerateResult,
} from "@/lib/project-spec/specContextTypes";

const DEFAULT_MODEL = "gpt-4o-mini";

function buildUserPrompt(name: string, description: string, projectType: string): string {
  return `다음 프로젝트 메타 정보를 바탕으로 Project Spec 초안 필드를 채워라.

[입력]
- 프로젝트명: ${name}
- 설명: ${description || "(없음)"}
- 유형: ${projectType}

[출력 JSON 스키마 — 키 이름을 정확히 맞출 것]
{
  "coreGoals": "2~5문장, 실행 가능한 핵심 목표",
  "inScope": ["항목1", "항목2", ...],
  "outOfScope": ["명시적으로 제외할 항목1", ...],
  "targetUsers": ["구체적인 사용자/페르소나1", ...],
  "successCriteria": ["측정 가능한 성공 기준1", ...]
}

[규칙]
- 불필요하게 장황하지 말 것. 실무에서 바로 쓸 수 있는 수준.
- inScope / outOfScope는 명확히 구분. 각 배열은 최소 3개, 최대 8개 권장.
- targetUsers는 역할·상황이 드러나게 구체적으로.
- successCriteria는 정성·정량 모두 가능하나 검증 가능하게.
- JSON만 출력. 마크다운 코드펜스나 설명 문장 금지.`;
}

/**
 * OpenAI Chat Completions로 Spec 컨텍스트 초안 생성.
 * OPENAI_API_KEY 미설정 시 에러 throw.
 */
export async function generateSpecContextWithOpenAI(input: {
  name: string;
  description: string;
  projectType: string;
}): Promise<SpecContextGenerateResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_NOT_CONFIGURED");
  }

  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a senior product manager and software architect. You output only valid JSON objects matching the user's schema. No markdown fences.",
        },
        {
          role: "user",
          content: buildUserPrompt(input.name, input.description, input.projectType),
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OPENAI_HTTP_${res.status}:${errText.slice(0, 200)}`);
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("OPENAI_EMPTY_RESPONSE");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("OPENAI_JSON_PARSE_FAILED");
  }

  const normalized = normalizeSpecContextFromUnknown(parsed);
  if (!normalized) {
    throw new Error("OPENAI_SCHEMA_INVALID");
  }

  return normalized;
}

/** UI·DB 저장용: 리스트 필드는 불릿 텍스트로 */
export function specContextToFormFields(r: SpecContextGenerateResult): {
  specCoreGoals: string;
  specScopeIn: string;
  specScopeOut: string;
  specTargetUsers: string;
  specSuccessCriteria: string;
} {
  return {
    specCoreGoals: r.coreGoals,
    specScopeIn: formatListFieldAsBullets(r.inScope),
    specScopeOut: formatListFieldAsBullets(r.outOfScope),
    specTargetUsers: formatListFieldAsBullets(r.targetUsers),
    specSuccessCriteria: formatListFieldAsBullets(r.successCriteria),
  };
}

/**
 * 워크스페이스에 저장된 프롬프트 텍스트를 그대로 사용자 메시지로 전달해
 * Project Spec 마크다운 본문만 생성한다.
 */
const WORKSPACE_SPEC_DEFAULT_MODEL = "gpt-4o";

export async function completeWorkspaceSpecMarkdown(
  promptText: string,
  modelFromRequest?: string | null
): Promise<{ markdown: string; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_NOT_CONFIGURED");
  }

  const trimmed = modelFromRequest?.trim();
  const model =
    trimmed && trimmed.length > 0 ? trimmed : process.env.OPENAI_MODEL?.trim() || WORKSPACE_SPEC_DEFAULT_MODEL;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.45,
      messages: [
        {
          role: "system",
          content:
            "You are a senior software architect. Follow the user's instructions exactly. Output only the Project Spec document body as Markdown (Korean if the prompt is Korean). No markdown code fences wrapping the whole document, no preamble or epilogue.",
        },
        { role: "user", content: promptText.trim() },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OPENAI_HTTP_${res.status}:${errText.slice(0, 200)}`);
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const markdown = body.choices?.[0]?.message?.content?.trim();
  if (!markdown) {
    throw new Error("OPENAI_EMPTY_RESPONSE");
  }

  return { markdown, model };
}
