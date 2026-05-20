/**
 * Orchestration state compaction — bounded growth.
 */

import {
  MAX_ARCHIVED_FOCUSES,
  MAX_ORCHESTRATION_RECOMMENDATIONS,
  MAX_ORCHESTRATION_SUMMARY_CHARS,
  MAX_RECENT_TRANSITIONS,
} from "@/lib/requirements/requirementsOrchestrationConstants";
import { isClarificationExpired } from "@/lib/requirements/requirementsClarificationLifecycle";
import type { RequirementsIntentOrchestrationV1 } from "@/lib/requirements/requirementsIntentOrchestrationWire";

export function compactRequirementsIntentOrchestration(
  orch: RequirementsIntentOrchestrationV1,
  nowMs: number = Date.now(),
): RequirementsIntentOrchestrationV1 {
  let next = { ...orch };

  if (next.recentConversationSummary && next.recentConversationSummary.length > MAX_ORCHESTRATION_SUMMARY_CHARS) {
    const tail = next.recentConversationSummary.slice(-MAX_ORCHESTRATION_SUMMARY_CHARS);
    next = {
      ...next,
      recentConversationSummary: `…${tail}`,
    };
  }

  if (next.recommendationQueue && next.recommendationQueue.length > MAX_ORCHESTRATION_RECOMMENDATIONS) {
    next = {
      ...next,
      recommendationQueue: [...next.recommendationQueue]
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_ORCHESTRATION_RECOMMENDATIONS),
    };
  }

  if (next.clarification?.pending && isClarificationExpired(next.clarification, nowMs)) {
    next = {
      ...next,
      clarification: {
        ...next.clarification,
        pending: false,
        abandoned: true,
        abandonedReason: "timeout",
        abandonedAt: new Date(nowMs).toISOString(),
      },
    };
  }

  if (next.activeFocus?.softStale) {
    const archived = [...(next.archivedFocuses ?? [])];
    if (!archived.some((f) => f.id === next.activeFocus!.id)) {
      archived.push(next.activeFocus!);
    }
    next = {
      ...next,
      archivedFocuses: archived.slice(-MAX_ARCHIVED_FOCUSES),
    };
  }

  if (next.recentTransitions && next.recentTransitions.length > MAX_RECENT_TRANSITIONS) {
    next = {
      ...next,
      recentTransitions: next.recentTransitions.slice(-MAX_RECENT_TRANSITIONS),
    };
  }

  return next;
}
