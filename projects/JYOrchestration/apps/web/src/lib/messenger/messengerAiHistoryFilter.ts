import type { ConversationIntentClassification } from "@/lib/conversation-core/conversationIntentTypes";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { isAiWorkNoteSummaryMessage } from "@/lib/worknote/buildConversationContentHtmlForWorkNoteSummary";

export type MessengerAiHistoryTurn = Readonly<{
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly meta?: Readonly<{
    readonly internalType?: string;
    readonly kind?: string;
  }>;
}>;

export type MessengerAiHistoryFilterReason =
  | "include"
  | "empty"
  | "ai_summary_block"
  | "system_auto_reply_notice"
  | "prompt_timeline_or_meta"
  | "project_draft_artifact_in_brainstorm"
  | "project_conversion_artifact"
  | "unknown_derived_artifact";

export type MessengerAiHistoryFilterDecision = Readonly<{
  readonly include: boolean;
  readonly reason: MessengerAiHistoryFilterReason;
}>;

export type MessengerAiHistoryFilterStats = Readonly<{
  readonly inputMessages: number;
  readonly includedMessages: number;
  readonly excludedByReason: Readonly<Partial<Record<MessengerAiHistoryFilterReason, number>>>;
}>;

const PROMPT_TIMELINE_META_RE = /\[(?:promptMeta|api_messages|contextBlocks|inspectionResult)\]/i;

const PROJECT_CONVERSION_ARTIFACT_RE =
  /프로젝트(로)?\s*전환|프로젝트\s*생성|프로젝트가\s*만들어졌습니다|프로젝트\s*승격|초안\s*JSON/i;

export function isMessengerSystemAutoReplyNotice(content: string): boolean {
  return /AI\s*기획자가\s*메시지에\s*자동으로\s*응답합니다/i.test(String(content ?? "").trim());
}

function isPromptTimelineOrMetaMessage(content: string): boolean {
  const t = String(content ?? "").trim();
  if (!t) return false;
  if (PROMPT_TIMELINE_META_RE.test(t)) return true;
  if (t.startsWith("[historyFilter]")) return true;
  return false;
}

function looksLikeProjectDraftArtifact(content: string): boolean {
  const t = String(content ?? "").trim();
  if (!t) return false;
  if (/^\*\*프로젝트 초안\*\*/m.test(t)) return true;
  if (/프로젝트 초안/.test(t)) {
    let hits = 0;
    if (/서비스 한 줄 요약/.test(t)) hits++;
    if (/목표 사용자/.test(t)) hits++;
    if (/핵심 가치/.test(t)) hits++;
    if (/범위 초안/.test(t)) hits++;
    if (hits >= 2) return true;
  }
  if (/프로젝트 승격/.test(t) && /초안\s*JSON/i.test(t)) return true;
  return false;
}

function looksLikeProjectConversionArtifact(content: string): boolean {
  return PROJECT_CONVERSION_ARTIFACT_RE.test(String(content ?? "").trim());
}

function isAiSummaryTurn(turn: MessengerAiHistoryTurn): boolean {
  if (turn.meta?.internalType === "ai_work_note_summary") return true;
  if (turn.meta?.kind === "ai_work_note_summary") return true;
  const body = String(turn.content ?? "").trim();
  return turn.role === "assistant" && body.startsWith("【AI 요약 정리】");
}

function requirementsMessageToTurn(message: RequirementsMessage): MessengerAiHistoryTurn | null {
  if (message.role === "system") {
    return {
      role: "assistant",
      content: message.content,
      meta: { internalType: message.meta?.internalType },
    };
  }
  if (message.role === "user") {
    return { role: "user", content: message.content, meta: { internalType: message.meta?.internalType } };
  }
  if (message.role === "ai" || message.role === "human") {
    return {
      role: "assistant",
      content: message.content,
      meta: { internalType: message.meta?.internalType },
    };
  }
  return null;
}

export function shouldIncludeTurnForMessengerAiHistory(
  turn: MessengerAiHistoryTurn,
  classification?: ConversationIntentClassification | null
): MessengerAiHistoryFilterDecision {
  const content = String(turn.content ?? "").trim();
  if (!content) {
    return { include: false, reason: "empty" };
  }

  if (isAiSummaryTurn(turn)) {
    return { include: false, reason: "ai_summary_block" };
  }

  if (isMessengerSystemAutoReplyNotice(content)) {
    return { include: false, reason: "system_auto_reply_notice" };
  }

  if (isPromptTimelineOrMetaMessage(content)) {
    return { include: false, reason: "prompt_timeline_or_meta" };
  }

  const mode = classification?.mode ?? null;
  if (mode === "brainstorm" && turn.role === "assistant") {
    if (looksLikeProjectDraftArtifact(content)) {
      return { include: false, reason: "project_draft_artifact_in_brainstorm" };
    }
    if (looksLikeProjectConversionArtifact(content)) {
      return { include: false, reason: "project_conversion_artifact" };
    }
  }

  return { include: true, reason: "include" };
}

export function shouldIncludeMessageForMessengerAiHistory(
  message: RequirementsMessage,
  classification?: ConversationIntentClassification | null
): MessengerAiHistoryFilterDecision {
  if (isAiWorkNoteSummaryMessage(message)) {
    return { include: false, reason: "ai_summary_block" };
  }
  const turn = requirementsMessageToTurn(message);
  if (!turn) {
    return { include: false, reason: "empty" };
  }
  return shouldIncludeTurnForMessengerAiHistory(turn, classification);
}

function bumpExcluded(
  excludedByReason: Partial<Record<MessengerAiHistoryFilterReason, number>>,
  reason: MessengerAiHistoryFilterReason
): void {
  if (reason === "include") return;
  excludedByReason[reason] = (excludedByReason[reason] ?? 0) + 1;
}

export function filterMessengerHistoryTurnsForAiHistoryWithStats(
  turns: readonly MessengerAiHistoryTurn[],
  classification?: ConversationIntentClassification | null,
  options?: { readonly maxMessages?: number }
): Readonly<{ readonly turns: readonly MessengerAiHistoryTurn[]; readonly stats: MessengerAiHistoryFilterStats }> {
  const excludedByReason: Partial<Record<MessengerAiHistoryFilterReason, number>> = {};
  const included: MessengerAiHistoryTurn[] = [];

  for (const turn of turns) {
    const decision = shouldIncludeTurnForMessengerAiHistory(turn, classification);
    if (decision.include) {
      included.push(turn);
    } else {
      bumpExcluded(excludedByReason, decision.reason);
    }
  }

  const max = options?.maxMessages;
  const trimmed = max != null && max > 0 ? included.slice(-max) : included;

  return {
    turns: trimmed,
    stats: {
      inputMessages: turns.length,
      includedMessages: trimmed.length,
      excludedByReason,
    },
  };
}

export function filterMessengerMessagesForAiHistory(
  messages: readonly RequirementsMessage[],
  classification?: ConversationIntentClassification | null,
  options?: { readonly maxMessages?: number }
): readonly RequirementsMessage[] {
  const included = messages.filter(
    (m) => shouldIncludeMessageForMessengerAiHistory(m, classification).include
  );
  const max = options?.maxMessages;
  return max != null && max > 0 ? included.slice(-max) : included;
}

export function filterMessengerHistoryTurnsForAiHistory(
  turns: readonly MessengerAiHistoryTurn[],
  classification?: ConversationIntentClassification | null,
  options?: { readonly maxMessages?: number }
): readonly MessengerAiHistoryTurn[] {
  return filterMessengerHistoryTurnsForAiHistoryWithStats(turns, classification, options).turns;
}

export function formatMessengerAiHistoryFilterStats(stats: MessengerAiHistoryFilterStats): string {
  const lines = [
    "[historyFilter]",
    `inputMessages=${stats.inputMessages}`,
    `includedMessages=${stats.includedMessages}`,
  ];
  const reasonOrder: MessengerAiHistoryFilterReason[] = [
    "empty",
    "ai_summary_block",
    "system_auto_reply_notice",
    "prompt_timeline_or_meta",
    "project_draft_artifact_in_brainstorm",
    "project_conversion_artifact",
    "unknown_derived_artifact",
  ];
  for (const reason of reasonOrder) {
    const count = stats.excludedByReason[reason] ?? 0;
    if (count > 0) lines.push(`${reason}=${count}`);
  }
  return lines.join("\n");
}
