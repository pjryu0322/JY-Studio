import { describe, expect, it } from "vitest";
import { enqueueNextTaskCursorJobAfterTerminal } from "@/lib/prototype/taskCursorServerAutoChain";
import { buildPlanningDataSlotsDraft, buildPlanningHandoffForImplementation } from "@/lib/planning/planningDataSlotsV1";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

describe("taskCursorServerAutoChain database guard", () => {
  it("does not enqueue next job when planning handoff is database-blocked", async () => {
    const draft = buildPlanningDataSlotsDraft({
      repositoryName: "app",
      orchestration: null,
      definitions: [],
    });
    const handoff = buildPlanningHandoffForImplementation({
      projectId: "p1",
      repositoryName: "app",
      planningDataSlots: draft,
    });
    const execution = {
      taskId: "TASK-1",
      projectId: "p1",
      status: "github_verified",
      workItemIds: ["wi-1"],
      targetRepository: { repoFullName: "org/repo", defaultBranch: "main", cloneUrl: "https://github.com/org/repo" },
      baseBranch: "main",
    } as TaskCursorExecutionV1;
    const result = await enqueueNextTaskCursorJobAfterTerminal({
      projectId: "p1",
      execution,
      requirementsState: {
        planningHandoffForImplementationV1: handoff,
        cursorWorkItemsV1: [
          {
            id: "wi-1",
            taskId: "TASK-1",
            codeTaskId: "CT-1",
            title: "t",
            prompt: "p",
            requiredFilesHint: [],
            expectedOutput: [],
            testCommands: [],
            forbiddenPaths: [],
            blocked: false,
            blockers: [],
            qualityGate: { score: 1, promptReady: true, missing: [] },
          },
        ],
      },
    });
    expect(result.enqueuedJobId).toBeUndefined();
    expect(result.orchestrationPatch).toBeUndefined();
  });
});
