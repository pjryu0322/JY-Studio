/**
 * Phase 3 orchestration → UI projection (persisted state only, no message parsing).
 */

import { getQuickActionDefinition, quickActionFromDefinition, type QuickAction } from "@/lib/requirements/requirementsQuickActionRegistry";
import { splitPrioritizedRecommendations } from "@/lib/requirements/requirementsActionRecommendation";
import { artifactLifecycleHasStale } from "@/lib/requirements/requirementsArtifactLifecycle";
import { buildArtifactHubOrchestrationState, artifactHubTopChromeBadgeCount } from "@/lib/requirements/requirementsArtifactHubOrchestration";
import type { ArtifactLifecycleEntryWire, RequirementsIntentOrchestrationV1 } from "@/lib/requirements/requirementsIntentOrchestrationWire";
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

export function buildOrchestrationUiProjection(input: {
  readonly state: RequirementsStateJson;
  readonly catalogCount?: number;
}): OrchestrationUiProjection {
  const orch = input.state.requirementsIntentOrchestrationV1;
  const hub = buildArtifactHubOrchestrationState({ state: input.state });
  const catalog = input.catalogCount ?? 0;
  const badgeCount = artifactHubTopChromeBadgeCount(catalog, hub);
  const hasStale = hub.hasStaleArtifact || artifactLifecycleHasStale(orch?.artifactLifecycle);

  let focusDrift: FocusDriftUiBanner | null = null;
  if (orch?.activeFocus?.softStale) {
    focusDrift = {
      message: "현재 편집 대상이 오래되었습니다.",
      detail: "최근 대화가 다른 항목으로 이동했을 수 있습니다. 현재 대상을 유지하거나 다른 기능을 선택해 주세요.",
      focusLabel: orch.activeFocus.label ?? orch.activeFocus.id,
    };
  }

  let clarification: ClarificationUiState | null = null;
  if (orch?.clarification?.pending || orch?.clarification?.abandoned) {
    clarification = {
      pending: orch.clarification.pending === true && !orch.clarification.abandoned,
      abandoned: orch.clarification.abandoned === true,
      userMessage: buildClarificationUserMessage({
        pending: orch.clarification.pending === true && !orch.clarification.abandoned,
        abandoned: orch.clarification.abandoned === true,
        userMessage: "",
        question: orch.clarification.question,
      }) ?? "",
      question: orch.clarification.question,
    };
  }

  const queue = orch?.recommendationQueue ?? [];
  const split = splitPrioritizedRecommendations(
    queue.map((r) => ({
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

  const artifactLifecycleLabels = (orch?.artifactLifecycle ?? []).map((e) => {
    const label = artifactLifecycleUiLabel(e);
    return {
      key: e.artifactKey,
      label,
      hint: artifactLifecycleLabelKo(label),
    };
  });

  return {
    focusDrift,
    clarification,
    topRecommendation,
    secondaryRecommendationReasons: split.secondary.map((r) => r.reason),
    artifactBadgeCount: badgeCount,
    artifactBadgeHasStale: hasStale,
    artifactLifecycleLabels,
  };
}
