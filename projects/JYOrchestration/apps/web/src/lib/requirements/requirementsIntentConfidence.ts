/**
 * Intent confidence calibration — blends router score with stage/focus/recency signals.
 */

import type { FeatureDetailProjectionMetrics } from "@/lib/requirements/featureDetailSlots";
import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import type { QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";
import { getQuickActionPolicy } from "@/lib/requirements/requirementsQuickActionPolicy";
import type { OrchestrationConversationMemory } from "@/lib/requirements/requirementsConversationMemory";
import type { IntentRoutingResult } from "@/lib/requirements/requirementsIntentRouterTypes";

export type ConfidenceCalibrationInput = Readonly<{
  readonly raw: IntentRoutingResult;
  readonly stage: OrchestrationStage;
  readonly memory: OrchestrationConversationMemory;
  readonly featureMetrics: FeatureDetailProjectionMetrics;
}>;

export function calibrateIntentConfidence(input: ConfidenceCalibrationInput): IntentRoutingResult {
  const { raw } = input;
  if (!raw.suggestedActionId) return raw;

  const factors: string[] = [];
  let score = raw.confidence;

  const actionId = raw.suggestedActionId;
  const policy = getQuickActionPolicy(actionId);
  if (policy.allowedStages?.length && !policy.allowedStages.includes(input.stage)) {
    score -= 0.25;
    factors.push("stage_mismatch");
  } else {
    score += 0.05;
    factors.push("stage_ok");
  }

  if (input.memory.activeFocus && raw.reason?.includes("focus")) {
    score += 0.08;
    factors.push("focus_continuity");
  }
  if (input.memory.lastSuggestedAction === actionId || input.memory.lastConfirmedAction === actionId) {
    score += 0.06;
    factors.push("action_recency");
  }
  if (input.memory.recentConversationSummary.toLowerCase().includes(actionId.toLowerCase())) {
    score += 0.04;
    factors.push("conversation_similarity");
  }

  const needConfirmed = policy.requiredConfirmedFeatureCount ?? 0;
  if (needConfirmed > 0 && input.featureMetrics.confirmedFeatureCount >= needConfirmed) {
    score += 0.05;
    factors.push("feature_coverage_ok");
  } else if (needConfirmed > 0) {
    score -= 0.2;
    factors.push("feature_coverage_low");
  }

  const calibrated = Math.min(1, Math.max(0, score));
  return {
    ...raw,
    confidence: calibrated,
    confidenceFactors: factors,
  };
}
