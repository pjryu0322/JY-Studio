import type { CollaborationAnalysisPayload } from "@/lib/workflow/collaborationActionContract";
import type { FeatureMock } from "@/lib/mock/workflowMock";

/** Display copy for analysis in the sidebar (same shape as generation contract). */
export type DisplayedAnalysis = CollaborationAnalysisPayload;

/** Mock-only rows for “suggested from ideas” — not official derived features. */
export function ideaStringsToSuggestedFeatures(ideas: string[], seed: number): FeatureMock[] {
  return ideas.map((text, idx) => ({
    id: `suggest-idea-${seed}-${idx}`,
    name: text.length > 52 ? `${text.slice(0, 49)}…` : text,
    description: text,
    status: "DRAFT" as const,
    userFlow: [],
    nonFunctional: [],
  }));
}
