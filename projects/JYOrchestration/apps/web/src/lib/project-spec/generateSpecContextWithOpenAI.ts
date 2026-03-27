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

function workspaceSpecTemperature(model: string): number {
  if (model.includes("4o-mini")) {
    return 0.38;
  }
  if (model.includes("4.1")) {
    return 0.48;
  }
  return 0.42;
}

export async function completeWorkspaceSpecMarkdown(
  promptText: string,
  modelFromRequest?: string | null
): Promise<{
  markdown: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_NOT_CONFIGURED");
  }

  const trimmed = modelFromRequest?.trim();
  const model =
    trimmed && trimmed.length > 0 ? trimmed : process.env.OPENAI_MODEL?.trim() || WORKSPACE_SPEC_DEFAULT_MODEL;

  const system =
    "You are a senior software architect and requirements engineer. Follow the user's Korean instructions exactly. " +
    "Output ONLY the Project Spec as Markdown body: fixed section headers (## 1. Project Overview … ## 7. Constraints & Assumptions), " +
    "tables and bullets where requested, IDs like FR-01/UC-01, testable acceptance criteria. " +
    "No narrative-only blobs. No markdown code fence wrapping the entire document. No preamble or epilogue.";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: workspaceSpecTemperature(model),
      messages: [
        {
          role: "system",
          content: system,
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
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  const markdown = body.choices?.[0]?.message?.content?.trim();
  if (!markdown) {
    throw new Error("OPENAI_EMPTY_RESPONSE");
  }

  const u = body.usage;
  const usage =
    typeof u?.prompt_tokens === "number" &&
    typeof u?.completion_tokens === "number" &&
    typeof u?.total_tokens === "number"
      ? {
          promptTokens: u.prompt_tokens,
          completionTokens: u.completion_tokens,
          totalTokens: u.total_tokens,
        }
      : null;

  return { markdown, model, usage };
}

/**
 * 현재 확정 Project Spec 마크다운을 입력으로 다듬은(refine) 본문만 생성한다.
 */
export async function refineWorkspaceSpecMarkdown(
  currentMarkdown: string,
  modelFromRequest?: string | null
): Promise<{
  markdown: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_NOT_CONFIGURED");
  }

  const trimmed = modelFromRequest?.trim();
  const model =
    trimmed && trimmed.length > 0 ? trimmed : process.env.OPENAI_MODEL?.trim() || WORKSPACE_SPEC_DEFAULT_MODEL;

  const userMessage = `아래는 현재 확정된 Project Spec 마크다운입니다. 구조(헤딩·섹션 순서)는 최대한 유지하고, 명확성·완결성·표현 일관성만 개선한 전체 본문을 출력하세요. 없던 요구나 범위를 임의로 추가하지 마세요.

---
${currentMarkdown.trim()}
---`;

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
          content:
            "You are a senior software architect. Refine the given Project Spec in place: preserve section structure and headings; improve clarity and consistency only. Output only the full Markdown body (Korean if the input is Korean). No markdown code fences wrapping the whole document, no preamble or epilogue.",
        },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OPENAI_HTTP_${res.status}:${errText.slice(0, 200)}`);
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  const markdown = body.choices?.[0]?.message?.content?.trim();
  if (!markdown) {
    throw new Error("OPENAI_EMPTY_RESPONSE");
  }

  const u = body.usage;
  const usage =
    typeof u?.prompt_tokens === "number" &&
    typeof u?.completion_tokens === "number" &&
    typeof u?.total_tokens === "number"
      ? {
          promptTokens: u.prompt_tokens,
          completionTokens: u.completion_tokens,
          totalTokens: u.total_tokens,
        }
      : null;

  return { markdown, model, usage };
}

/**
 * 실행 계획 수준의 전체 프로젝트 플랜 문서(마크다운 한 편).
 * Task Draft 등 후속 단계의 입력으로 쓰기 좋게 구체적으로 작성하도록 유도한다.
 */
export async function generateFullProjectPlanMarkdown(
  input: {
    name: string;
    description: string;
    projectType: string;
  },
  modelFromRequest: string
): Promise<{
  markdown: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_NOT_CONFIGURED");
  }

  const model = modelFromRequest.trim() || "gpt-4o-mini";

  const lens =
    model === "gpt-4o"
      ? "\n[이 모델 관점] 데이터/API 경계·트랜잭션·장애 시나리오·관측성을 구체적으로."
      : model === "gpt-4.1"
        ? "\n[이 모델 관점] 사용자 가치·릴리즈 순서·비기능의 사용자 영향을 강조."
        : "\n[이 모델 관점] MVP 경로·리스크·검증 우선순위를 간결히.";

  const userMessage = `아래 프로젝트 메타 정보를 바탕으로 **실행 가능한 수준의 프로젝트 실행 계획(Project Plan) 초안**을 마크다운 한 편으로 작성하라.
${lens}
마케팅 문구가 아니라, 실제 구현·아키텍처·운영 관점에서 구체적으로 작성하라.

[입력]
- 프로젝트명: ${input.name}
- 설명: ${input.description?.trim() || "(없음)"}
- 유형: ${input.projectType}

[반드시 다룰 내용 — 제목·순서는 자연스럽게 조정해도 됨]
1. 프로젝트 개요
2. 목표 및 범위 (In scope / Out of scope를 명확히 구분)
3. 사용자·이해관계자 및 핵심 유스케이스
4. 기능 요구사항 (우선순위·의존성이 드러나게)
5. 비기능 요구사항 (성능, 보안, 가용성, 규제 등)
6. 시스템 아키텍처 개요
7. 핵심 기술 스택 및 선정 이유
8. 핵심 알고리즘·처리 흐름 (해당 시)
9. 제약·가정·리스크
10. 마일스톤 또는 구현 순서

[출력 규칙]
- 마크다운 본문만. 전체를 코드펜스로 감싸지 말 것.
- 서론·요약 한 줄 없이 본문부터.
- 한국어로 작성.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: model === "gpt-4.1" ? 0.48 : model === "gpt-4o-mini" ? 0.36 : 0.42,
      messages: [
        {
          role: "system",
          content:
            "You are a senior software architect and technical lead. Write a single coherent Markdown document. Be concrete and implementation-oriented. No fluff.",
        },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OPENAI_HTTP_${res.status}:${errText.slice(0, 200)}`);
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  const markdown = body.choices?.[0]?.message?.content?.trim();
  if (!markdown) {
    throw new Error("OPENAI_EMPTY_RESPONSE");
  }

  const u = body.usage;
  const usage =
    typeof u?.prompt_tokens === "number" &&
    typeof u?.completion_tokens === "number" &&
    typeof u?.total_tokens === "number"
      ? {
          promptTokens: u.prompt_tokens,
          completionTokens: u.completion_tokens,
          totalTokens: u.total_tokens,
        }
      : null;

  return { markdown, model, usage };
}

/**
 * 현재 작업 중인 전체 문서에 대한 개선 제안(전체 마크다운). 자동 적용하지 않고 별도 표시용.
 */
export async function reviseProjectPlanMarkdown(input: {
  document: string;
  instruction?: string | null;
  modelFromRequest: string;
}): Promise<{
  markdown: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_NOT_CONFIGURED");
  }

  const model = input.modelFromRequest.trim() || "gpt-4o-mini";

  const userMessage = `${input.instruction?.trim() ? `[사용자 지시]\n${input.instruction.trim()}\n\n` : ""}[현재 문서 — 마크다운]
---
${input.document.trim()}
---

위 문서 전체를 기준으로 개선된 **전체** 마크다운 버전을 제안하라. 구조는 유지하되 실행·구현 관점에서 구체화하라. 출력은 제안 본문만. 한국어. 코드펜스 금지.`;

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
          content:
            "You are a senior software architect. Output only the full revised Markdown document. No preamble or explanation.",
        },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OPENAI_HTTP_${res.status}:${errText.slice(0, 200)}`);
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  const markdown = body.choices?.[0]?.message?.content?.trim();
  if (!markdown) {
    throw new Error("OPENAI_EMPTY_RESPONSE");
  }

  const u = body.usage;
  const usage =
    typeof u?.prompt_tokens === "number" &&
    typeof u?.completion_tokens === "number" &&
    typeof u?.total_tokens === "number"
      ? {
          promptTokens: u.prompt_tokens,
          completionTokens: u.completion_tokens,
          totalTokens: u.total_tokens,
        }
      : null;

  return { markdown, model, usage };
}
