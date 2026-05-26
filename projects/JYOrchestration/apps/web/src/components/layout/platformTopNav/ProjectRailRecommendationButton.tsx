"use client";

import {
  platformRailMessengerActiveShell,
  platformRailMessengerActiveText,
  platformRailNavPrimaryText,
  platformRailNavTextCell,
} from "@/lib/layout/platformTopNavConstants";
import { dispatchRecommendationPanelOpen } from "@/lib/recommendation/recommendationPanelEvents";

function LightbulbIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.74V17h8v-2.26A7 7 0 0 0 12 2z" />
    </svg>
  );
}

type Props = Readonly<{
  effectiveProjectId: string;
  active?: boolean;
}>;

export function ProjectRailRecommendationButton({ effectiveProjectId, active = false }: Props) {
  const projectId = effectiveProjectId.trim();
  if (!projectId) return null;

  return (
    <button
      type="button"
      data-testid="platform-recommendation-rail-project"
      aria-label="추천 · AI 추천근거"
      title="AI 추천근거"
      onClick={() => dispatchRecommendationPanelOpen(projectId, true)}
      style={{
        ...platformRailNavTextCell,
        ...(active ? platformRailMessengerActiveShell : {}),
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
      }}
    >
      <LightbulbIcon />
      <span style={active ? platformRailMessengerActiveText : platformRailNavPrimaryText}>추천</span>
    </button>
  );
}
