import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import { resolveLlmCodeTaskRefinementProviderContext } from "@/lib/prototype/implementationCodeTaskPlanLlmProvider";
import { prisma } from "@/lib/prisma";
import { withExecutionSetupSchemaHealRetry } from "@/lib/prisma/executionSetupSplitColumnsHeal";

export type ProjectCodeTaskRefinementSettings = Readonly<{
  enableLlmCodeTaskRefinement: boolean;
  hasOpenaiPlannerApiKey: boolean;
  providerSource: "project_execution_setup" | "user_default" | "env_fallback" | "none";
}>;

export type LlmRefinementDecision = Readonly<{
  decision: "enabled" | "skipped" | "fallback";
  skipReason?: string;
  useLlm: boolean;
}>;

export async function resolveProjectCodeTaskRefinementSettings(input: {
  readonly projectId: string;
  readonly actorUserId?: string | null;
}): Promise<ProjectCodeTaskRefinementSettings> {
  const projectId = input.projectId.trim();
  if (!projectId) {
    return {
      enableLlmCodeTaskRefinement: false,
      hasOpenaiPlannerApiKey: false,
      providerSource: "none",
    };
  }

  let setup: {
    enableLlmCodeTaskRefinement?: boolean | null;
    openaiPlannerApiKey?: string | null;
    openaiPlannerApiKeyMasked?: string | null;
  } | null = null;
  try {
    setup = await withExecutionSetupSchemaHealRetry(() =>
      prisma.executionSetup.findUnique({
        where: { projectId },
        select: {
          enableLlmCodeTaskRefinement: true,
          openaiPlannerApiKey: true,
          openaiPlannerApiKeyMasked: true,
        },
      }),
    );
  } catch {
    setup = null;
  }

  const providerContext = await resolveLlmCodeTaskRefinementProviderContext({
    projectId,
    actorUserId: input.actorUserId ?? null,
  });

  return {
    enableLlmCodeTaskRefinement: setup?.enableLlmCodeTaskRefinement === true,
    hasOpenaiPlannerApiKey: Boolean(String(providerContext.apiKey ?? "").trim()),
    providerSource: providerContext.providerSource ?? "none",
  };
}

export function resolveLlmRefinementDecision(input: {
  readonly settings: ProjectCodeTaskRefinementSettings;
  readonly forceLlm?: boolean;
  readonly projectSettingOverride?: boolean;
}): LlmRefinementDecision {
  if (input.forceLlm === true) {
    return { decision: "enabled", useLlm: true };
  }

  const projectEnabled =
    input.projectSettingOverride !== undefined
      ? input.projectSettingOverride === true
      : input.settings.enableLlmCodeTaskRefinement;

  if (!projectEnabled) {
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
