/**
 * Human-readable orchestration debug summaries for operators and power users.
 */

import type { GuardResult } from "@/lib/requirements/requirementsActionGuard";
import type { IntentRoutingResult } from "@/lib/requirements/requirementsIntentRouterTypes";
import type { GovernanceResolution } from "@/lib/requirements/requirementsStageGovernanceResolver";
import type { ArtifactDependencyEdge } from "@/lib/requirements/requirementsArtifactDependencyGraph";
import type { OrchestrationTransactionTrace } from "@/lib/requirements/requirementsOrchestrationTransaction";
import type { RequirementsIntentOrchestrationV1 } from "@/lib/requirements/requirementsIntentOrchestrationWire";

export function buildHumanReadableDebugSummary(input: {
  readonly orch: RequirementsIntentOrchestrationV1;
  readonly intent?: IntentRoutingResult;
  readonly guard?: GuardResult;
  readonly governance?: GovernanceResolution;
  readonly propagation?: readonly string[];
  readonly transaction?: OrchestrationTransactionTrace;
}): string {
  const lines: string[] = [];

  if (input.intent) {
    lines.push(`라우팅: ${input.intent.routerMode} — ${input.intent.reason}`);
    if (input.intent.suggestedActionId) lines.push(`추천 액션: ${input.intent.suggestedActionId}`);
  }

  if (input.guard && !input.guard.allowed) {
    lines.push(`차단: ${input.guard.reason ?? "Registry Guard"}`);
  } else if (input.guard?.warning) {
    lines.push(`경고: ${input.guard.warning}`);
  }

  const top = input.orch.recommendationQueue?.[0];
  if (top) lines.push(`추천: ${top.actionId} — ${top.reason}`);

  if (input.orch.activeFocus?.softStale) {
    lines.push(`포커스 stale: ${input.orch.activeFocus.label ?? input.orch.activeFocus.id}`);
  }

  if (input.orch.clarification?.pending) {
    lines.push(`확인 대기: ${input.orch.clarification.question ?? "clarification"}`);
  }

  if (input.governance && !input.governance.allowed) {
    lines.push(`거버넌스: ${input.governance.resolution} — ${input.governance.reason}`);
  }

  for (const p of input.propagation ?? []) {
    lines.push(`산출물 전파: ${p}`);
  }

  if (input.orch.lastReplaySnapshot) {
    lines.push(`replay: ${input.orch.lastReplaySnapshot.beforeStateSummary} → ${input.orch.lastReplaySnapshot.afterStateSummary}`);
  }

  if (input.transaction?.status === "rolled_back") {
    lines.push(`롤백: ${input.transaction.rollbackReason ?? "transaction failed"}`);
  }

  return lines.join("\n").slice(0, 1200);
}
