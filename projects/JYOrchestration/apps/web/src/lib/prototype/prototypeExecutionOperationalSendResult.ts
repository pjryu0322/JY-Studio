import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type PrototypeExecutionOperationalSendResult =
  | "handled"
  | "continue"
  | Readonly<{
      kind: "status_query";
      aiMessage: RequirementsMessage;
      timelineEntries?: readonly RequirementsPromptTimelineEntry[];
    }>
  | Readonly<{
      kind: "assistant_reply";
      aiMessage: RequirementsMessage;
      timelineEntries?: readonly RequirementsPromptTimelineEntry[];
      afterPersist?: "start_prototype_work_plan";
    }>
  | Readonly<{
      kind: "apply_conversation";
      messages: readonly RequirementsMessage[];
      timelineEntries?: readonly RequirementsPromptTimelineEntry[];
      orchestration?: PrototypeExecutionOrchestrationPersistInput;
    }>
  | Readonly<{
      kind: "timeline_only";
      timelineEntries: readonly RequirementsPromptTimelineEntry[];
    }>
  | Readonly<{
      kind: "start_implementation_quick_run";
      timelineEntries?: readonly RequirementsPromptTimelineEntry[];
    }>
  | Readonly<{
      kind: "stage_action_run";
      run: import("@/lib/prototype/implementationStageActionRun").ImplementationStageActionRun;
    }>;
