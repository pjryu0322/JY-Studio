/**
 * Orchestration session recovery after reload — no hidden transitions.
 */

import { clearIntentRouterCache } from "@/lib/requirements/requirementsIntentRouterCache";
import { compactRequirementsIntentOrchestration } from "@/lib/requirements/requirementsOrchestrationCompaction";
import { enrichClarificationWithLifecycle, isClarificationExpired, abandonClarification } from "@/lib/requirements/requirementsClarificationLifecycle";
import { mergeIntentOrchestrationPatch } from "@/lib/requirements/requirementsIntentOrchestrationWire";
import type { RequirementsIntentOrchestrationV1 } from "@/lib/requirements/requirementsIntentOrchestrationWire";

function newOrchestrationSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `orch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function recoverRequirementsIntentOrchestration(
  prev: RequirementsIntentOrchestrationV1 | null | undefined,
  nowMs: number = Date.now(),
): RequirementsIntentOrchestrationV1 {
  const nowIso = new Date(nowMs).toISOString();
  let orch = mergeIntentOrchestrationPatch(prev, {
    orchestrationSessionId: prev?.orchestrationSessionId ?? newOrchestrationSessionId(),
    lastRecoveredAt: nowIso,
  });

  const pendingClarification = orch.clarification;
  if (pendingClarification?.pending) {
    const enriched = enrichClarificationWithLifecycle(pendingClarification, nowMs);
    orch = { ...orch, clarification: enriched };
    if (isClarificationExpired(enriched, nowMs)) {
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

  orch = compactRequirementsIntentOrchestration(orch, nowMs);
  clearIntentRouterCache();
  return orch;
}
