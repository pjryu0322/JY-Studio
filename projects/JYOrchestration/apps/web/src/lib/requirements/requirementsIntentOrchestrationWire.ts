/**
 * Intent orchestration wire — clarification, focus, routing memory (persisted in state JSON).
 */

import { isQuickActionId, type QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";
import type { IntentRouterMode } from "@/lib/requirements/requirementsIntentRouterTypes";

export type ConversationFocusType = "feature" | "step" | "actor" | "screen" | "api" | "flow" | "none";

export type ConversationFocusWire = Readonly<{
  readonly type: ConversationFocusType;
  readonly id: string;
  readonly label?: string;
}>;

export type IntentClarificationTopic =
  | "feature_target"
  | "target_resolution"
  | "action_choice"
  | "stage_next"
  | "general";

export type IntentClarificationWire = Readonly<{
  readonly pending: boolean;
  readonly topic?: IntentClarificationTopic;
  readonly question?: string;
  readonly candidateActionIds?: readonly QuickActionId[];
  readonly askedAt?: string;
}>;

export type IntentRoutingMemoryWire = Readonly<{
  readonly routerMode?: IntentRouterMode;
  readonly routingReason?: string;
  readonly guardReason?: string;
  readonly fallbackReason?: string;
  readonly focusReason?: string;
  readonly confidenceFactors?: readonly string[];
  readonly at?: string;
}>;

export type RequirementsIntentOrchestrationV1 = Readonly<{
  readonly version: 1;
  readonly updatedAt: string;
  readonly activeFocus?: ConversationFocusWire;
  readonly currentEditingTarget?: Readonly<{
    readonly featureId?: string;
    readonly stepId?: string;
    readonly actorId?: string;
  }>;
  readonly lastSuggestedActionId?: QuickActionId | null;
  readonly lastConfirmedActionId?: QuickActionId | null;
  readonly clarification?: IntentClarificationWire;
  readonly recentConversationSummary?: string;
  readonly lastRouting?: IntentRoutingMemoryWire;
}>;

const FOCUS_TYPES = new Set<ConversationFocusType>([
  "feature",
  "step",
  "actor",
  "screen",
  "api",
  "flow",
  "none",
]);

export function parseRequirementsIntentOrchestrationV1(raw: unknown): RequirementsIntentOrchestrationV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (Number(o.version) !== 1) return null;
  const updatedAt = String(o.updatedAt ?? "").trim();
  if (!updatedAt) return null;

  let activeFocus: ConversationFocusWire | undefined;
  if (o.activeFocus && typeof o.activeFocus === "object") {
    const f = o.activeFocus as Record<string, unknown>;
    const type = String(f.type ?? "").trim() as ConversationFocusType;
    const id = String(f.id ?? "").trim();
    if (FOCUS_TYPES.has(type) && id) {
      activeFocus = {
        type,
        id,
        ...(typeof f.label === "string" && f.label.trim() ? { label: f.label.trim().slice(0, 120) } : {}),
      };
    }
  }

  let clarification: IntentClarificationWire | undefined;
  if (o.clarification && typeof o.clarification === "object") {
    const c = o.clarification as Record<string, unknown>;
    const pending = c.pending === true;
    const candidateActionIds = Array.isArray(c.candidateActionIds)
      ? c.candidateActionIds
          .map((x) => String(x ?? "").trim())
          .filter((id): id is QuickActionId => isQuickActionId(id))
          .slice(0, 8)
      : undefined;
    clarification = {
      pending,
      ...(typeof c.topic === "string" ? { topic: c.topic.trim() as IntentClarificationTopic } : {}),
      ...(typeof c.question === "string" ? { question: c.question.trim().slice(0, 500) } : {}),
      ...(candidateActionIds?.length ? { candidateActionIds } : {}),
      ...(typeof c.askedAt === "string" ? { askedAt: c.askedAt } : {}),
    };
  }

  const lastSuggested = o.lastSuggestedActionId;
  const lastConfirmed = o.lastConfirmedActionId;

  return {
    version: 1,
    updatedAt,
    ...(activeFocus ? { activeFocus } : {}),
    ...(o.currentEditingTarget && typeof o.currentEditingTarget === "object"
      ? {
          currentEditingTarget: {
            ...(typeof (o.currentEditingTarget as Record<string, unknown>).featureId === "string"
              ? { featureId: String((o.currentEditingTarget as Record<string, unknown>).featureId).trim() }
              : {}),
            ...(typeof (o.currentEditingTarget as Record<string, unknown>).stepId === "string"
              ? { stepId: String((o.currentEditingTarget as Record<string, unknown>).stepId).trim() }
              : {}),
            ...(typeof (o.currentEditingTarget as Record<string, unknown>).actorId === "string"
              ? { actorId: String((o.currentEditingTarget as Record<string, unknown>).actorId).trim() }
              : {}),
          },
        }
      : {}),
    ...(lastSuggested === null || isQuickActionId(lastSuggested)
      ? { lastSuggestedActionId: lastSuggested === null ? null : (lastSuggested as QuickActionId) }
      : {}),
    ...(lastConfirmed === null || isQuickActionId(lastConfirmed)
      ? { lastConfirmedActionId: lastConfirmed === null ? null : (lastConfirmed as QuickActionId) }
      : {}),
    ...(clarification ? { clarification } : {}),
    ...(typeof o.recentConversationSummary === "string"
      ? { recentConversationSummary: o.recentConversationSummary.trim().slice(0, 2000) }
      : {}),
    ...(o.lastRouting && typeof o.lastRouting === "object" ? { lastRouting: o.lastRouting as IntentRoutingMemoryWire } : {}),
  };
}

export function mergeIntentOrchestrationPatch(
  prev: RequirementsIntentOrchestrationV1 | null | undefined,
  patch: Partial<RequirementsIntentOrchestrationV1>,
  nowIso?: string,
): RequirementsIntentOrchestrationV1 {
  const now = nowIso ?? new Date().toISOString();
  const base = prev ?? { version: 1 as const, updatedAt: now };
  return {
    ...base,
    ...patch,
    version: 1,
    updatedAt: now,
    ...(patch.clarification !== undefined ? { clarification: patch.clarification } : {}),
    ...(patch.activeFocus !== undefined ? { activeFocus: patch.activeFocus } : {}),
    ...(patch.lastRouting !== undefined ? { lastRouting: patch.lastRouting } : {}),
  };
}
