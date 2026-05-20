/**
 * Proactive action recommendations from orchestration metrics (not user utterance).
 */

import { getQuickActionDefinition, quickActionFromDefinition, type QuickAction, type QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";
import type { FeatureDetailProjectionMetrics } from "@/lib/requirements/featureDetailSlots";
import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import type { ArtifactHubOrchestrationState } from "@/lib/requirements/requirementsArtifactHubOrchestration";
import type { RequirementsIntentOrchestrationV1 } from "@/lib/requirements/requirementsIntentOrchestrationWire";
import { MAX_CHAT_PRIORITIZED_RECOMMENDATIONS } from "@/lib/requirements/requirementsOrchestrationConstants";

export type ProactiveActionRecommendation = Readonly<{
  readonly actionId: QuickActionId;
  readonly label: string;
  readonly reason: string;
  readonly priority: number;
}>;

/** Phase 3 prioritized recommendation queue entry. */
export type OrchestrationRecommendation = Readonly<{
  readonly actionId: QuickActionId;
  readonly score: number;
  readonly reason: string;
  readonly blocking: boolean;
  readonly generatedAt: string;
}>;

export type PrioritizedRecommendationQueue = Readonly<{
  readonly primary: OrchestrationRecommendation | null;
  readonly secondary: readonly OrchestrationRecommendation[];
  readonly all: readonly OrchestrationRecommendation[];
}>;

const COVERAGE_SCREEN_THRESHOLD = 0.8;

export function buildProactiveActionRecommendations(input: {
  readonly stage: OrchestrationStage;
  readonly metrics: FeatureDetailProjectionMetrics;
  readonly availableActionIds: readonly QuickActionId[];
  readonly artifactHub?: ArtifactHubOrchestrationState;
}): readonly ProactiveActionRecommendation[] {
  const out: ProactiveActionRecommendation[] = [];
  const allow = new Set(input.availableActionIds);

  if (
    (input.stage === "FEATURE_DETAIL" || input.stage === "SCREEN_DEFINE") &&
    input.metrics.hasConfirmedFeature &&
    input.metrics.featureCoverage >= COVERAGE_SCREEN_THRESHOLD &&
    allow.has("DEFINE_SCREEN")
  ) {
    out.push({
      actionId: "DEFINE_SCREEN",
      label: getQuickActionDefinition("DEFINE_SCREEN").defaultLabel,
      reason: `기능 확정률 ${Math.round(input.metrics.featureCoverage * 100)}% — 화면 정의를 권장합니다.`,
      priority: 90,
    });
  }

  if (
    input.metrics.hasConfirmedFeature &&
    allow.has("DEFINE_API") &&
    !out.some((r) => r.actionId === "DEFINE_API")
  ) {
    out.push({
      actionId: "DEFINE_API",
      label: getQuickActionDefinition("DEFINE_API").defaultLabel,
      reason: "확정된 기능이 있습니다 — API 정의를 이어갈 수 있습니다.",
      priority: 70,
    });
  }

  if (!input.metrics.hasConfirmedFeature && allow.has("EDIT_FEATURES")) {
    out.push({
      actionId: "EDIT_FEATURES",
      label: getQuickActionDefinition("EDIT_FEATURES").defaultLabel,
      reason: "확정된 기능이 없습니다 — 먼저 기능을 확정해 주세요.",
      priority: 95,
    });
  }

  if (input.artifactHub?.badgeEligible && allow.has("OPEN_ARTIFACT_HUB")) {
    out.push({
      actionId: "OPEN_ARTIFACT_HUB",
      label: getQuickActionDefinition("OPEN_ARTIFACT_HUB").defaultLabel,
      reason: input.artifactHub.badgeHint ?? "생성 가능한 산출물이 있습니다.",
      priority: 60,
    });
  }

  return [...out].sort((a, b) => b.priority - a.priority).slice(0, 3);
}

export function proactiveRecommendationsToQuickActions(
  recs: readonly ProactiveActionRecommendation[],
): readonly QuickAction[] {
  return recs.map((r) => quickActionFromDefinition(getQuickActionDefinition(r.actionId), r.label));
}

function scoreFromLegacy(rec: ProactiveActionRecommendation, nowIso: string): OrchestrationRecommendation {
  return {
    actionId: rec.actionId,
    score: rec.priority,
    reason: rec.reason,
    blocking: rec.priority >= 90,
    generatedAt: nowIso,
  };
}

export function buildPrioritizedRecommendationQueue(input: {
  readonly stage: OrchestrationStage;
  readonly metrics: FeatureDetailProjectionMetrics;
  readonly availableActionIds: readonly QuickActionId[];
  readonly artifactHub?: ArtifactHubOrchestrationState;
  readonly orchestration?: RequirementsIntentOrchestrationV1 | null;
  readonly lastIntentActionId?: QuickActionId | null;
  readonly nowIso?: string;
}): readonly OrchestrationRecommendation[] {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const legacy = buildProactiveActionRecommendations({
    stage: input.stage,
    metrics: input.metrics,
    availableActionIds: input.availableActionIds,
    artifactHub: input.artifactHub,
  });

  const scored = legacy.map((r) => {
    let score = r.priority;
    if (input.orchestration?.clarification?.pending) score -= 25;
    if (input.orchestration?.activeFocus?.softStale) score -= 10;
    if (input.lastIntentActionId === r.actionId) score -= 15;
    if (input.metrics.featureCoverage >= 0.8 && r.actionId === "DEFINE_SCREEN") score += 5;
    if (input.artifactHub?.hasStaleArtifact && r.actionId === "OPEN_ARTIFACT_HUB") score += 8;
    return scoreFromLegacy({ ...r, priority: score }, nowIso);
  });

  return [...scored].sort((a, b) => b.score - a.score);
}

export function splitPrioritizedRecommendations(
  queue: readonly OrchestrationRecommendation[],
): PrioritizedRecommendationQueue {
  const sorted = [...queue].sort((a, b) => b.score - a.score);
  const primary = sorted[0] ?? null;
  const secondary = sorted.slice(MAX_CHAT_PRIORITIZED_RECOMMENDATIONS);
  return { primary, secondary, all: sorted };
}
