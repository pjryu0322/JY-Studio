import { describe, expect, it } from "vitest";
import { resolveCodeTaskDeveloperPromptForCopy } from "@/lib/prototype/resolveCodeTaskDeveloperPromptForCopy";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";

const NOW = "2026-06-04T00:00:00.000Z";

const plan: ImplementationCodeTaskPlanV1 = {
  version: "implementation_code_task_plan_v1",
  projectId: "p1",
  createdAt: NOW,
  updatedAt: NOW,
  tasks: [
    {
      codeTaskId: "CT-1",
      parentTaskId: "DEV-1",
      title: "화면",
      priority: "P1",
      dependencies: [],
      acceptanceCriteria: [],
      deliverables: [],
    },
  ],
};

const run: CodeTaskExecutionRunV1 = {
  version: "code_task_execution_run_v1",
  runId: "run-1",
  projectId: "p1",
  processTaskId: "DEV-1",
  workItemId: "wi-1",
  codeTaskId: "CT-1",
  status: "prompt_ready",
  attemptNo: 1,
  developerPrompt: "CURSOR PROMPT BODY",
  createdAt: NOW,
  updatedAt: NOW,
};

describe("resolveCodeTaskDeveloperPromptForCopy", () => {
  it("copies stored developerPrompt from latest run", () => {
    const result = resolveCodeTaskDeveloperPromptForCopy({
      projectId: "p1",
      codeTaskId: "CT-1",
      codeTaskPlan: plan,
      taskList: null,
      cursorWorkItems: [
        {
          id: "wi-1",
          taskId: "DEV-1",
          title: "wi",
          description: "d",
          allowedPathGlobs: ["src/**"],
          refinementStatus: "preflight_passed",
        },
      ],
      runs: [run],
      targetRepository: {
        owner: "o",
        repo: "r",
        defaultBranch: "main",
        repoFullName: "o/r",
      },
      baseBranch: "main",
    });
    expect(result.ok).toBe(true);
    expect(result.prompt).toBe("CURSOR PROMPT BODY");
  });
});
