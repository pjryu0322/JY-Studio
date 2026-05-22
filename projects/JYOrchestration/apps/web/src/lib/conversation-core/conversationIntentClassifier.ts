import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { shouldInjectDocumentCollaborationContextStrictFallback } from "@/lib/requirements/documentContextInjection";
import { resolveUserOpenAiApiKey } from "@/lib/messenger/resolveUserOpenAiKey";
import { defaultResponsePolicyForMode } from "@/lib/conversation-core/conversationResponsePolicy";
import type {
  ConversationIntentClassification,
  ConversationIntentMode,
  ConversationParticipationMode,
  ConversationResponsePolicy,
  ConversationScope,
} from "@/lib/conversation-core/conversationIntentTypes";
import {
  resolveConversationParticipationMode,
  resolveConversationScope,
} from "@/lib/conversation-core/conversationIntentTypes";

export type { ConversationIntentClassification, ConversationIntentMode, ConversationScope };

const CLASSIFIER_SYSTEM = `당신은 대화 의도 분류기입니다.
사용자의 마지막 발화와 최근 대화 맥락을 보고, AI기획자가 어떤 응답 모드로 답해야 하는지 JSON으로만 분류하세요.

분류 기준:
- brainstorm: 아이디어 확장, 방향 탐색, 가능성 브레인스토밍
- feasibility_check: 가능 여부 확인, URL/자료/기능의 수집·구현 가능성 검토 요청
- research_request: 실제 조사/검색/외부 확인이 필요한 요청
- summary: 지금까지 대화 정리 요청
- project_draft: 프로젝트 생성/프로토타입 준비/초안 생성 요청
- project_execution_planning: 이미 구현/실행/작업지시로 넘어가는 요청
- general_chat: 위에 해당하지 않는 일반 대화

중요:
- "확인해줘", "가능해?", "수집할 수 있어?", "검토해줘"는 brainstorm이 아니라 feasibility_check일 가능성이 높다.
- URL이 포함되고 데이터/API/수집/크롤링 가능 여부를 묻는 경우 feasibility_check로 분류한다.
- 문서/PDF/파일 업로드/주석/댓글/문서 비교/공동 검토가 명확할 때만 shouldInjectDocumentContext=true.
- 화면, UX, 직관적, 반응형 같은 일반 UI 단어만으로는 문서 협업 맥락을 주입하지 않는다.
- 실제 웹사이트를 확인한 것처럼 단정하지 않는다.

출력 JSON만 (다른 텍스트 금지):
{
  "mode": "feasibility_check",
  "confidence": 0.91,
  "reason": "한 줄 이유",
  "shouldInjectDocumentContext": false,
  "domainContextReason": null,
  "userConstraints": [],
  "discardedDirections": [],
  "openOptions": [],
  "responsePolicy": {
    "avoidBrainstormExpansion": true,
    "avoidFeatureFinalization": true,
    "mustStateVerificationLimit": true,
    "mustProvideCheckItems": true
  }
}`;

type TranscriptTurn = { readonly role: "user" | "assistant"; readonly content: string };

function lastUserText(transcript: readonly TranscriptTurn[]): string {
  for (let i = transcript.length - 1; i >= 0; i--) {
    if (transcript[i]!.role === "user") return String(transcript[i]!.content ?? "").trim();
  }
  return "";
}

function recentUserBlob(transcript: readonly TranscriptTurn[], max = 6): string {
  return transcript
    .filter((m) => m.role === "user")
    .slice(-max)
    .map((m) => String(m.content ?? "").trim())
    .join("\n");
}

function mergePolicy(raw: unknown, mode: ConversationIntentMode): ConversationResponsePolicy {
  const defaults = defaultResponsePolicyForMode(mode);
  if (!raw || typeof raw !== "object") return defaults;
  const r = raw as Record<string, unknown>;
  return {
    ...defaults,
    ...(typeof r.avoidBrainstormExpansion === "boolean" ? { avoidBrainstormExpansion: r.avoidBrainstormExpansion } : {}),
    ...(typeof r.avoidFeatureFinalization === "boolean" ? { avoidFeatureFinalization: r.avoidFeatureFinalization } : {}),
    ...(typeof r.mustStateVerificationLimit === "boolean" ? { mustStateVerificationLimit: r.mustStateVerificationLimit } : {}),
    ...(typeof r.mustProvideCheckItems === "boolean" ? { mustProvideCheckItems: r.mustProvideCheckItems } : {}),
    ...(typeof r.shouldOfferAlternatives === "boolean" ? { shouldOfferAlternatives: r.shouldOfferAlternatives } : {}),
    ...(typeof r.shouldSummarizeDecisions === "boolean" ? { shouldSummarizeDecisions: r.shouldSummarizeDecisions } : {}),
    ...(typeof r.shouldPrepareProjectDraft === "boolean" ? { shouldPrepareProjectDraft: r.shouldPrepareProjectDraft } : {}),
  };
}

function coerceStringArray(raw: unknown, max = 8): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, max);
}

function parseMode(raw: unknown): ConversationIntentMode | null {
  const s = String(raw ?? "").trim();
  const allowed: ConversationIntentMode[] = [
    "brainstorm",
    "feasibility_check",
    "research_request",
    "summary",
    "project_draft",
    "project_execution_planning",
    "general_chat",
  ];
  return (allowed as readonly string[]).includes(s) ? (s as ConversationIntentMode) : null;
}

export function parseConversationIntentJson(
  raw: string,
  scope: ConversationScope,
  participationMode: ConversationParticipationMode
): ConversationIntentClassification | null {
  let s = String(raw ?? "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  try {
    const j = JSON.parse(s) as Record<string, unknown>;
    const mode = parseMode(j.mode);
    if (!mode) return null;
    const shouldInjectDocumentContext = Boolean(j.shouldInjectDocumentContext);
    return {
      mode,
      confidence: Math.max(0, Math.min(1, Number(j.confidence) || 0.7)),
      reason: String(j.reason ?? "llm_classifier").trim().slice(0, 500) || "llm_classifier",
      scope,
      participationMode,
      shouldInjectDocumentContext,
      domainContextReason:
        typeof j.domainContextReason === "string" ? j.domainContextReason.slice(0, 200) : shouldInjectDocumentContext ? "llm" : null,
      userConstraints: coerceStringArray(j.userConstraints),
      discardedDirections: coerceStringArray(j.discardedDirections),
      openOptions: coerceStringArray(j.openOptions),
      responsePolicy: mergePolicy(j.responsePolicy, mode),
      classifierSource: "llm",
    };
  } catch {
    return null;
  }
}

const FEASIBILITY_ACTION_RE =
  /확인해\s*줘|검토해\s*줘|점검해\s*줘|봐\s*줘|될까\??|가능한가\??|할\s*수\s*있는지|가능\s*여부/i;

const FEASIBILITY_OBJECT_RE =
  /수집|데이터|API|api|크롤|크롤링|다운로드|목록|접근|조회|가져올|추출|스크래핑/i;

const FEASIBILITY_EXPLICIT_RE =
  /수집할\s*수\s*있는지|다운로드할\s*수\s*있는지|접근\s*가능한지|조회\s*가능한지/i;

const BRAINSTORM_POSSIBILITY_RE =
  /가능한\s*(방향|아이디어|접근|시나리오|확장|기능)|확장\s*가능성|발전\s*가능성/i;

function isFeasibilitySignalsInText(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t) return false;
  if (BRAINSTORM_POSSIBILITY_RE.test(t) && !FEASIBILITY_OBJECT_RE.test(t)) return false;
  if (/https?:\/\//i.test(t) && FEASIBILITY_OBJECT_RE.test(t)) return true;
  if (FEASIBILITY_ACTION_RE.test(t) && FEASIBILITY_OBJECT_RE.test(t)) return true;
  if (FEASIBILITY_EXPLICIT_RE.test(t)) return true;
  return false;
}

/** 마지막 user 발화가 가능 여부·수집 확인류인지 (rules 보정·LLM guard용) */
export function looksLikeFeasibilityUtterance(lastUser: string): boolean {
  return isFeasibilitySignalsInText(lastUser);
}

/** LLM·rules·strict fallback을 합쳐 문서 협업 맥락 주입 여부 */
export function mergeConversationDocumentContext(
  rules: ConversationIntentClassification,
  parsed: ConversationIntentClassification,
  docBlob: string
): boolean {
  const strictDoc = shouldInjectDocumentCollaborationContextStrictFallback({ text: docBlob });
  return strictDoc && (parsed.shouldInjectDocumentContext || rules.shouldInjectDocumentContext);
}

/** LLM이 brainstorm 등으로 바꿔도 rules feasibility를 유지할지 */
export function mergeConversationIntentWithRulesGuard(
  rules: ConversationIntentClassification,
  parsed: ConversationIntentClassification,
  lastUser: string
): ConversationIntentClassification {
  if (rules.mode !== "feasibility_check") return parsed;
  if (parsed.mode === "feasibility_check") return parsed;
  if (!looksLikeFeasibilityUtterance(lastUser)) return parsed;
  return {
    ...parsed,
    mode: "feasibility_check",
    reason: `${parsed.reason} / rules_override: ${rules.reason}`.slice(0, 500),
    responsePolicy: {
      ...defaultResponsePolicyForMode("feasibility_check"),
      ...parsed.responsePolicy,
      avoidBrainstormExpansion: true,
      avoidFeatureFinalization: true,
      mustStateVerificationLimit: true,
      mustProvideCheckItems: true,
    },
    classifierSource: parsed.classifierSource ?? "llm",
  };
}

/** 규칙 기반 분류 — LLM 실패·테스트·NO_KEY 시 사용 */
export function classifyConversationIntentFromRules(input: {
  readonly scope: ConversationScope;
  readonly participationMode: ConversationParticipationMode;
  readonly transcript: readonly TranscriptTurn[];
}): ConversationIntentClassification {
  const last = lastUserText(input.transcript);
  const blob = `${recentUserBlob(input.transcript)}\n${last}`.trim();
  const shouldInjectDocumentContext = shouldInjectDocumentCollaborationContextStrictFallback({ text: blob });

  let mode: ConversationIntentMode = "general_chat";
  let reason = "일반 대화";
  const openOptions: string[] = [];

  if (/프로젝트(로)?\s*만들|프로토타입\s*준비|초안\s*생성/i.test(last)) {
    mode = "project_draft";
    reason = "프로젝트·초안 생성 요청";
  } else if (/지금까지\s*정리|대화\s*정리|요약해\s*줘/i.test(last)) {
    mode = "summary";
    reason = "대화 정리 요청";
  } else if (
    BRAINSTORM_POSSIBILITY_RE.test(last) &&
    !FEASIBILITY_OBJECT_RE.test(last) &&
    !isFeasibilitySignalsInText(last)
  ) {
    mode = "brainstorm";
    reason = "가능성·방향 탐색";
  } else if (isFeasibilitySignalsInText(last) || isFeasibilitySignalsInText(blob)) {
    mode = "feasibility_check";
    reason = "가능 여부·수집·검토 확인 요청";
    openOptions.push("수집 가능성 점검", "공개 범위 확인", "대체 수집 방식 검토");
  } else if (
    /조사|검색해|리서치/i.test(last) &&
    !isFeasibilitySignalsInText(last) &&
    !/https?:\/\//i.test(last)
  ) {
    mode = "research_request";
    reason = "외부 조사·검색 요청(직접 조회 결과 단정 금지)";
  } else if (/확장|브레인스토밍|아이디어.*넓|방향.*제안/i.test(last)) {
    mode = "brainstorm";
    reason = "아이디어 확장·탐색";
  } else if (/구현|개발해|작업지시|실행해/i.test(last)) {
    mode = "project_execution_planning";
    reason = "실행·구현 단계 요청";
  } else if (input.scope === "pre_project" && last.length > 8) {
    mode = "brainstorm";
    reason = "pre-project 기본 탐색";
  }

  if (shouldInjectDocumentContext && mode === "brainstorm") {
    // 문서 협업 명시 시 feasibility보다 brainstorm 유지 가능
  }

  return {
    mode,
    confidence: 0.75,
    reason,
    scope: input.scope,
    participationMode: input.participationMode,
    shouldInjectDocumentContext,
    domainContextReason: shouldInjectDocumentContext ? "strict_keyword_fallback" : null,
    userConstraints: [],
    discardedDirections: [],
    openOptions,
    responsePolicy: defaultResponsePolicyForMode(mode),
    classifierSource: "rules",
  };
}

export async function classifyConversationIntent(input: {
  readonly userId: string;
  readonly scope?: ConversationScope;
  readonly participationMode?: ConversationParticipationMode;
  readonly transcript: readonly TranscriptTurn[];
  readonly projectId?: string | null;
  readonly projectName?: string | null;
  readonly roomId?: string | null;
}): Promise<ConversationIntentClassification> {
  const scope = input.scope ?? resolveConversationScope(input.projectId);
  const participationMode = input.participationMode ?? resolveConversationParticipationMode(scope);
  const rules = classifyConversationIntentFromRules({
    scope,
    participationMode,
    transcript: input.transcript,
  });

  const last = lastUserText(input.transcript);
  const summary = input.transcript
    .filter((m) => m.role === "user")
    .slice(-4)
    .map((m) => `- ${String(m.content ?? "").trim().slice(0, 300)}`)
    .join("\n");

  const { key } = await resolveUserOpenAiApiKey(input.userId);
  if (!key) return rules;

  const userPayload = [
    `scope=${scope}`,
    `participationMode=${participationMode}`,
    input.projectId ? `projectId=${input.projectId}` : "",
    input.roomId ? `roomId=${input.roomId}` : "",
    input.projectName ? `projectName=${input.projectName}` : "",
    summary ? `[최근 user 발화]\n${summary}` : "",
    `[마지막 user 발화]\n${last}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const res = await postOpenAiChatCompletion({
      apiKey: key,
      model: resolveOpenAiModelFromEnv(),
      messages: [
        { role: "system", content: CLASSIFIER_SYSTEM },
        { role: "user", content: userPayload },
      ],
      temperature: 0.1,
      maxTokens: 450,
      responseFormatJsonObject: true,
    });
    if (!res.ok) return rules;
    const parsed = parseConversationIntentJson(res.text, scope, participationMode);
    if (!parsed) return rules;
    const docBlob = blobForDoc(input.transcript);
    const shouldInjectDocumentContext = mergeConversationDocumentContext(rules, parsed, docBlob);
    const merged = mergeConversationIntentWithRulesGuard(rules, parsed, last);
    return {
      ...merged,
      shouldInjectDocumentContext,
      domainContextReason: shouldInjectDocumentContext
        ? merged.domainContextReason ?? (parsed.shouldInjectDocumentContext ? "llm+strict" : "strict+rules")
        : null,
    };
  } catch {
    return rules;
  }
}

function blobForDoc(transcript: readonly TranscriptTurn[]): string {
  return recentUserBlob(transcript, 8);
}
