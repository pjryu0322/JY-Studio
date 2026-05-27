import { createProjectScopedCustomEventBus } from "@/lib/ui/projectScopedCustomEventBus";

export const PROJECT_RECOMMENDATION_PANEL_EVENT = "jyo:project-recommendation-panel" as const;

export type RecommendationPanelEventDetail = Readonly<{
  readonly open: boolean;
}>;

const recommendationPanelBus = createProjectScopedCustomEventBus<RecommendationPanelEventDetail>(
  PROJECT_RECOMMENDATION_PANEL_EVENT,
);

export function dispatchRecommendationPanelOpen(projectId: string, open = true): void {
  recommendationPanelBus.dispatch(projectId, { open });
}

export function toggleRecommendationPanelOpen(projectId: string, currentlyOpen: boolean): void {
  dispatchRecommendationPanelOpen(projectId, !currentlyOpen);
}

export function subscribeRecommendationPanel(
  projectId: string,
  handler: (open: boolean) => void,
): () => void {
  return recommendationPanelBus.subscribe(projectId, (detail) => handler(detail.open));
}
