import type { QuickReplyWire } from "@/lib/requirements/requirementsQuickActionRegistry";
import type { PlatformNextAction } from "@/lib/platform-orchestration/types";

/**
 * Maps platform next actions to SingleChat quick-reply chips (label + payload preserved in wire object).
 */
export function platformNextActionsToQuickReplies(
  actions: readonly PlatformNextAction[],
): readonly QuickReplyWire[] {
  return actions
    .filter((a) => a.enabled)
    .map((a) => ({
      id: "DIRECT_INPUT" as const,
      label: a.label,
    }));
}

export function platformNextActionLabelsForInterviewSuggestions(
  actions: readonly PlatformNextAction[],
): readonly string[] {
  return actions.filter((a) => a.enabled).map((a) => a.label);
}
