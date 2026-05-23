/**
 * Orchestration session recovery after reload — no hidden transitions.
 */

import { clearIntentRouterCache } from "@/lib/requirements/requirementsIntentRouterCache";
import { compactRequirementsIntentOrchestration } from "@/lib/requirements/requirementsOrchestrationCompaction";
import {
  enrichClarificationWithLifecycle,
  isClarificationExpired,
  abandonClarification,
} from "@/lib/requirements/requirementsClarificationLifecycle";
import { mergeIntentOrchestrationPatch } from "@/lib/requirements/requirementsIntentOrchestrationWire";
import type { RequirementsIntentOrchestrationV1 } from "@/lib/requirements/requirementsIntentOrchestrationWire";

function newOrchestrationSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `orch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function orchestrationRecoveryFingerprint(orch: RequirementsIntentOrchestrationV1): string {
  const c = orch.clarification;
  return [
    orch.orchestrationSessionId ?? "",
    c?.pending ? "1" : "0",
    c?.abandoned ? "1" : "0",
    String(orch.recentConversationSummary?.length ?? 0),
    String(orch.recommendationQueue?.length ?? 0),
    String(orch.recentTransitions?.length ?? 0),
  ].join("|");
}

export function recoverRequirementsIntentOrchestration(
  prev: RequirementsIntentOrchestrationV1 | null | undefined,
  nowMs: number = Date.now(),
): RequirementsIntentOrchestrationV1 {
  const nowIso = new Date(nowMs).toISOString();
  let didRecover = false;

  const needsSession = !String(prev?.orchestrationSessionId ?? "").trim();
  let orch = mergeIntentOrchestrationPatch(prev, {
    orchestrationSessionId: prev?.orchestrationSessionId?.trim() || newOrchestrationSessionId(),
  });
  if (needsSession) didRecover = true;

  const pendingClarification = orch.clarification;
  if (pendingClarification?.pending) {
    const enriched = enrichClarificationWithLifecycle(pendingClarification, nowMs);
    orch = { ...orch, clarification: enriched };
    if (isClarificationExpired(enriched, nowMs)) {
      didRecover = true;
      orch = {
        ...orch,
        clarification: abandonClarification({
          clarification: enriched,
          reason: "timeout",
          nowIso,
        }),
      };
    }
  }

  const fpBefore = orchestrationRecoveryFingerprint(orch);
  orch = compactRequirementsIntentOrchestration(orch, nowMs);
  if (orchestrationRecoveryFingerprint(orch) !== fpBefore) didRecover = true;

  if (didRecover) {
    orch = mergeIntentOrchestrationPatch(orch, { lastRecoveredAt: nowIso });
  } else if (prev?.lastRecoveredAt) {
    orch = mergeIntentOrchestrationPatch(orch, { lastRecoveredAt: prev.lastRecoveredAt });
  }

  clearIntentRouterCache();
  return orch;
}
