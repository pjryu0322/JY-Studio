import { type QuickAction } from "@/lib/requirements/requirementsQuickActionRegistry";
import type { ArtifactLifecycleEntryWire } from "@/lib/requirements/requirementsIntentOrchestrationWire";

export type { QuickAction };

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
