/**
 * Slim UI read model — components must not import aggregate projection directly.
 */

import { getQuickActionDefinition, quickActionFromDefinition, type QuickAction } from "@/lib/requirements/requirementsQuickActionRegistry";
import { splitPrioritizedRecommendations } from "@/lib/requirements/requirementsActionRecommendation";
import { buildGovernedOrchestrationAggregateProjection } from "@/lib/requirements/requirementsIntentOrchestrationAggregateProjection";
import {
  artifactPropagationLabelsKo,
  buildArtifactDependencyGraph,
} from "@/lib/requirements/requirementsArtifactDependencyGraph";
import { buildFoldedOrchestrationTimeline } from "@/lib/requirements/requirementsOrchestrationTimelineFolding";
import { pickOrchestrationPromptTimelineEntries } from "@/lib/requirements/requirementsOrchestrationTimelineView";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type {
  ArtifactLifecycleUiLabel,
  ClarificationUiState,
  FocusDriftUiBanner,
  OrchestrationRecommendationUi,
} from "@/lib/requirements/requirementsOrchestrationUiProjectionTypes";
import { buildClarificationUserMessage } from "@/lib/requirements/requirementsOrchestrationUiProjectionTypes";

export type OrchestrationReadModel = Readonly<{
  readonly topRecommendation: OrchestrationRecommendationUi | null;
  readonly secondaryRecommendationReasons: readonly string[];
  readonly activeFocusSummary: string | null;
  readonly focusDriftBanner: FocusDriftUiBanner | null;
  readonly clarificationBanner: ClarificationUiState | null;
  readonly artifactBadge: Readonly<{ readonly count: number; readonly hasStale: boolean }>;
  readonly artifactLifecycleHints: readonly Readonly<{
    readonly key: string;
    readonly label: ArtifactLifecycleUiLabel;
    readonly hint: string;
  }>[];
  readonly timelineSummary: readonly Readonly<{
    readonly group: string;
    readonly count: number;
    readonly folded: boolean;
    readonly hiddenCount: number;
  }>[];
  readonly artifactPropagation: readonly string[];
  readonly humanReadableDebugSummary: string | null;
}>;

function lifecycleLabelFromHint(hint: string): ArtifactLifecycleUiLabel {
  if (hint.includes("재생성")) return "regenerate";
  if (hint.includes("구버전") || hint.includes("이전")) return "outdated";
  if (hint.includes("최신")) return "latest";
  return "generatable";
}

export function buildOrchestrationReadModel(input: {
  readonly state: RequirementsStateJson;
  readonly catalogCount?: number;
  readonly drawerFeatureId?: string | null;
}): OrchestrationReadModel {
  const aggregate = buildGovernedOrchestrationAggregateProjection({
    state: input.state,
    catalogCount: input.catalogCount,
    drawerFeatureId: input.drawerFeatureId,
  });
  const orch = input.state.requirementsIntentOrchestrationV1;

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

  let focusDriftBanner: FocusDriftUiBanner | null = null;
  if (aggregate.focus.softStale) {
    focusDriftBanner = {
      message: "현재 편집 대상이 오래되었습니다.",
      detail: "최근 대화가 다른 항목으로 이동했을 수 있습니다.",
      focusLabel: aggregate.focus.activeFocus?.label ?? aggregate.focus.activeFocus?.id,
    };
  }

  let clarificationBanner: ClarificationUiState | null = null;
  if (aggregate.clarification.pending || aggregate.clarification.abandoned) {
    clarificationBanner = {
      pending: aggregate.clarification.pending,
      abandoned: aggregate.clarification.abandoned,
      userMessage:
        buildClarificationUserMessage({
          pending: aggregate.clarification.pending,
          abandoned: aggregate.clarification.abandoned,
          userMessage: "",
          question: aggregate.clarification.question,
        }) ?? "",
      question: aggregate.clarification.question,
    };
  }

  const traces = pickOrchestrationPromptTimelineEntries(input.state.promptTimeline);
  const folded = buildFoldedOrchestrationTimeline(traces);

  const propagation =
    orch?.artifactDependencies?.length ?
      artifactPropagationLabelsKo(orch.artifactDependencies)
    : artifactPropagationLabelsKo(
        buildArtifactDependencyGraph({
          state: input.state,
          lifecycle: orch?.artifactLifecycle,
        }),
      );

  return {
    topRecommendation,
    secondaryRecommendationReasons: split.secondary.map((r) => r.reason),
    activeFocusSummary:
      aggregate.focus.activeFocus ?
        `${aggregate.focus.activeFocus.type}:${aggregate.focus.activeFocus.label ?? aggregate.focus.activeFocus.id}`
      : null,
    focusDriftBanner,
    clarificationBanner,
    artifactBadge: {
      count: aggregate.artifacts.badgeCount,
      hasStale: aggregate.artifacts.badgeHasStale,
    },
    artifactLifecycleHints: aggregate.artifacts.lifecycleLabels.map((e) => {
      const label = lifecycleLabelFromHint(e.hint);
      return { key: e.key, label, hint: e.hint };
    }),
    timelineSummary: folded.map((g) => ({
      group: g.group,
      count: g.count,
      folded: g.folded,
      hiddenCount: g.hiddenCount,
    })),
    artifactPropagation: propagation,
    humanReadableDebugSummary: orch?.humanReadableDebugSummary ?? null,
  };
}
