import { describe, expect, it } from "vitest";
import { resolveManualGithubRecheckPayload } from "@/lib/prototype/codeTaskManualGithubRecheckPayload";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";

const NOW = "2026-06-04T00:00:00.000Z";

const samplePlan: ImplementationCodeTaskPlanV1 = {
  version: "implementation_code_task_plan_v1",
  projectId: "p1",
  codeTaskCount: 1,
  tasks: [
    {
      codeTaskId: "CODE-DATA-SAMPLE-001",
      parentTaskId: "DEV-MOCK-001",
      title: "sample",
      description: "d",
      acceptanceCriteria: [],
      dependencies: [],
      branchPlan: {
        version: "code_task_branch_plan_v1",
        branchGroup: "data",
        baseBranch: "wip/foundation/app-shell",
        workBranch: "wip/data/sample-data",
      },
    },
  ],
  createdAt: NOW,
  updatedAt: NOW,
};

describe("resolveManualGithubRecheckPayload", () => {
  it("resolves workBranch and repository from plan and execution setup", () => {
    const unit: ImplementationExecutionUnitV1 = {
      unitId: "CODE-DATA-SAMPLE-001",
      codeTaskId: "CODE-DATA-SAMPLE-001",
      processTaskId: "DEV-MOCK-001",
      title: "sample",
      order: 15,
      branchGroup: "data",
      baseBranch: "wip/foundation/app-shell",
      workBranch: "wip/data/sample-data",
      dependencies: [],
      status: "verifying",
    };
    const result = resolveManualGithubRecheckPayload({
      projectId: "p1",
      codeTaskId: "CODE-DATA-SAMPLE-001",
      requirementsState: { implementationCodeTaskPlanV1: samplePlan },
      executionSetup: {
        gitRepoName: "pjryu0322/aiprogect",
        gitRepoProvider: "github",
      },
      executionUnits: [unit],
    });
    expect(result.missing).toEqual([]);
    expect(result.payload?.workBranch).toBe("wip/data/sample-data");
    expect(result.payload?.baseBranch).toBe("wip/foundation/app-shell");
    expect(result.payload?.repositoryOwner).toBe("pjryu0322");
    expect(result.payload?.repositoryName).toBe("aiprogect");
    expect(result.payload?.codeTaskId).toBe("CODE-DATA-SAMPLE-001");
  });

  it("reports missing fields when repository and branch cannot be resolved", () => {
    const result = resolveManualGithubRecheckPayload({
      projectId: "p1",
      codeTaskId: "CODE-UNKNOWN",
      requirementsState: {},
    });
    expect(result.payload).toBeNull();
    expect(result.missing.length).toBeGreaterThan(0);
  });
});
