import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import { appendPromptTimelineEntries } from "@/lib/prototype/implementationTaskListWipPrep";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import type { ProjectIntegrationPipelineResultV1 } from "@/lib/prototype/projectIntegrationPipelineService";
import {
  mergeRequirementsStateJson,
  type RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";

export function buildProjectIntegrationPipelinePersistState(input: {
  readonly projectId: string;
  readonly persisted: RequirementsStateJson;
  readonly outcome: ProjectIntegrationPipelineResultV1;
  readonly plan: CodeTaskIntegrationPlanV1;
  readonly nowIso?: string;
}): RequirementsStateJson {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const persistLogs = [
    buildImplementationExecutionLogTimelineEntry({
      action: "project_integration_pipeline_result_persist_started",
      orchestrationTraceGroup: "project_integration_pipeline",
      fields: { projectId: input.projectId },
      nowIso,
    }),
    buildImplementationExecutionLogTimelineEntry({
      action: "project_integration_pipeline_result_persisted",
      orchestrationTraceGroup: "project_integration_pipeline",
      fields: {
        projectId: input.projectId,
        previewReady: input.outcome.previewReady,
        status: input.outcome.status,
      },
      nowIso,
    }),
  ];

  const timeline = appendPromptTimelineEntries(
    appendPromptTimelineEntries(input.persisted.promptTimeline ?? [], input.outcome.timelineEntries),
    persistLogs,
  );

  return mergeRequirementsStateJson(input.persisted, {
    ...(input.outcome.orchestrationPatch ?? {}),
    ...(input.outcome.previewRuntimePatch ?? {}),
    codeTaskIntegrationPlanV1: input.plan,
    promptTimeline: timeline,
  }) as RequirementsStateJson;
}
