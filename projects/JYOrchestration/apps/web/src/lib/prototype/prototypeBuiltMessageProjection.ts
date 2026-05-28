import type { PrototypeChatAction, PrototypeChatBlock, PrototypeChatBuiltMessage } from "@/lib/prototype/buildPrototypeChatMessages";
import {
  hasValidImplementationLeadBootstrap,
  leadDeveloperMessageHasForbiddenEnvDetail,
  sanitizeImplementationConversationMessages,
} from "@/lib/prototype/implementationOrchestrationSummary";
import { hasValidImplementationTaskListBootstrap } from "@/lib/prototype/implementationTaskListEntryMessage";
import { PROTOTYPE_EXECUTION_DERIVED_INTERNAL_TYPE } from "@/lib/prototype/prototypeExecutionSingleChatTypes";
import {
  dedupeRequirementsMessagesById,
  newRequirementsMessage,
  type RequirementsMessage,
} from "@/lib/requirements/requirementsMessage";
import { displayedWorkspaceAiTitle } from "@/lib/ai-member/visibleAiOrchestrator";

function blockLines(blocks: readonly PrototypeChatBlock[] | undefined): string[] {
  if (!blocks?.length) return [];
  const lines: string[] = [];
  for (const b of blocks) {
    if (b.kind === "text") lines.push(b.text);
    else if (b.kind === "env_table") {
      for (const r of b.rows) lines.push(`${r.label}: ${r.state}`);
    } else if (b.kind === "ordered_titles") {
      for (const it of b.items) lines.push(`${it.order}. ${it.title}`);
    } else if (b.kind === "pipeline_grid") {
      for (const r of b.rows) lines.push(`${r.label}: ${r.stateKo}`);
    } else if (b.kind === "bullet_list") lines.push(...b.items);
    else if (b.kind === "url_line") lines.push(b.url);
    else if (b.kind === "planner_stage_progress") lines.push(`작업계획 생성 진행 (${b.currentStep}/5)`);
  }
  return lines;
}

function builtMessagePlainText(m: PrototypeChatBuiltMessage): string {
  const parts: string[] = [];
  if (m.title?.trim()) parts.push(m.title.trim());
  if (m.body?.trim()) parts.push(m.body.trim());
  const bl = blockLines(m.blocks);
  if (bl.length) parts.push(bl.join("\n"));
  return parts.join("\n\n");
}

function syntheticCreatedAt(orderKey: number): string {
  const base = Date.UTC(2026, 0, 1, 0, 0, 0);
  return new Date(base + orderKey).toISOString();
}

export function prototypeBuiltMessageToRequirementsMessage(m: PrototypeChatBuiltMessage): RequirementsMessage {
  const plain = builtMessagePlainText(m);
  const suggestions = (m.actions ?? []).map((a) => a.label).filter(Boolean);
  const isSystem = m.role === "system";
  const aiTitle = displayedWorkspaceAiTitle("prototype_build");

  return newRequirementsMessage({
    id: `proto-derived-${m.id}`,
    role: isSystem ? "system" : m.role === "ai" ? "ai" : "user",
    speakerType: isSystem ? "SYSTEM" : m.role === "ai" ? "AI" : "USER",
    speakerId: isSystem ? "system" : m.role === "ai" ? "prototype_build" : "me",
    speakerName: isSystem ? "시스템" : m.role === "ai" ? aiTitle : "나",
    messageType: isSystem ? "NOTICE" : "STATEMENT",
    content: plain || m.title || " ",
    createdAt: syntheticCreatedAt(m.orderKey),
    meta: {
      internalType: PROTOTYPE_EXECUTION_DERIVED_INTERNAL_TYPE,
      serviceDesignStage: "implementation",
      interviewSuggestions: suggestions.length ? suggestions : undefined,
      interviewAllowCustomInput: true,
      prototypeOrderKey: m.orderKey,
    },
  });
}

export function buildPrototypeActionLabelMap(
  built: readonly PrototypeChatBuiltMessage[],
): ReadonlyMap<string, PrototypeChatAction> {
  const map = new Map<string, PrototypeChatAction>();
  for (const m of built) {
    for (const a of m.actions ?? []) {
      const label = String(a.label ?? "").trim();
      if (label) map.set(label, a);
    }
  }
  return map;
}

function isLegacyImplementationOrchestrationBuiltMessage(m: PrototypeChatBuiltMessage): boolean {
  const text = builtMessagePlainText(m);
  if (m.id === "ai-env-check" || m.id === "ai-env-ready") return true;
  if (text.includes("현재 개발 준비 상태")) return true;
  if (/^AI검수자:/m.test(text) || /^AI보안관:/m.test(text)) return true;
  if (/^SCM:/m.test(text) && text.includes("Git 저장소")) return true;
  if (leadDeveloperMessageHasForbiddenEnvDetail(text)) return true;
  return false;
}

export function projectPrototypeBuiltMessagesToRequirements(
  built: readonly PrototypeChatBuiltMessage[],
): { readonly messages: readonly RequirementsMessage[]; readonly actionByLabel: ReadonlyMap<string, PrototypeChatAction> } {
  const filtered = built.filter((m) => !isLegacyImplementationOrchestrationBuiltMessage(m));
  return {
    messages: filtered.map(prototypeBuiltMessageToRequirementsMessage),
    actionByLabel: buildPrototypeActionLabelMap(filtered),
  };
}

export function mergePrototypeExecutionChatTimeline(
  derived: readonly RequirementsMessage[],
  conversation: readonly RequirementsMessage[],
): RequirementsMessage[] {
  const persisted = conversation.filter((m) => m.meta.internalType !== PROTOTYPE_EXECUTION_DERIVED_INTERNAL_TYPE);
  const hasImplementationBootstrap =
    hasValidImplementationLeadBootstrap(persisted) || hasValidImplementationTaskListBootstrap(persisted);
  const filteredDerived = hasImplementationBootstrap
    ? derived.filter((m) => m.id !== "proto-derived-ai-preplan")
    : derived;
  const sortKey = (m: RequirementsMessage) => {
    const k = m.meta.prototypeOrderKey;
    if (typeof k === "number" && Number.isFinite(k)) return k;
    const t = Date.parse(m.createdAt);
    return Number.isFinite(t) ? t : 0;
  };
  return dedupeRequirementsMessagesById(
    [...filteredDerived, ...persisted].sort((a, b) => sortKey(a) - sortKey(b)),
  );
}

export function filterPersistedPrototypeExecutionMessages(
  messages: readonly RequirementsMessage[],
): RequirementsMessage[] {
  return sanitizeImplementationConversationMessages(
    messages.filter((m) => m.meta.internalType !== PROTOTYPE_EXECUTION_DERIVED_INTERNAL_TYPE),
  ).slice(-400);
}
