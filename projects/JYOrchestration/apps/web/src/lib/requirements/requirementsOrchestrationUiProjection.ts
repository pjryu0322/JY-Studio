/**
 * Phase 3/4 orchestration → UI projection (persisted state only; delegates to aggregate projection).
 */

import { getQuickActionDefinition, quickActionFromDefinition, type QuickAction } from "@/lib/requirements/requirementsQuickActionRegistry";
import { splitPrioritizedRecommendations } from "@/lib/requirements/requirementsActionRecommendation";
import { buildGovernedOrchestrationAggregateProjection } from "@/lib/requirements/requirementsIntentOrchestrationAggregateProjection";
import type { ArtifactLifecycleEntryWire } from "@/lib/requirements/requirementsIntentOrchestrationWire";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export type FocusDriftUiBanner = Readonly<{
  readonly message: string;
  readonly detail?: string;
  readonly focusLabel?: string;
}>;

export type ClarificationUiState = Readonly<{
  readonly pending: boolean;
  readonly abandoned: boolean;
  readonly userMessage: string;
  readonly question?: string;
}>;

export type OrchestrationRecommendationUi = Readonly<{
  readonly quickAction: QuickAction;
  readonly reason: string;
  readonly score: number;
}>;

export type ArtifactLifecycleUiLabel = "latest" | "outdated" | "regenerate" | "generatable";

export type OrchestrationUiProjection = Readonly<{
  readonly focusDrift: FocusDriftUiBanner | null;
  readonly clarification: ClarificationUiState | null;
  readonly topRecommendation: OrchestrationRecommendationUi | null;
  readonly secondaryRecommendationReasons: readonly string[];
  readonly artifactBadgeCount: number;
  readonly artifactBadgeHasStale: boolean;
  readonly artifactLifecycleLabels: readonly Readonly<{
    readonly key: string;
    readonly label: ArtifactLifecycleUiLabel;
    readonly hint: string;
  }>[];
}>;

export function buildClarificationUserMessage(clarification: ClarificationUiState | null): string | undefined {
  if (!clarification) return undefined;
  if (clarification.abandoned) {
    return "이전 확인 요청은 만료되었습니다. 새 요청으로 처리합니다.";
  }
  if (clarification.pending) {
    return clarification.question ?? clarification.userMessage;
  }
  return undefined;
}

export function artifactLifecycleUiLabel(entry: ArtifactLifecycleEntryWire): ArtifactLifecycleUiLabel {
  if (entry.stale) return entry.generated ? "regenerate" : "outdated";
  if (entry.generated) return "latest";
  return "generatable";
}

const LIFECYCLE_LABEL_KO: Record<ArtifactLifecycleUiLabel, string> = {
  latest: "최신",
  outdated: "구버전",
  regenerate: "재생성 필요",
  generatable: "생성 가능",
};

export function artifactLifecycleLabelKo(label: ArtifactLifecycleUiLabel): string {
  return LIFECYCLE_LABEL_KO[label];
}

function lifecycleLabelFromHint(hint: string): ArtifactLifecycleUiLabel {
  if (hint.includes("재생성")) return "regenerate";
  if (hint.includes("구버전") || hint.includes("이전")) return "outdated";
  if (hint.includes("최신")) return "latest";
  return "generatable";
}

export function buildOrchestrationUiProjection(input: {
  readonly state: RequirementsStateJson;
  readonly catalogCount?: number;
  readonly drawerFeatureId?: string | null;
}): OrchestrationUiProjection {
  const aggregate = buildGovernedOrchestrationAggregateProjection({
    state: input.state,
    catalogCount: input.catalogCount,
    drawerFeatureId: input.drawerFeatureId,
  });

  let focusDrift: FocusDriftUiBanner | null = null;
  if (aggregate.focus.softStale) {
    focusDrift = {
      message: "현재 편집 대상이 오래되었습니다.",
      detail: "최근 대화가 다른 항목으로 이동했을 수 있습니다. 현재 대상을 유지하거나 다른 기능을 선택해 주세요.",
      focusLabel: aggregate.focus.activeFocus?.label ?? aggregate.focus.activeFocus?.id,
    };
  }

  let clarification: ClarificationUiState | null = null;
  if (aggregate.clarification.pending || aggregate.clarification.abandoned) {
    clarification = {
      pending: aggregate.clarification.pending,
      abandoned: aggregate.clarification.abandoned,
      userMessage: buildClarificationUserMessage({
        pending: aggregate.clarification.pending,
        abandoned: aggregate.clarification.abandoned,
        userMessage: "",
        question: aggregate.clarification.question,
      }) ?? "",
      question: aggregate.clarification.question,
    };
  }

  const split = splitPrioritizedRecommendations(
    (aggregate.recommendations.queue ?? []).map((r) => ({
      actionId: r.actionId,
      score: r.score,
      reason: r.reason,
      blocking: r.blocking,
      generatedAt: r.generatedAt,
    })),
  );

  const topRecommendation: OrchestrationRecommendationUi | null = split.primary
    ? {
        quickAction: quickActionFromDefinition(getQuickActionDefinition(split.primary.actionId)),
        reason: split.primary.reason,
        score: split.primary.score,
      }
    : null;

  const artifactLifecycleLabels = aggregate.artifacts.lifecycleLabels.map((e) => {
    const label = lifecycleLabelFromHint(e.hint);
    return { key: e.key, label, hint: e.hint };
  });

  return {
    focusDrift,
    clarification,
    topRecommendation,
    secondaryRecommendationReasons: split.secondary.map((r) => r.reason),
    artifactBadgeCount: aggregate.artifacts.badgeCount,
    artifactBadgeHasStale: aggregate.artifacts.badgeHasStale,
    artifactLifecycleLabels,
  };
}
