/**
 * Proactive action recommendations from orchestration metrics (not user utterance).
 */

import { getQuickActionDefinition, quickActionFromDefinition, type QuickAction, type QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";
import type { FeatureDetailProjectionMetrics } from "@/lib/requirements/featureDetailSlots";
import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import type { ArtifactHubOrchestrationState } from "@/lib/requirements/requirementsArtifactHubOrchestration";

export type ProactiveActionRecommendation = Readonly<{
  readonly actionId: QuickActionId;
  readonly label: string;
  readonly reason: string;
  readonly priority: number;
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
