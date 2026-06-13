import { describe, expect, it } from "vitest";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { buildImplementationResetWithPlanningReentry } from "@/lib/requirements/implementationSessionResetReentry";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type { ArtifactOrchestrationStateV1 } from "@/lib/requirements/artifactOrchestration";

const nowIso = "2026-06-06T12:00:00.000Z";

function quickDesignPrepArtifacts(): readonly ProjectArtifact[] {
  return [
    {
      id: "a-summary",
      type: "project-summary",
      title: "프로젝트 요약서",
      createdAt: nowIso,
      createdBy: "ai",
      sourceStage: "feature-planning",
      content: "summary body with enough detail for planning gate",
    },
    {
      id: "a-feature",
      type: "feature-spec",
      title: "기능 정의서",
      createdAt: nowIso,
      createdBy: "ai",
      sourceStage: "feature-planning",
      content: "feature body with enough detail for planning gate",
    },
  ] as ProjectArtifact[];
}

const quickDesignArtifactOrchestration: ArtifactOrchestrationStateV1 = {
  requiredTypes: ["project-summary", "feature-spec"],
  ready: true,
  planningSummary: "ok",
} as ArtifactOrchestrationStateV1;

describe("buildImplementationResetWithPlanningReentry", () => {
  it("clears implementation session then rebuilds seed, task list, and code task plan", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p-reset-reentry",
      projectName: "회의록",
    });
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const base: RequirementsStateJson = {
      projectArtifacts: [...quickDesignPrepArtifacts()],
      artifactOrchestrationV1: quickDesignArtifactOrchestration,
      singleChatOrchestrationV1: orchestration,
      implementationSeedV1: { version: "implementation_seed_v1", projectId: "p-reset-reentry" } as never,
      implementationTaskListV1: { version: 1, projectId: "p-reset-reentry", tasks: [{ taskId: "DEV-1" }] } as never,
      implementationCodeTaskPlanV1: { version: 1, projectId: "p-reset-reentry", tasks: [{ codeTaskId: "CODE-1" }] } as never,
      codeTaskExecutionRunsV1: [{ codeTaskId: "CODE-1", status: "completed" }] as never,
      promptTimeline: [
        {
          stage: "implementation",
          stageGroup: "구현",
          workspaceScreenKey: "prototype_execution",
          action: "task_cursor_api_started",
          source: "platform",
          responseText: "run",
          createdAt: nowIso,
        },
      ],
    };

    const result = buildImplementationResetWithPlanningReentry({
      base,
      nowIso,
      projectId: "p-reset-reentry",
      projectName: "회의록",
      slotDefinitions: definitions,
      envOk: true,
      designOk: true,
    });

    expect(result.ok).toBe(true);
    expect(result.state.codeTaskExecutionRunsV1).toBeNull();
    expect(result.state.implementationSeedV1).toBeTruthy();
    expect((result.state.implementationTaskListV1?.tasks?.length ?? 0) > 0).toBe(true);
    expect((result.state.implementationCodeTaskPlanV1?.tasks?.length ?? 0) > 0).toBe(true);
    expect(result.state.implementationCodeTaskPlanV1).toBeTruthy();
    expect((result.state.cursorWorkItemsV1?.length ?? 0) > 0).toBe(true);
    expect(result.state.requirementsOrchestrationStageV1?.activePhase).toBe("IMPLEMENTATION_RUNNING");
    expect(
      result.state.promptTimeline?.some(
        (e) => e.action === "quick_design_confirmed_planning_ready_for_implementation_execution",
      ),
    ).toBe(true);
    expect(result.state.promptTimeline?.some((e) => e.action === "task_cursor_api_started")).toBe(false);
  });
});
