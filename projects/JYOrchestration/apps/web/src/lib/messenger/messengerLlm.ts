import type { ChatMessage } from "@prisma/client";
import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { getPlatformAiMemberById } from "@/lib/ai/platformAiMembers";
import { recordMessengerOpenAi } from "@/lib/debug/promptTimelineStore";
import {
  buildMessengerHistoryTurnsFromChatRows,
  mergeMessengerHistoryTurns,
} from "@/lib/messenger/chatMessageToRequirementsMessage";
import { MESSENGER_DEFAULT_AI_CATALOG_KEY } from "@/lib/messenger/messengerConstants";
import {
  filterMessengerHistoryTurnsForAiHistoryWithStats,
  formatMessengerAiHistoryFilterStats,
  type MessengerAiHistoryFilterStats,
  type MessengerAiHistoryTurn,
} from "@/lib/messenger/messengerAiHistoryFilter";
import type { ProjectFromChatDraftPayloadV1 } from "@/lib/messenger/projectFromChatDraftTypes";
import { resolveUserOpenAiApiKey } from "@/lib/messenger/resolveUserOpenAiKey";
import {
  classifyConversationIntent,
  classifyConversationIntentFromRules,
} from "@/lib/conversation-core/conversationIntentClassifier";
import type { ConversationIntentClassification } from "@/lib/conversation-core/conversationIntentTypes";
import {
  resolveConversationParticipationMode,
  resolveConversationScope,
} from "@/lib/conversation-core/conversationIntentTypes";
import { buildFeasibilityRepetitionGuardBlock } from "@/lib/conversation-core/feasibilityRepetitionGuard";
import { formatConversationPromptMeta } from "@/lib/conversation-core/conversationPromptMeta";
import { preProjectScopeContaminationReason } from "@/lib/conversation/conversationScopeBoundary";
import { buildMessengerSystemPromptForIntent } from "@/lib/conversation-core/conversationResponsePolicy";
import { sanitizeUnsupportedFuturePromise } from "@/lib/conversation-core/futurePromiseGuard";
import {
  formatWebsiteInspectionForPrompt,
  inspectWebsite,
  type WebsiteInspectionResult,
} from "@/lib/conversation-core/websiteInspection";
import {
  buildAiPlannerContextBlocksFromTranscript,
  formatAiPlannerContextBlocksForPrompt,
  formatAiPlannerContextBlocksForTimeline,
} from "@/lib/requirements/aiPlannerContextBlocks";
import { DOC_COLLABORATION_HINT } from "@/lib/requirements/documentContextInjection";
import { resolveAiPlannerPromptMode } from "@/lib/requirements/plannerPromptMode";

const MAX_LOG_TRANSCRIPT = 24_000;

export type MessengerLlmLogContext = {
  readonly roomId: string;
  readonly roomTitle: string | null;
  readonly projectId: string | null;
};

/** 프로젝트 연결 방 등 레거시 경로용: user/assistant 본문 합산 상한(system 별도). */
const MESSENGER_TRANSCRIPT_CHAR_BUDGET = 36_000;

const MESSENGER_SUMMARY_MAX_CHARS = 3600;
/** 최근 대화 윈도우: 최대 8개 메시지(대략 2~4턴). */
const MESSENGER_RECENT_WINDOW_MAX_MESSAGES = 8;

/** 타임라인용 로그 본문 상한. */
const MAX_LOG_CONVERSATION_CHARS = 14_000;

function truncConversationTail(s: string, max: number): string {
  const t = String(s ?? "").trim();
  if (!t.length) return "(대화 없음)";
  if (t.length <= max) return t;
  return `…(이전 ${t.length - max}자 생략)\n\n${t.slice(-max)}`;
}

function isMessengerFreeRoom(log: MessengerLlmLogContext | undefined): boolean {
  return !String(log?.projectId ?? "").trim();
}

function combinedUserText(transcript: readonly { role: "user" | "assistant"; content: string }[]): string {
  return transcript
    .filter((m) => m.role === "user")
    .map((m) => String(m.content ?? "").trim())
    .join("\n");
}

type MessengerTurnSetup = {
  readonly classification: ConversationIntentClassification;
  readonly contextBlocksText: string;
  readonly docHint: boolean;
  readonly domainContextInjected: readonly string[];
  readonly timelineMetaHeader: string;
  readonly inspectionResult: WebsiteInspectionResult | null;
  readonly inspectionPromptText: string;
  readonly repetitionGuardText: string;
};

async function runWebsiteInspectionIfNeeded(
  classification: ConversationIntentClassification
): Promise<WebsiteInspectionResult | null> {
  if (classification.requiredAction !== "website_inspection") return null;
  const url = classification.targetUrls?.[0];
  if (!url) return null;
  try {
    return await inspectWebsite(url);
  } catch {
    return {
      url,
      ok: false,
      paginationHints: [],
      listStructureHints: [],
      dynamicLoadingHints: [],
      risks: [],
      recommendation: ["자동 점검 실패 — 브라우저 개발자도구·수동 확인 필요"],
      error: "INSPECTION_FAILED",
    };
  }
}

async function assembleMessengerTurnSetup(input: {
  readonly classification: ConversationIntentClassification;
  readonly transcript: readonly MessengerChatTurn[];
  readonly logContext?: MessengerLlmLogContext;
  readonly skipInspection?: boolean;
}): Promise<MessengerTurnSetup> {
  const layout = isMessengerFreeRoom(input.logContext) ? "free_windowed" : "legacy_tail";
  const plannerMode = resolveAiPlannerPromptMode({
    projectId: input.logContext?.projectId ?? null,
    roomId: input.logContext?.roomId ?? null,
    layout,
  });
  const contextBlocks = buildAiPlannerContextBlocksFromTranscript(input.transcript, plannerMode);
  const contextBlocksText = formatAiPlannerContextBlocksForPrompt(contextBlocks, plannerMode);
  const contextBlocksTimelineText = formatAiPlannerContextBlocksForTimeline(contextBlocks);
  const inspectionResult = input.skipInspection
    ? null
    : await runWebsiteInspectionIfNeeded(input.classification);
  const inspectionPromptText = inspectionResult ? formatWebsiteInspectionForPrompt(inspectionResult) : "";
  const repetitionGuardText =
    input.classification.mode === "feasibility_check"
      ? buildFeasibilityRepetitionGuardBlock(input.transcript)
      : "";
  const docHint = input.classification.shouldInjectDocumentContext;
  const domainContextInjected = docHint ? (["document_collaboration"] as const) : ([] as const);
  const promptMeta = formatConversationPromptMeta(input.classification, {
    layout,
    roomId: input.logContext?.roomId,
    projectId: input.logContext?.projectId ?? null,
    domainContextInjected: [...domainContextInjected],
    contextBlocks: contextBlocksTimelineText,
    inspection: inspectionResult,
  });
  const timelineMetaHeader = input.logContext ? promptMeta : "";
  return {
    classification: input.classification,
    contextBlocksText,
    docHint,
    domainContextInjected,
    timelineMetaHeader: timelineMetaHeader || "",
    inspectionResult,
    inspectionPromptText,
    repetitionGuardText,
  };
}

async function resolveMessengerTurnSetup(
  transcript: readonly MessengerChatTurn[],
  logContext: MessengerLlmLogContext | undefined,
  userId: string
): Promise<MessengerTurnSetup> {
  const scope = resolveConversationScope(logContext?.projectId ?? null);
  const participationMode = resolveConversationParticipationMode(scope);
  const classification = await classifyConversationIntent({
    userId,
    scope,
    participationMode,
    transcript,
    projectId: logContext?.projectId ?? null,
    roomId: logContext?.roomId ?? null,
  });
  return assembleMessengerTurnSetup({ classification, transcript, logContext });
}

/** 반복적인 저품질 assistant 안내 문구(요약·최근창에서 노출 억제). */
function isLowQualityAssistantReply(text: string): boolean {
  const t = String(text ?? "").trim();
  if (t.length < 16) return false;
  let score = 0;
  if (/좋은 아이디어/i.test(t)) score++;
  if (/어떤 기능이 마음에 드/i.test(t)) score++;
  if (/어떤 부분.*더 깊이|더 깊이 논의/i.test(t)) score++;
  if (/추가하고 싶은 아이디어|추가하고 싶은 기능/i.test(t)) score++;
  if (/구체적으로 어떤 디자인/i.test(t)) score++;
  if (/접근성.*맞춤화|피드백 수집이 중요/i.test(t)) score++;
  return score >= 2;
}

/** user 발화만 줄 단위로 누적(assistant 본문은 요약에 넣지 않음). */
function buildUserOnlyConversationSummary(
  prior: readonly { role: "user" | "assistant"; content: string }[]
): string {
  const bullets: string[] = [];
  for (const m of prior) {
    if (m.role !== "user") continue;
    const raw = String(m.content ?? "").trim().replace(/\s+/g, " ");
    if (raw.length < 3) continue;
    const line = `- ${raw.slice(0, 420)}`;
    if (bullets.length && bullets[bullets.length - 1] === line) continue;
    bullets.push(line);
  }
  return bullets.join("\n").slice(0, MESSENGER_SUMMARY_MAX_CHARS);
}

function takeRecentPriorMessages(
  prior: readonly { role: "user" | "assistant"; content: string }[]
): { role: "user" | "assistant"; content: string }[] {
  const start = Math.max(0, prior.length - MESSENGER_RECENT_WINDOW_MAX_MESSAGES);
  return prior.slice(start).map((m) => ({
    role: m.role,
    content:
      m.role === "assistant" && isLowQualityAssistantReply(String(m.content ?? ""))
        ? "[이전 AI 답변은 반복적인 안내라 생략합니다. 요약과 사용자 발화를 우선하세요.]"
        : String(m.content ?? "").trim(),
  }));
}

function buildMessengerSystemBlock(setup: MessengerTurnSetup, personaLine: string): string {
  const parts = [
    buildMessengerSystemPromptForIntent({
      classification: setup.classification,
      personaLine,
      contextBlocksText: setup.contextBlocksText,
    }),
  ];
  if (setup.inspectionPromptText.trim()) parts.push(setup.inspectionPromptText.trim());
  if (setup.repetitionGuardText.trim()) parts.push(setup.repetitionGuardText.trim());
  if (setup.docHint) parts.push(DOC_COLLABORATION_HINT);
  return parts.join("\n\n");
}

function buildLegacyTailSystemContent(
  setup: MessengerTurnSetup,
  personaLine: string,
  contextNote: string
): string {
  const parts: string[] = [buildMessengerSystemBlock(setup, personaLine)];
  if (contextNote.trim()) parts.push(contextNote.trim());
  return parts.join("\n\n");
}

/** OpenAI 없이 rules 분류만으로 턴 셋업 구성 (smoke·단위 테스트) */
export async function resolveMessengerTurnSetupFromRulesForTest(input: {
  readonly transcript: readonly MessengerChatTurn[];
  readonly logContext?: MessengerLlmLogContext;
  readonly skipInspection?: boolean;
}): Promise<MessengerTurnSetup> {
  const scope = resolveConversationScope(input.logContext?.projectId ?? null);
  const participationMode = resolveConversationParticipationMode(scope);
  const classification = classifyConversationIntentFromRules({
    scope,
    participationMode,
    transcript: input.transcript,
  });
  return assembleMessengerTurnSetup({
    classification,
    transcript: input.transcript,
    logContext: input.logContext,
    skipInspection: input.skipInspection ?? true,
  });
}

/** @internal 테스트용 */
export function buildMessengerSystemBlockForTest(
  classification: ConversationIntentClassification,
  contextBlocksText = "",
  options?: {
    readonly inspectionPromptText?: string;
    readonly transcript?: readonly MessengerChatTurn[];
  }
): string {
  const repetitionGuardText =
    classification.mode === "feasibility_check" && options?.transcript?.length
      ? buildFeasibilityRepetitionGuardBlock(options.transcript)
      : "";
  return buildMessengerSystemBlock(
    {
      classification,
      contextBlocksText,
      docHint: classification.shouldInjectDocumentContext,
      domainContextInjected: classification.shouldInjectDocumentContext ? ["document_collaboration"] : [],
      timelineMetaHeader: formatConversationPromptMeta(classification, {
        inspection: null,
      }),
      inspectionResult: null,
      inspectionPromptText: options?.inspectionPromptText ?? "",
      repetitionGuardText,
    },
    ""
  );
}

type MessengerChatTurn = { role: "user" | "assistant"; content: string };

export function applyMessengerAiHistoryFilter(input: {
  readonly transcript: readonly MessengerChatTurn[];
  readonly classification: ConversationIntentClassification;
  readonly chatRows?: readonly ChatMessage[];
}): { readonly transcript: MessengerChatTurn[]; readonly stats: MessengerAiHistoryFilterStats } {
  const last = input.transcript[input.transcript.length - 1];
  if (!last) {
    return {
      transcript: [],
      stats: { inputMessages: 0, includedMessages: 0, excludedByReason: {} },
    };
  }

  const rawTurns: MessengerAiHistoryTurn[] = input.chatRows?.length
    ? buildMessengerHistoryTurnsFromChatRows(input.chatRows)
    : input.transcript.map((t) => ({ role: t.role, content: t.content }));

  const { turns: filtered, stats } = filterMessengerHistoryTurnsForAiHistoryWithStats(
    rawTurns,
    input.classification
  );
  let merged = mergeMessengerHistoryTurns(filtered);
  if (last.role === "user") {
    const triggerText = String(last.content ?? "").trim();
    const mergedLast = merged[merged.length - 1];
    if (!mergedLast || mergedLast.role !== "user" || mergedLast.content !== triggerText) {
      const prior = merged.at(-1)?.role === "user" ? merged.slice(0, -1) : merged;
      merged = [...prior, { role: "user", content: triggerText }];
    }
  }

  return { transcript: merged, stats };
}

/**
 * 자유 대화방: system + [이전 대화 요약](user만) + 최근 2~4턴 + 마지막 user 원문.
 * 과거 assistant 전문을 무제한 재주입하지 않는다.
 */
export function buildFreeMessengerOpenAiMessages(
  transcript: readonly MessengerChatTurn[],
  personaLine: string,
  setup: MessengerTurnSetup
): { role: "system" | "user" | "assistant"; content: string }[] {
  const last = transcript[transcript.length - 1]!;
  if (last.role !== "user") {
    throw new Error("MESSENGER_EXPECT_LAST_USER");
  }
  const currentUser = String(last.content ?? "").trim();
  const prior = transcript.slice(0, -1);
  const summary = buildUserOnlyConversationSummary(prior);
  const recent = takeRecentPriorMessages(prior);
  const systemContent = buildMessengerSystemBlock(setup, personaLine);

  const out: { role: "system" | "user" | "assistant"; content: string }[] = [{ role: "system", content: systemContent }];
  if (summary.trim()) {
    out.push({ role: "user", content: `[이전 대화 요약]\n${summary.trim()}` });
  }
  out.push(...recent);
  out.push({ role: "user", content: currentUser });
  return out;
}

function appendHistoryFilterToMetaHeader(metaHeader: string, stats: MessengerAiHistoryFilterStats | null): string {
  if (!stats) return metaHeader;
  const block = formatMessengerAiHistoryFilterStats(stats);
  return metaHeader.trim() ? `${metaHeader.trim()}\n\n${block}` : block;
}

function serializeMessengerOpenAiMessagesForLog(p: {
  readonly roomId: string;
  readonly projectId: string | null;
  readonly layout: "free_windowed" | "legacy_tail";
  readonly apiMessages: readonly { role: string; content: string }[];
  readonly metaHeader?: string;
}): string {
  const chars = p.apiMessages.reduce((acc, m) => acc + String(m.content ?? "").length, 0);
  const block = p.apiMessages.map((m) => `[${m.role}]\n${m.content}`).join("\n\n---\n\n");
  const conv = truncConversationTail(block, MAX_LOG_CONVERSATION_CHARS);
  const tail = [
    `layout=${p.layout} messages=${p.apiMessages.length} approxChars=${chars}`,
    `[api_messages]\n${conv}`,
  ].join("\n\n---\n\n");
  if (p.metaHeader?.trim()) return `${p.metaHeader.trim()}\n\n---\n\n${tail}`;
  return [
    `roomId=${p.roomId.trim()}`,
    `projectId=${String(p.projectId ?? "").trim()}`,
    tail,
  ].join("\n\n---\n\n");
}

/**
 * 레거시(비자유·방어): 최근 접미사만 잘라 전체 대화를 한 덩어리로 전달.
 */
function takeMessengerTranscriptForApi(
  transcript: readonly MessengerChatTurn[],
  maxTotalChars: number
): { readonly messages: MessengerChatTurn[]; readonly droppedEarlier: boolean } {
  if (!transcript.length) return { messages: [], droppedEarlier: false };
  const n = transcript.length;
  const lastIdx = n - 1;
  const lastRaw = String(transcript[lastIdx]!.content ?? "").trim();
  if (lastRaw.length > maxTotalChars) {
    return {
      messages: [{ role: transcript[lastIdx]!.role, content: lastRaw.slice(Math.max(0, lastRaw.length - maxTotalChars)) }],
      droppedEarlier: lastIdx > 0 || lastRaw.length > maxTotalChars,
    };
  }
  let total = 0;
  let start = lastIdx;
  for (let i = lastIdx; i >= 0; i--) {
    const len = String(transcript[i]!.content ?? "").trim().length;
    if (total + len > maxTotalChars && i < lastIdx) break;
    total += len;
    start = i;
  }
  const droppedEarlier = start > 0;
  const messages = transcript.slice(start).map((m) => ({
    role: m.role,
    content: String(m.content ?? "").trim(),
  }));
  return { messages, droppedEarlier };
}

function stripJsonFences(text: string): string {
  let s = String(text ?? "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  return s;
}

export type MessengerAiTurnResult =
  | { ok: true; text: string; model: string }
  | { ok: false; code: string; message: string };

export async function runMessengerAiTurn(input: {
  userId: string;
  transcript: readonly { role: "user" | "assistant"; content: string }[];
  /** metadata-aware history filter (Pre-Project rooms) */
  readonly chatRows?: readonly ChatMessage[];
  logContext?: MessengerLlmLogContext;
}): Promise<MessengerAiTurnResult> {
  const ai = getPlatformAiMemberById(MESSENGER_DEFAULT_AI_CATALOG_KEY);
  const personaLine = ai?.persona ? `페르소나(참고): ${ai.persona}` : "";
  const turnSetup = await resolveMessengerTurnSetup(input.transcript, input.logContext, input.userId);
  const { transcript: filteredTranscript, stats: historyFilterStats } = applyMessengerAiHistoryFilter({
    transcript: input.transcript,
    classification: turnSetup.classification,
    chatRows: input.chatRows,
  });
  const logMetaHeader = appendHistoryFilterToMetaHeader(turnSetup.timelineMetaHeader, historyFilterStats);

  const freeRoom = isMessengerFreeRoom(input.logContext);
  let messages: { role: "system" | "user" | "assistant"; content: string }[];
  let outboundForLog: string;
  let layout: "free_windowed" | "legacy_tail";

  if (freeRoom) {
    try {
      messages = buildFreeMessengerOpenAiMessages(filteredTranscript, personaLine, turnSetup);
      layout = "free_windowed";
      outboundForLog = input.logContext
        ? serializeMessengerOpenAiMessagesForLog({
            roomId: input.logContext.roomId,
            projectId: input.logContext.projectId,
            layout,
            apiMessages: messages,
            metaHeader: logMetaHeader,
          })
        : "";
    } catch {
      const { messages: tail, droppedEarlier } = takeMessengerTranscriptForApi(
        filteredTranscript,
        MESSENGER_TRANSCRIPT_CHAR_BUDGET
      );
      const contextNote = droppedEarlier
        ? "\n\n[컨텍스트] 토큰 한도로 앞부분이 생략된 최근 발화만 포함됩니다."
        : "";
      const systemContent = buildLegacyTailSystemContent(turnSetup, personaLine, contextNote);
      messages = [{ role: "system", content: systemContent }, ...tail];
      layout = "legacy_tail";
      outboundForLog = input.logContext
        ? serializeMessengerOpenAiMessagesForLog({
            roomId: input.logContext.roomId,
            projectId: input.logContext.projectId,
            layout,
            apiMessages: messages,
            metaHeader: logMetaHeader,
          })
        : "";
    }
  } else {
    const { messages: tail, droppedEarlier } = takeMessengerTranscriptForApi(
      filteredTranscript,
      MESSENGER_TRANSCRIPT_CHAR_BUDGET
    );
    const contextNote = droppedEarlier
      ? "\n\n[컨텍스트] 토큰 한도로 앞부분이 생략된 최근 발화만 포함됩니다."
      : "";
    const systemContent = buildLegacyTailSystemContent(turnSetup, personaLine, contextNote);
    messages = [{ role: "system", content: systemContent }, ...tail];
    layout = "legacy_tail";
    outboundForLog = input.logContext
      ? serializeMessengerOpenAiMessagesForLog({
          roomId: input.logContext.roomId,
          projectId: input.logContext.projectId,
          layout,
          apiMessages: messages,
          metaHeader: logMetaHeader,
        })
      : "";
  }

  const { key, source } = await resolveUserOpenAiApiKey(input.userId);
  if (!key) {
    if (input.logContext) {
      await recordMessengerOpenAi({
        userId: input.userId,
        roomId: input.logContext.roomId,
        roomTitle: input.logContext.roomTitle,
        projectId: input.logContext.projectId,
        kind: "messenger_chat",
        model: null,
        outbound: outboundForLog || "(로그 없음)",
        ok: false,
        error:
          source === "missing"
            ? "OpenAI API 키가 없습니다. 설정에서 연동하거나 사용자 기본 키를 등록해 주세요."
            : "OpenAI API 키를 사용할 수 없습니다.",
      });
    }
    return {
      ok: false,
      code: "NO_KEY",
      message:
        source === "missing"
          ? "OpenAI API 키가 없습니다. 설정에서 연동하거나 사용자 기본 키를 등록해 주세요."
          : "OpenAI API 키를 사용할 수 없습니다.",
    };
  }
  const model = resolveOpenAiModelFromEnv();
  const res = await postOpenAiChatCompletion({
    apiKey: key,
    model,
    messages,
    temperature: 0.45,
    maxTokens: 950,
  });
  if (!res.ok) {
    if (input.logContext) {
      await recordMessengerOpenAi({
        userId: input.userId,
        roomId: input.logContext.roomId,
        roomTitle: input.logContext.roomTitle,
        projectId: input.logContext.projectId,
        kind: "messenger_chat",
        model,
        outbound: outboundForLog,
        ok: false,
        error: res.message,
      });
    }
    return { ok: false, code: res.code, message: res.message };
  }
  const text = sanitizeUnsupportedFuturePromise(String(res.text ?? "").trim());
  if (turnSetup.classification.scope === "pre_project") {
    const leakReason = preProjectScopeContaminationReason(text);
    if (leakReason) {
      console.warn("[messenger] pre-project execution scope contamination:", leakReason);
    }
  }
  if (!text) {
    if (input.logContext) {
      await recordMessengerOpenAi({
        userId: input.userId,
        roomId: input.logContext.roomId,
        roomTitle: input.logContext.roomTitle,
        projectId: input.logContext.projectId,
        kind: "messenger_chat",
        model,
        outbound: outboundForLog,
        ok: false,
        error: "모델 응답이 비어 있습니다.",
      });
    }
    return { ok: false, code: "EMPTY", message: "모델 응답이 비어 있습니다." };
  }
  if (input.logContext) {
    await recordMessengerOpenAi({
      userId: input.userId,
      roomId: input.logContext.roomId,
      roomTitle: input.logContext.roomTitle,
      projectId: input.logContext.projectId,
      kind: "messenger_chat",
      model,
      outbound: outboundForLog,
      ok: true,
      replyText: text,
    });
  }
  return { ok: true, text, model };
}

const PROJECT_DRAFT_SYSTEM = `당신은 제품 기획자입니다. 아래 대화를 바탕으로 프로젝트 초안을 JSON 한 개로만 출력하세요.
스키마(필수 키, 한국어 문자열 위주):
{
  "version": 1,
  "titleCandidates": string[3],
  "chosenTitle": string,
  "description": string,
  "problem": string,
  "targetUsers": string,
  "valueProposition": string,
  "mvpScope": string,
  "explicitExclusions": string,
  "featureCandidates": string[],
  "openQuestions": string[],
  "assumptions": string[],
  "confirmedFacts": string[],
  "recommendedAiMembers": string[],
  "nextSteps": string[]
}
확정된 사실과 AI 가정을 섞지 말고, assumptions에는 가정만, confirmedFacts에는 사용자가 말한 사실만 넣으세요.`;

export type MessengerDraftResult =
  | { ok: true; payload: ProjectFromChatDraftPayloadV1; model: string }
  | { ok: false; code: string; message: string };

export async function runMessengerProjectDraft(input: {
  userId: string;
  transcript: string;
  logContext?: MessengerLlmLogContext;
}): Promise<MessengerDraftResult> {
  const userBlock = `대화 로그:\n---\n${input.transcript.slice(0, MAX_LOG_TRANSCRIPT)}\n---\n위만 근거로 JSON을 채우세요.`;
  const { key, source } = await resolveUserOpenAiApiKey(input.userId);
  if (!key) {
    if (input.logContext) {
      await recordMessengerOpenAi({
        userId: input.userId,
        roomId: input.logContext.roomId,
        roomTitle: input.logContext.roomTitle,
        projectId: input.logContext.projectId,
        kind: "messenger_project_draft",
        model: null,
        outbound: [`roomId=${input.logContext.roomId}`, `projectId=${input.logContext.projectId ?? ""}`, `[system]\n${PROJECT_DRAFT_SYSTEM}`, `[user]\n${userBlock}`].join(
          "\n\n---\n\n"
        ),
        ok: false,
        error: source === "missing" ? "OpenAI API 키가 없습니다." : "OpenAI API 키를 사용할 수 없습니다.",
      });
    }
    return {
      ok: false,
      code: "NO_KEY",
      message: source === "missing" ? "OpenAI API 키가 없습니다." : "OpenAI API 키를 사용할 수 없습니다.",
    };
  }
  const model = resolveOpenAiModelFromEnv();
  const res = await postOpenAiChatCompletion({
    apiKey: key,
    model,
    messages: [
      { role: "system", content: PROJECT_DRAFT_SYSTEM },
      {
        role: "user",
        content: userBlock,
      },
    ],
    temperature: 0.3,
    maxTokens: 2500,
    responseFormatJsonObject: true,
  });

  const logOutbound = () =>
    [`roomId=${input.logContext?.roomId ?? ""}`, `projectId=${input.logContext?.projectId ?? ""}`, `[system]\n${PROJECT_DRAFT_SYSTEM}`, `[user]\n${userBlock}`].join(
      "\n\n---\n\n"
    );

  if (!res.ok) {
    if (input.logContext) {
      await recordMessengerOpenAi({
        userId: input.userId,
        roomId: input.logContext.roomId,
        roomTitle: input.logContext.roomTitle,
        projectId: input.logContext.projectId,
        kind: "messenger_project_draft",
        model,
        outbound: logOutbound(),
        ok: false,
        error: res.message,
      });
    }
    return { ok: false, code: res.code, message: res.message };
  }
  const raw = stripJsonFences(res.text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    if (input.logContext) {
      await recordMessengerOpenAi({
        userId: input.userId,
        roomId: input.logContext.roomId,
        roomTitle: input.logContext.roomTitle,
        projectId: input.logContext.projectId,
        kind: "messenger_project_draft",
        model,
        outbound: logOutbound(),
        ok: false,
        replyText: String(res.text ?? "").trim() || undefined,
        error: "초안 JSON 파싱에 실패했습니다.",
      });
    }
    return { ok: false, code: "JSON", message: "초안 JSON 파싱에 실패했습니다." };
  }
  if (!parsed || typeof parsed !== "object") {
    if (input.logContext) {
      await recordMessengerOpenAi({
        userId: input.userId,
        roomId: input.logContext.roomId,
        roomTitle: input.logContext.roomTitle,
        projectId: input.logContext.projectId,
        kind: "messenger_project_draft",
        model,
        outbound: logOutbound(),
        ok: false,
        error: "초안 형식이 올바르지 않습니다.",
      });
    }
    return { ok: false, code: "JSON", message: "초안 형식이 올바르지 않습니다." };
  }
  const o = parsed as Record<string, unknown>;
  if (Number(o.version) !== 1) {
    if (input.logContext) {
      await recordMessengerOpenAi({
        userId: input.userId,
        roomId: input.logContext.roomId,
        roomTitle: input.logContext.roomTitle,
        projectId: input.logContext.projectId,
        kind: "messenger_project_draft",
        model,
        outbound: logOutbound(),
        ok: false,
        error: "version은 1이어야 합니다.",
      });
    }
    return { ok: false, code: "JSON", message: "version은 1이어야 합니다." };
  }
  const payload: ProjectFromChatDraftPayloadV1 = {
    version: 1,
    titleCandidates: Array.isArray(o.titleCandidates) ? o.titleCandidates.map((x) => String(x)) : [],
    chosenTitle: String(o.chosenTitle ?? "").trim(),
    description: String(o.description ?? "").trim(),
    problem: String(o.problem ?? "").trim(),
    targetUsers: String(o.targetUsers ?? "").trim(),
    valueProposition: String(o.valueProposition ?? "").trim(),
    mvpScope: String(o.mvpScope ?? "").trim(),
    explicitExclusions: String(o.explicitExclusions ?? "").trim(),
    featureCandidates: Array.isArray(o.featureCandidates) ? o.featureCandidates.map((x) => String(x)) : [],
    openQuestions: Array.isArray(o.openQuestions) ? o.openQuestions.map((x) => String(x)) : [],
    assumptions: Array.isArray(o.assumptions) ? o.assumptions.map((x) => String(x)) : [],
    confirmedFacts: Array.isArray(o.confirmedFacts) ? o.confirmedFacts.map((x) => String(x)) : [],
    recommendedAiMembers: Array.isArray(o.recommendedAiMembers) ? o.recommendedAiMembers.map((x) => String(x)) : [],
    nextSteps: Array.isArray(o.nextSteps) ? o.nextSteps.map((x) => String(x)) : [],
  };
  if (!payload.chosenTitle) {
    if (input.logContext) {
      await recordMessengerOpenAi({
        userId: input.userId,
        roomId: input.logContext.roomId,
        roomTitle: input.logContext.roomTitle,
        projectId: input.logContext.projectId,
        kind: "messenger_project_draft",
        model,
        outbound: logOutbound(),
        ok: false,
        replyText: raw.slice(0, 8000),
        error: "chosenTitle이 비어 있습니다.",
      });
    }
    return { ok: false, code: "JSON", message: "chosenTitle이 비어 있습니다." };
  }
  if (input.logContext) {
    await recordMessengerOpenAi({
      userId: input.userId,
      roomId: input.logContext.roomId,
      roomTitle: input.logContext.roomTitle,
      projectId: input.logContext.projectId,
      kind: "messenger_project_draft",
      model,
      outbound: logOutbound(),
      ok: true,
      replyText: raw.slice(0, 12_000),
    });
  }
  return { ok: true, payload, model };
}
