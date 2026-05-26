export const PROJECT_RECOMMENDATION_PANEL_EVENT = "jyo:project-recommendation-panel" as const;

export type RecommendationPanelEventDetail = Readonly<{
  readonly open: boolean;
  readonly projectId?: string;
}>;

export function dispatchRecommendationPanelOpen(projectId: string, open = true): void {
  const id = projectId.trim();
  if (!id || typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<RecommendationPanelEventDetail>(PROJECT_RECOMMENDATION_PANEL_EVENT, {
      detail: { open, projectId: id },
    }),
  );
}

export function toggleRecommendationPanelOpen(projectId: string, currentlyOpen: boolean): void {
  dispatchRecommendationPanelOpen(projectId, !currentlyOpen);
}

export function subscribeRecommendationPanel(
  projectId: string,
  handler: (open: boolean) => void,
): () => void {
  const id = projectId.trim();
  if (!id || typeof window === "undefined") return () => {};
  const onEvent = (e: Event) => {
    const detail = (e as CustomEvent<RecommendationPanelEventDetail>).detail;
    if (!detail || (detail.projectId && detail.projectId !== id)) return;
    handler(Boolean(detail.open));
  };
  window.addEventListener(PROJECT_RECOMMENDATION_PANEL_EVENT, onEvent as EventListener);
  return () => window.removeEventListener(PROJECT_RECOMMENDATION_PANEL_EVENT, onEvent as EventListener);
}
