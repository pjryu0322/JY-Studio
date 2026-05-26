import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type { WorkspaceTurnModelResult, WorkspaceTurnMode } from "@/lib/workspace-turn/workspaceTurnTypes";

export function buildWorkspaceTurnAnalyzedTimelineEntry(input: {
  readonly mode: WorkspaceTurnMode;
  readonly model: WorkspaceTurnModelResult;
  readonly source: "llm" | "rule_fallback";
  readonly nowIso: string;
}): RequirementsPromptTimelineEntry {
  const m = input.model;
  const action = input.mode === "implementation" ? "implementation_turn_analyzed" : "workspace_turn_analyzed";
  return {
    stage: input.mode === "implementation" ? "implementation" : "feature-planning",
    stageGroup: input.mode === "implementation" ? "구현" : "기획",
    workspaceScreenKey: input.mode === "implementation" ? "prototype_execution" : "requirements",
    action,
    source: input.source === "llm" ? "llm" : "system",
    responseText: [
      `mode=${input.mode}`,
      `intent=${m.intent}`,
      `status=${m.status}`,
      `confidence=${m.confidence}`,
      `targetAreas=${m.targetAreas.join(",") || "none"}`,
      `requiresClarification=${m.requiresClarification}`,
      `source=${input.source}`,
    ].join(" "),
    createdAt: input.nowIso,
    orchestrationTraceGroup: "implementation_orchestration",
  };
}

export function buildImplementationTurnPatchAppliedTimelineEntry(input: {
  readonly model: WorkspaceTurnModelResult;
  readonly nowIso: string;
}): RequirementsPromptTimelineEntry {
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: "implementation_turn_patch_applied",
    source: "system",
    responseText: [
      "type=implementation_turn_patch_applied",
      `intent=${input.model.intent}`,
      `status=${input.model.status}`,
      `ruleCount=${input.model.extractedRules.length}`,
    ].join(" "),
    createdAt: input.nowIso,
    orchestrationTraceGroup: "implementation_orchestration",
  };
}

export function buildImplementationTurnClarificationTimelineEntry(input: {
  readonly model: WorkspaceTurnModelResult;
  readonly nowIso: string;
}): RequirementsPromptTimelineEntry {
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: "implementation_turn_clarification_requested",
    source: "system",
    responseText: [
      "type=implementation_turn_clarification_requested",
      `intent=${input.model.intent}`,
      `confidence=${input.model.confidence}`,
    ].join(" "),
    createdAt: input.nowIso,
    orchestrationTraceGroup: "implementation_orchestration",
  };
}
