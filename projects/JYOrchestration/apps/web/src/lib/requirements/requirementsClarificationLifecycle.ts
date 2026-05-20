/**
 * Clarification lifecycle — timeout & unrelated-message abandonment (no auto-resolve).
 */

import { CLARIFICATION_TIMEOUT_MS, CLARIFICATION_UNRELATED_MESSAGE_MAX } from "@/lib/requirements/requirementsOrchestrationConstants";
import type { IntentClarificationWire } from "@/lib/requirements/requirementsIntentOrchestrationWire";
import { buildClarificationPendingState } from "@/lib/requirements/requirementsIntentClarification";

export type ClarificationLifecycleEvent =
  | "active"
  | "unrelated_increment"
  | "abandoned_timeout"
  | "abandoned_unrelated"
  | "resolved"
  | "cleared";

export function enrichClarificationWithLifecycle(
  clarification: IntentClarificationWire,
  nowMs: number = Date.now(),
): IntentClarificationWire {
  if (!clarification.pending) return clarification;
  const createdAt = clarification.createdAt ?? clarification.askedAt ?? new Date(nowMs).toISOString();
  const expiresAt =
    clarification.expiresAt ??
    new Date(Date.parse(createdAt) + CLARIFICATION_TIMEOUT_MS).toISOString();
  return {
    ...clarification,
    createdAt,
    expiresAt,
    retryCount: clarification.retryCount ?? 0,
    unrelatedMessageCount: clarification.unrelatedMessageCount ?? 0,
    abandoned: clarification.abandoned === true,
  };
}

export function isClarificationExpired(clarification: IntentClarificationWire, nowMs: number = Date.now()): boolean {
  if (!clarification.pending || clarification.abandoned) return false;
  const exp = clarification.expiresAt ? Date.parse(clarification.expiresAt) : NaN;
  return Number.isFinite(exp) && nowMs > exp;
}

export function abandonClarification(input: {
  readonly clarification: IntentClarificationWire;
  readonly reason: "timeout" | "unrelated";
  readonly nowIso?: string;
}): IntentClarificationWire {
  return {
    ...input.clarification,
    pending: false,
    abandoned: true,
    abandonedAt: input.nowIso ?? new Date().toISOString(),
    abandonedReason: input.reason,
  };
}

export function tickClarificationOnUserMessage(input: {
  readonly clarification: IntentClarificationWire | undefined;
  readonly treatedAsResolution: boolean;
  readonly nowMs?: number;
}): Readonly<{
  readonly clarification: IntentClarificationWire | undefined;
  readonly event?: ClarificationLifecycleEvent;
  readonly timelineNote?: string;
}> {
  const nowMs = input.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  if (!input.clarification?.pending || input.clarification.abandoned) {
    return { clarification: input.clarification };
  }

  let c = enrichClarificationWithLifecycle(input.clarification, nowMs);

  if (input.treatedAsResolution) {
    return { clarification: { pending: false }, event: "resolved", timelineNote: "clarification:resolved" };
  }

  if (isClarificationExpired(c, nowMs)) {
    c = abandonClarification({ clarification: c, reason: "timeout", nowIso });
    return {
      clarification: c,
      event: "abandoned_timeout",
      timelineNote: "clarification:abandoned:timeout",
    };
  }

  const unrelated = (c.unrelatedMessageCount ?? 0) + 1;
  c = { ...c, unrelatedMessageCount: unrelated, retryCount: (c.retryCount ?? 0) + 1 };

  if (unrelated >= CLARIFICATION_UNRELATED_MESSAGE_MAX) {
    c = abandonClarification({ clarification: c, reason: "unrelated", nowIso });
    return {
      clarification: c,
      event: "abandoned_unrelated",
      timelineNote: `clarification:abandoned:unrelated:${unrelated}`,
    };
  }

  return {
    clarification: c,
    event: "unrelated_increment",
    timelineNote: `clarification:unrelated:${unrelated}`,
  };
}

export function wrapNewClarificationPending(input: {
  readonly question: string;
  readonly topic?: IntentClarificationWire["topic"];
  readonly candidateActionIds?: readonly import("@/lib/requirements/requirementsQuickActionRegistry").QuickActionId[];
  readonly nowIso?: string;
}): IntentClarificationWire {
  const base = buildClarificationPendingState(input);
  return enrichClarificationWithLifecycle(base, input.nowIso ? Date.parse(input.nowIso) : Date.now());
}
