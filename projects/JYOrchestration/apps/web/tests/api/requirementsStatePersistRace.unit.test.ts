import { describe, expect, it } from "vitest";
import { buildInitialCodeAgentWipExecution } from "@/lib/prototype/codeAgentWipExecution";
import { buildCursorWorkItemsFromImplementationTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationTaskPlan } from "@/lib/prototype/implementationTaskPlan";
import {
  appendPromptTimeline,
  buildPrototypeExecutionOrchestrationPersistPatch,
} from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { buildImplementationStageActionRoutedTimelineEntry } from "@/lib/prototype/implementationStageActionPipeline";

const plan = buildImplementationTaskPlan({
  projectId: "p1",
  projectArtifacts: [],
  featureDraftTitles: ["upload"],
  envOk: true,
  designOk: true,
});
const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);

describe("requirementsStatePersistRace", () => {
  it("timeline-only persist on stale base drops codeAgentWipExecutionV1 (bug pattern)", () => {
    const staleBase = {};
    const wip = buildInitialCodeAgentWipExecution({
      projectId: "p1",
      plan,
      workItems,
      selectedTaskId: "DEV-SCREEN-001",
      executionMode: "stub",
      bridgeExecutionStatus: "draft_created",
    });
    const withWip = buildPrototypeExecutionOrchestrationPersistPatch(staleBase, {
      codeAgentWipExecutionV1: wip,
      promptTimeline: [
        {
          stage: "implementation",
          action: "implementation_wip_draft_created",
          source: "platform",
          createdAt: "2026-05-29T18:52:41.730Z",
        },
      ],
    });
    expect(withWip.codeAgentWipExecutionV1?.selectedTaskId).toBe("DEV-SCREEN-001");

    const timelineOnlyOnStale = buildPrototypeExecutionOrchestrationPersistPatch(staleBase, {
      promptTimeline: [
        ...appendPromptTimeline(undefined, buildImplementationStageActionRoutedTimelineEntry("REQUEST_CODE_AGENT_WIP", "cta", "run-1")),
      ],
    });
    expect(timelineOnlyOnStale.codeAgentWipExecutionV1).toBeUndefined();
  });

  it("timeline-only persist on latest base keeps codeAgentWipExecutionV1 (fixed pattern)", () => {
    const staleBase = {};
    const wip = buildInitialCodeAgentWipExecution({
      projectId: "p1",
      plan,
      workItems,
      selectedTaskId: "DEV-SCREEN-001",
      executionMode: "stub",
      bridgeExecutionStatus: "draft_created",
    });
    const latestBase = buildPrototypeExecutionOrchestrationPersistPatch(staleBase, {
      codeAgentWipExecutionV1: wip,
      promptTimeline: [
        {
          stage: "implementation",
          action: "implementation_wip_draft_created",
          source: "platform",
          createdAt: "2026-05-29T18:52:41.730Z",
        },
      ],
    });

    const merged = buildPrototypeExecutionOrchestrationPersistPatch(latestBase, {
      promptTimeline: [
        ...appendPromptTimeline(latestBase.promptTimeline, buildImplementationStageActionRoutedTimelineEntry("REQUEST_CODE_AGENT_WIP", "cta", "run-1")),
      ],
    });
    expect(merged.codeAgentWipExecutionV1?.selectedTaskId).toBe("DEV-SCREEN-001");
    expect(merged.promptTimeline?.some((e) => e.action === "implementation_wip_draft_created")).toBe(true);
    expect(merged.promptTimeline?.some((e) => e.action === "implementation_stage_action_routed")).toBe(true);
  });
});
