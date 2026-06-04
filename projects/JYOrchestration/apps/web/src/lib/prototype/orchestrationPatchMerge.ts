import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

/** 여러 orchestration patch를 하나로 합친다 (마지막 promptTimeline 우선). */
export function mergeOrchestrationPersistPatches(
  ...patches: readonly (PrototypeExecutionOrchestrationPersistInput | null | undefined)[]
): PrototypeExecutionOrchestrationPersistInput {
  let merged: PrototypeExecutionOrchestrationPersistInput = {};
  let timeline: readonly RequirementsPromptTimelineEntry[] | undefined;
  for (const patch of patches) {
    if (!patch) continue;
    merged = { ...merged, ...patch };
    if (patch.promptTimeline) {
      timeline = patch.promptTimeline;
    }
  }
  if (timeline) {
    merged = { ...merged, promptTimeline: timeline };
  }
  return merged;
}
