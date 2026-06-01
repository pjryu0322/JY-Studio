import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";

export type ProjectCodeTaskRefinementSettings = Readonly<{
  enableLlmCodeTaskRefinement: boolean;
  hasOpenaiPlannerApiKey: boolean;
  providerSource: "project_execution_setup" | "user_default" | "env_fallback" | "none";
}>;

export const MISSING_SERVER_REFINEMENT_SETTINGS: ProjectCodeTaskRefinementSettings = {
  enableLlmCodeTaskRefinement: false,
  hasOpenaiPlannerApiKey: false,
  providerSource: "none",
};

export type LlmRefinementDecision = Readonly<{
  decision: "enabled" | "skipped" | "fallback";
  skipReason?: string;
  useLlm: boolean;
}>;

export function resolveLlmRefinementDecision(input: {
  readonly settings: ProjectCodeTaskRefinementSettings;
  readonly forceLlm?: boolean;
}): LlmRefinementDecision {
  if (input.forceLlm === true) {
    return { decision: "enabled", useLlm: true };
  }

  if (!input.settings.enableLlmCodeTaskRefinement) {
    return {
      decision: "skipped",
      skipReason: "disabled_by_project_setting",
      useLlm: false,
    };
  }

  if (!input.settings.hasOpenaiPlannerApiKey) {
    return {
      decision: "fallback",
      skipReason: "missing_provider_key",
      useLlm: true,
    };
  }

  return { decision: "enabled", useLlm: true };
}

export function resolveLlmRefinementDecisionFromServerSettings(input: {
  readonly refinementSettings: ProjectCodeTaskRefinementSettings | null | undefined;
  readonly forceLlm?: boolean;
}): LlmRefinementDecision & Readonly<{ readonly settings: ProjectCodeTaskRefinementSettings }> {
  if (input.refinementSettings == null) {
    return {
      settings: MISSING_SERVER_REFINEMENT_SETTINGS,
      decision: "skipped",
      skipReason: "disabled_by_missing_server_settings",
      useLlm: input.forceLlm === true,
    };
  }
  const decision = resolveLlmRefinementDecision({
    settings: input.refinementSettings,
    forceLlm: input.forceLlm,
  });
  return { settings: input.refinementSettings, ...decision };
}

export function buildImplementationCodeTaskLlmRefinementDecisionTimelineEntry(input: {
  readonly projectId: string;
  readonly settings: ProjectCodeTaskRefinementSettings;
  readonly decision: LlmRefinementDecision["decision"];
  readonly skipReason?: string;
  readonly useLlm: boolean;
  readonly nowIso: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: "implementation_code_task_llm_refinement_decision",
    orchestrationTraceGroup: "implementation_planning_readiness",
    fields: {
      projectId: input.projectId.trim(),
      mode: "planning",
      enableLlmCodeTaskRefinement: input.settings.enableLlmCodeTaskRefinement,
      hasOpenaiPlannerApiKey: input.settings.hasOpenaiPlannerApiKey,
      providerSource: input.settings.providerSource,
      decision: input.decision,
      useLlm: input.useLlm,
      ...(input.skipReason ? { skipReason: input.skipReason } : {}),
    },
    nowIso: input.nowIso,
  });
}
