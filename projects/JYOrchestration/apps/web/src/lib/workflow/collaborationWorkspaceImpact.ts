import type { CollaborationActionResult } from "@/lib/workflow/collaborationActionContract";

export type WorkspaceImpactNote = {
  scope: "primary" | "supporting";
  lines: string[];
};

/** Plain-language summary of what changed in primary vs supporting workspace areas. */
export function getCollaborationWorkspaceImpact(latest: CollaborationActionResult | null): WorkspaceImpactNote | null {
  if (!latest || latest.status !== "success") return null;
  if (latest.actionType === "GENERATE_MINUTES") {
    return {
      scope: "primary",
      lines: [
        "Latest minutes (official) on the right now reflects this run.",
        "Supporting insights stay the same until you run analysis or ideas.",
      ],
    };
  }
  if (latest.actionType === "GENERATE_FEATURES") {
    return {
      scope: "primary",
      lines: [
        "Official derived features on the right now reflect this run (also visible on the requirement Features tab for the latest session).",
        "Idea-based suggestions under Supporting insights are unchanged. Run Task 초안 생성 to refresh official task drafts.",
      ],
    };
  }
  if (latest.actionType === "GENERATE_TASKS") {
    return {
      scope: "primary",
      lines: [
        "Official task drafts on the right now reflect this run (also visible on the requirement Tasks tab for the latest session).",
        "Supporting insights and idea suggestions are unchanged.",
      ],
    };
  }
  if (latest.actionType === "REQUEST_ANALYSIS") {
    return {
      scope: "supporting",
      lines: [
        "Open Supporting insights to see the new analysis notes.",
        "Official minutes, derived features, and task drafts were not changed.",
      ],
    };
  }
  return {
    scope: "supporting",
    lines: [
      "Ideas and suggested feature cards were refreshed (labeled as suggestions, not official).",
      "Official minutes, features, and task drafts on the right are unchanged.",
    ],
  };
}
