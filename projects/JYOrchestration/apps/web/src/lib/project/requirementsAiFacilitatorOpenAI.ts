import type { IdeationDeliverableType } from "@/lib/requirements/ideationDeliverables";
import type { InterviewAnalyzerPayload, ProblemInterviewState } from "@/lib/requirements/problemInterview";
import { parseInterviewAnalyzerPayloadFromModelText } from "@/lib/requirements/problemInterview";
import {
  buildIdeationDeliverableBasePrompt,
  buildIdeationDeliverablesUserPrompt,
  extractIdeationDeliverableOutputsFromRoot,
  stripJsonMarkdownFences,
} from "@/lib/requirements/ideationDeliverables";
import type { OrganizeMemoryFacts } from "@/lib/requirements/requirementsOrganizeContext";
import { formatMandatoryReminderForModel, formatMemoryFactsForModel } from "@/lib/requirements/requirementsOrganizeContext";

const DEFAULT_MODEL = "gpt-4o-mini";

export type RequirementsAiResponseStyle = "brief" | "standard" | "detailed";

export type RequirementsFacilitatorOpenAiResult =
  | { ok: true; text: string; model: string }
  | { ok: false; code: string; message: string };

function facilitatorResponseStyleAddendum(style: RequirementsAiResponseStyle | undefined): string {
  const s = style === "brief" || style === "detailed" ? style : "standard";
  if (s === "standard") return "";
  if (s === "brief") {
    return `\n\n[응답 길이 선호 — 사용자 설정: 간단히]\n- 문장 수를 줄이고, 한두 가지 확인 질문에 집중합니다.\n- 기본 8문장 이내 규칙보다 더 짧게 써도 됩니다.`;
  }
  return `\n\n[응답 길이 선호 — 사용자 설정: 상세히]\n- 맥락·옵션·트레이드오프를 풀어 설명해도 됩니다.\n- 필요하면 단계별로 나열합니다.`;
}

function draftResponseStyleAddendum(style: RequirementsAiResponseStyle | undefined): string {
  const s = style === "brief" || style === "detailed" ? style : "standard";
  if (s === "standard") return "";
  if (s === "brief") {
    return `\n[추가 규칙 — 응답 스타일: 간단히]\n- overview·각 배열 항목은 짧은 구문 위주로 유지합니다.`;
  }
  return `\n[추가 규칙 — 응답 스타일: 상세히]\n- overview와 항목 설명을 조금 더 구체적으로 작성해도 됩니다.`;
}

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
  /** 질문 대상 멤버(복수) — 모델 맥락용 */
  mentionTargetsSummary?: string;
  /** 전송 메타(감사·디버그용, 본문에만 포함) */
  senderSummary?: string;
  /** 클라이언트 전역 설정과 동기 */
  responseStyle?: RequirementsAiResponseStyle;
}): Promise<RequirementsFacilitatorOpenAiResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };
  }

  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  const excerpt = input.dialogueExcerpt.trim().slice(0, 24_000);
  const projectName = input.projectName.trim();
  const projectDescription = input.projectDescription.trim();
  const mentionBlock = (input.mentionTargetsSummary ?? "").trim()
    ? `\n\n[질문 대상 멤버]\n${(input.mentionTargetsSummary ?? "").trim()}`
    : "";
  const senderBlock = (input.senderSummary ?? "").trim()
    ? `\n\n[발신]\n${(input.senderSummary ?? "").trim()}`
    : "";

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
- (아이디어 구체화) 이번 응답에는 확인 질문을 정확히 1개만 넣습니다. 둘째 이후 질문·번호 목록·여러 물음표 나열은 금지입니다.
- 가능하면 1~2문장으로 핵심 이해를 짧게 쓴 뒤, 질문 1개만 제시합니다. 짧은 이유는 최대 한 문장까지 선택입니다.
- 사용자가 특정 참가자에게 질문한 맥락이 있으면 그에 맞춰 답합니다.${facilitatorResponseStyleAddendum(input.responseStyle)}`,
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
${input.userMessage.trim()}${mentionBlock}${senderBlock}`,
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

/**
 * 아이디어 구체화: 대화가 비어 있을 때 AI 기획자가 인터뷰 첫 질문만 던지도록 부트스트랩.
 * 일반 요구사항 AI 기획자 프롬프트와 분리해, 질문 1개·설명 금지 규칙을 강하게 둡니다.
 */
export async function runRequirementsIdeationInterviewBootstrapOpenAI(input: {
  projectName: string;
  projectDescription: string;
}): Promise<RequirementsFacilitatorOpenAiResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };
  }

  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  const pn = input.projectName.trim() || "(이름 없음)";
  const pd = input.projectDescription.trim() || "(설명 없음)";

  const system = `당신은 숙련된 서비스 기획자입니다.

목표:
사용자의 프로젝트 아이디어를 구체화하기 위해
1단계 문제정의 인터뷰를 진행하십시오.

프로젝트명:
${pn}

프로젝트 설명:
${pd}

지시사항:
1. 프로젝트 내용을 해석하라.
2. 부족한 핵심 정보를 찾으라.
3. 가장 중요한 질문 1개만 하라.
4. 여러 질문 동시 금지.
5. 답변 후 후속 질문으로 좁혀가라.
6. 질문은 맞춤형이어야 한다.
7. 확보 목표:

- 핵심 사용자
- 현재 문제점
- 기존 해결 방식
- 개선 필요성

지금 첫 질문을 시작하라.

IMPORTANT:
Only ask ONE question.
The entire response must contain exactly one question mark (?).

[출력 형식 — 반드시 준수]
- 이번 응답은 질문 한 문장만 출력한다.
- 인사·설명·부연·마크다운·목록·머리글·번호 매기기(1. 2. 등) 금지.
- 문장 끝은 반드시 물음표(?)로 끝낸다.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 72,
      messages: [
        { role: "system", content: system },
        { role: "user", content: "한국어로 질문 한 문장만 출력하라. 물음표는 하나만." },
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
  /** 구버전 호환: 구조화 입력이 없을 때만 주력으로 사용 */
  dialogueExcerpt?: string;
  userMessage: string;
  existingDraft?: unknown;
  responseStyle?: RequirementsAiResponseStyle;
  memoryFacts?: OrganizeMemoryFacts | null;
  rollingSummary?: string;
  recentMessages?: string;
  /** true면 dialogueExcerpt를 전체 원문 폴백으로 추가 제공 */
  useRawDialogueFallback?: boolean;
}): Promise<RequirementsDraftOpenAiResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };
  }
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  const excerpt = String(input.dialogueExcerpt ?? "").trim().slice(0, 24_000);
  const existingDraftText = input.existingDraft ? JSON.stringify(input.existingDraft).slice(0, 12_000) : "";

  const memoryFactsText = formatMemoryFactsForModel(input.memoryFacts ?? undefined).trim();
  const mandatoryReminder = formatMandatoryReminderForModel(input.memoryFacts ?? undefined).trim();
  const rolling = String(input.rollingSummary ?? "").trim();
  const useRaw = Boolean(input.useRawDialogueFallback);
  const recentTrim = String(input.recentMessages ?? "").trim();
  const recentForModel = recentTrim
    ? recentTrim.slice(0, 24_000)
    : !useRaw && excerpt
      ? excerpt.slice(0, 24_000)
      : "";
  const hasStructured = Boolean(memoryFactsText || rolling || recentForModel);

  const contextBlock = hasStructured
    ? [
        memoryFactsText && `[memory_facts]\n${memoryFactsText}`,
        rolling && `[rolling_summary]\n${rolling}`,
        recentForModel && `[recent_messages]\n${recentForModel}`,
        mandatoryReminder && `${mandatoryReminder}`,
        useRaw && excerpt && `[전체 대화 원문(폴백)]\n${excerpt}`,
        !useRaw && `[전체 대화 원문]\n전체 원문은 제공하지 않는다. 위 memory_facts·rolling_summary·recent_messages만 근거로 삼아라. 빈약하면 openIssues에 '확인 필요'로 남겨라.`,
      ]
        .filter(Boolean)
        .join("\n\n")
    : `[memory_facts]\n(없음)\n\n[rolling_summary]\n(없음)\n\n[recent_messages]\n(없음)\n\n프로젝트 이름·설명·사용자 요청만으로 초안을 구성하고, 불확실한 항목은 openIssues에 '확인 필요'로 남겨라.`;

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

${contextBlock}

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
- 한국어로 작성.${draftResponseStyleAddendum(input.responseStyle)}`,
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

export type IdeationDeliverablesOpenAiResult =
  | { ok: true; outputs: Partial<Record<IdeationDeliverableType, string>>; model: string }
  | { ok: false; code: string; message: string };

/**
 * 아이디어 협의실: 선택한 산출물 유형별 본문을 한 번에 생성(JSON).
 */
export async function runIdeationDeliverablesOpenAI(input: {
  projectName: string;
  projectDescription: string;
  chatSummary: string;
  dialogueExcerpt: string;
  selectedTypes: readonly IdeationDeliverableType[];
  responseStyle?: RequirementsAiResponseStyle;
}): Promise<IdeationDeliverablesOpenAiResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };
  }
  const types = input.selectedTypes.filter(Boolean);
  if (!types.length) {
    return { ok: false, code: "NO_TYPES", message: "선택된 산출물이 없습니다." };
  }

  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  const excerpt = input.dialogueExcerpt.trim().slice(0, 24_000);
  const base = buildIdeationDeliverableBasePrompt({
    projectName: input.projectName.trim() || "(이름 없음)",
    projectDescription: input.projectDescription.trim() || "(설명 없음)",
    chatSummary: input.chatSummary.trim() || "(저장된 요약 없음)",
    recentMessages: excerpt || "(최근 대화 없음)",
  });
  const userBlock = buildIdeationDeliverablesUserPrompt(types);
  const keysLine = types.map((t) => `"${t}"`).join(", ");

  const callModel = async (userContent: string) => {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a Korean product planning assistant. Output only one valid JSON object. No markdown fences.${facilitatorResponseStyleAddendum(input.responseStyle)}`,
          },
          {
            role: "user",
            content: userContent,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        ok: false as const,
        code: `HTTP_${res.status}`,
        message: `OpenAI API 오류(HTTP ${res.status}): ${errText.slice(0, 400)}`,
      };
    }

    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return { ok: false as const, code: "EMPTY", message: "OpenAI 응답 본문이 비어 있습니다." };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonMarkdownFences(text)) as unknown;
    } catch {
      return { ok: false as const, code: "JSON_PARSE", message: "OpenAI JSON 파싱에 실패했습니다." };
    }

    const extracted = extractIdeationDeliverableOutputsFromRoot(parsed, types);
    if (!extracted.ok) {
      return { ok: false as const, code: "SCHEMA", message: extracted.message };
    }
    return { ok: true as const, outputs: extracted.outputs };
  };

  const first = await callModel(`${base}\n\n${userBlock}`);
  if (first.ok) {
    return { ok: true, outputs: first.outputs, model };
  }

  const retryable = first.code === "SCHEMA" || first.code === "JSON_PARSE";
  if (!retryable) {
    return first;
  }

  const repair = `\n\n[재시도 — 필수]\n직전 응답이 규격에 맞지 않았습니다. 다시 **유효한 JSON 한 개만** 출력하세요.\n최상위에 "outputs" 객체를 두고, 키 ${keysLine} 각각에 **비어 있지 않은 마크다운 문자열**을 넣으세요.\n각 문자열은 최소 400자 이상의 실질 본문이어야 합니다. 공백만 있는 값 금지.`;
  const second = await callModel(`${base}\n\n${userBlock}${repair}`);
  if (second.ok) {
    return { ok: true, outputs: second.outputs, model };
  }
  return second;
}

export type OpenAiModelsPingResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

export type InterviewAnalyzeOpenAiResult =
  | { ok: true; payload: InterviewAnalyzerPayload; model: string }
  | { ok: false; code: string; message: string };

function interviewStateJsonForAnalyzer(state: ProblemInterviewState): string {
  return JSON.stringify({
    coreUser: state.coreUser,
    painPoint: state.painPoint,
    currentMethod: state.currentMethod,
    needForImprovement: state.needForImprovement,
    partial: state.partial ?? {},
    notes: Object.fromEntries(
      Object.entries(state.notes ?? {}).map(([k, v]) => [k, String(v).slice(0, 1200)])
    ),
    askedSlots: state.askedSlots ?? [],
  });
}

/**
 * 문제정의 인터뷰: 사용자 한 턴을 슬롯 상태로만 해석(JSON). 채팅 응답을 생성하지 않는다.
 */
export async function runInterviewAnalyzeOpenAI(input: {
  projectName: string;
  projectDescription: string;
  userMessage: string;
  latestAiQuestion: string;
  currentInterviewState: ProblemInterviewState;
}): Promise<InterviewAnalyzeOpenAiResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };
  }
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  const stateJson = interviewStateJsonForAnalyzer(input.currentInterviewState);

  const system = `당신은 문제정의 인터뷰 전용 "상태 분석기"입니다. 사용자와 대화하지 않습니다.
역할: 사용자의 최신 한 문단 답변만 읽고, 네 가지 슬롯에 정보가 얼마나 담겼는지 분류합니다.

슬롯 정의:
- coreUser: 핵심 사용자·주 사용자·역할 주체
- painPoint: 현재 문제점·비효율·리스크·불편
- currentMethod: 현재 운영 방식·기존 해결 방식·사용 도구·절차
- needForImprovement: 개선 필요성·기대 효과·도입 이유

규칙:
- 의미 기반으로 판단한다(키워드만 맞추지 않는다).
- 같은 의미의 다른 표현은 동일하게 매핑한다.
- 출력은 JSON 한 개만이다. 마크다운·코드펜스·JSON 밖의 설명 금지.
- filledSlots의 각 값은 반드시 "empty" | "partial" | "filled" 중 하나.
- nextBestSlot은 아직 filled가 아니면서 이번 답으로 가장 보강해야 할 슬롯 하나(없으면 null).
- confidence는 0~1 실수(모델 확신도).
- notes에는 해당 슬롯에서 뽑은 짧은 근거 불릿(한국어) 문자열만 배열로 넣는다.

JSON 스키마(키 이름·형식 엄수):
{
  "summary": "한두 문장 한국어 요약",
  "filledSlots": {
    "coreUser": "empty|partial|filled",
    "painPoint": "empty|partial|filled",
    "currentMethod": "empty|partial|filled",
    "needForImprovement": "empty|partial|filled"
  },
  "notes": { "coreUser": [], "painPoint": [], "currentMethod": [], "needForImprovement": [] },
  "nextBestSlot": "coreUser" | "painPoint" | "currentMethod" | "needForImprovement" | null,
  "confidence": 0.0
}`;

  const userBlock = `[프로젝트]
이름: ${input.projectName.trim() || "(이름 없음)"}
설명: ${input.projectDescription.trim() || "(설명 없음)"}

[직전 AI 질문(맥락)]
${input.latestAiQuestion.trim() || "(없음)"}

[현재 인터뷰 상태 JSON]
${stateJson}

[사용자 최신 답변]
${input.userMessage.trim()}`;

  const callOnce = async (repair: string) => {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.12,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: repair ? `${userBlock}\n\n[재시도] 직전 출력이 스키마에 맞지 않았습니다. 위 스키마의 JSON만 다시 출력하세요.` : userBlock,
          },
        ],
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { ok: false as const, code: `HTTP_${res.status}`, message: errText.slice(0, 400) };
    }
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) return { ok: false as const, code: "EMPTY", message: "응답 본문이 비어 있습니다." };
    const payload = parseInterviewAnalyzerPayloadFromModelText(text);
    if (!payload) return { ok: false as const, code: "PARSE", message: "JSON 파싱 실패" };
    return { ok: true as const, payload, model };
  };

  let r = await callOnce("");
  if (!r.ok && r.code === "PARSE") {
    r = await callOnce("retry");
  }
  if (!r.ok) return r;
  return { ok: true, payload: r.payload, model: r.model };
}

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
