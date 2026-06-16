"use client";

/**
 * Single chat bubble renderer for requirements/planning/implementation AI messages.
 * Quick Design and general chat both use this module (no per-flow renderer).
 */
export {
  RequirementsAiMessageWithOptionalCodeTaskCopy as RequirementsMessageRenderer,
  ImplementationPreparationDiagnosticsCollapsible,
} from "@/components/requirements/CodeTaskLlmRefinementChatSection";

export { RequirementsAiMessageMarkdown } from "@/components/requirements/RequirementsAiMessageMarkdown";
