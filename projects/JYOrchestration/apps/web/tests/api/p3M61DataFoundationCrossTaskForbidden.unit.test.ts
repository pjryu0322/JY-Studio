import { describe, expect, it } from "vitest";
import {
  buildCodeTaskFileConflictPlan,
  blockingIssuesForCodeTaskExecute,
} from "@/lib/prototype/codeTaskFileConflictPlanner";
import {
  evaluateCodeTaskFileBoundaryForExecution,
  evaluateCodeTaskFileBoundaryGateFromTask,
  formatCodeTaskFileBoundaryExecutionBlockMessage,
  formatCodeTaskFileConflictCrossTaskBlockMessage,
} from "@/lib/prototype/codeTaskFileBoundaryGate";
import { CODE_TASK_FILE_BOUNDARY_VERSION } from "@/lib/prototype/codeTaskFileBoundary";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";

const SAMPLE = "CODE-DEV-SAMPLE-DATA-001-001";
const FRAME = "CODE-DEV-FRAME-001-001";

function dataTask(overrides?: Partial<ImplementationCodeTaskV1>): ImplementationCodeTaskV1 {
  return {
    codeTaskId: SAMPLE,
    parentTaskId: "DEV-SAMPLE-DATA-001",
    title: "샘플 데이터 생성",
    description: "sample",
    changeType: "data",
    targetHints: ["data"],
    acceptanceCriteria: ["ok"],
    verificationHints: ["verify"],
    forbiddenPaths: [],
    branchPlan: {
      branchGroup: "data",
      workBranch: "wip/data/sample-data",
      baseBranch: "wip/foundation/app-shell",
      executionMode: "sequential",
    },
    fileBoundary: {
      version: CODE_TASK_FILE_BOUNDARY_VERSION,
      expectedFiles: ["src/data/sample/*"],
      ownedFiles: ["src/data/sample/*"],
      forbiddenFiles: [
        "src/components/WorkspaceShell.*",
        "app/index.html",
        "src/styles/global.*",
      ],
    },
    ...overrides,
  };
}

function foundationTask(): ImplementationCodeTaskV1 {
  return {
    codeTaskId: FRAME,
    parentTaskId: "DEV-FRAME-001",
    title: "Frame",
    description: "frame",
    changeType: "component",
    targetHints: ["shell"],
    acceptanceCriteria: ["ok"],
    verificationHints: ["verify"],
    forbiddenPaths: [],
    branchPlan: {
      branchGroup: "foundation",
      workBranch: "wip/foundation/app-shell",
      baseBranch: "main",
      executionMode: "sequential",
    },
    fileBoundary: {
      version: CODE_TASK_FILE_BOUNDARY_VERSION,
      expectedFiles: ["src/components/WorkspaceShell.*"],
      ownedFiles: ["src/components/WorkspaceShell.*", "app/index.html"],
      forbiddenFiles: ["src/data/sample/*"],
    },
  };
}

describe("P3-M61 data/foundation cross-task forbidden mirrors", () => {
  it("foundation forbids sample + data owns sample is not blocking on execute", () => {
    const tasks = [foundationTask(), dataTask()];
    const plan = buildCodeTaskFileConflictPlan(tasks);
    expect(plan.issues.some((i) => i.reason === "peer_forbidden_owner_mirror")).toBe(true);
    expect(
      blockingIssuesForCodeTaskExecute({
        plan,
        codeTask: dataTask(),
        allTasks: tasks,
      }),
    ).toEqual([]);
  });

  it("data forbids shell + foundation owns shell is not blocking on execute", () => {
    const tasks = [foundationTask(), dataTask()];
    const plan = buildCodeTaskFileConflictPlan(tasks);
    expect(
      blockingIssuesForCodeTaskExecute({
        plan,
        codeTask: foundationTask(),
        allTasks: tasks,
      }).some((i) => i.reason === "forbidden_file_violation"),
    ).toBe(false);
  });

  it("data owned shell in ownedFiles is blocked at local gate", () => {
    const res = evaluateCodeTaskFileBoundaryForExecution({
      codeTaskId: SAMPLE,
      branchGroup: "data",
      ownedFiles: ["src/components/WorkspaceShell.*"],
      allowedFiles: [],
      forbiddenFiles: ["src/components/WorkspaceShell.*"],
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("shell_global_files_owned_by_non_owner_group");
    expect(res.violationFiles).toEqual(["src/components/WorkspaceShell.*"]);
    const msg = formatCodeTaskFileBoundaryExecutionBlockMessage(res);
    expect(msg).toContain("ownedFiles/allowedFiles");
  });

  it("data owned sample with shell only in forbidden passes gate", () => {
    expect(evaluateCodeTaskFileBoundaryGateFromTask(dataTask()).ok).toBe(true);
  });

  it("data owned sample overlapping data forbidden sample is blocked", () => {
    const res = evaluateCodeTaskFileBoundaryForExecution({
      codeTaskId: SAMPLE,
      branchGroup: "data",
      ownedFiles: ["src/data/sample/*"],
      allowedFiles: [],
      forbiddenFiles: ["src/data/sample/*", "src/components/WorkspaceShell.*"],
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("owned_forbidden_overlap");
  });

  it("foundation owned sample is blocked at local gate", () => {
    const res = evaluateCodeTaskFileBoundaryForExecution({
      codeTaskId: FRAME,
      branchGroup: "foundation",
      ownedFiles: ["src/data/sample/*"],
      allowedFiles: [],
      forbiddenFiles: [],
    });
    expect(res.ok).toBe(false);
  });

  it("owned overlap between data and feature on sample path blocks execute", () => {
    const feature: ImplementationCodeTaskV1 = {
      ...dataTask(),
      codeTaskId: "CODE-DEV-FEATURE-UPLOAD-001-001",
      parentTaskId: "DEV-FEATURE-UPLOAD-001",
      branchPlan: {
        branchGroup: "feature",
        workBranch: "wip/feature/upload",
        baseBranch: "wip/foundation/app-shell",
        executionMode: "sequential",
      },
      fileBoundary: {
        version: CODE_TASK_FILE_BOUNDARY_VERSION,
        expectedFiles: ["src/data/sample/*"],
        ownedFiles: ["src/data/sample/*"],
        forbiddenFiles: ["src/components/WorkspaceShell.*"],
      },
    };
    const tasks = [dataTask(), feature];
    const plan = buildCodeTaskFileConflictPlan(tasks);
    const blocking = blockingIssuesForCodeTaskExecute({
      plan,
      codeTask: dataTask(),
      allTasks: tasks,
    });
    expect(blocking.some((i) => i.reason === "owned_file_overlap")).toBe(true);
    const msg = formatCodeTaskFileConflictCrossTaskBlockMessage(blocking, "data");
    expect(msg).toContain("소유권이 충돌");
    expect(msg).toContain("src/data/sample");
  });

  it("sample-data passes file boundary gate and cross-task blocking with foundation in plan", () => {
    const frame = foundationTask();
    const sample = dataTask();
    const plan = buildCodeTaskFileConflictPlan([frame, sample]);
    expect(evaluateCodeTaskFileBoundaryGateFromTask(sample).ok).toBe(true);
    expect(
      blockingIssuesForCodeTaskExecute({
        plan,
        codeTask: sample,
        allTasks: [frame, sample],
      }),
    ).toEqual([]);
  });

  it("polluted expected shell on data task does not fail shell gate when owned is data-only", () => {
    const polluted = dataTask({
      fileBoundary: {
        version: CODE_TASK_FILE_BOUNDARY_VERSION,
        expectedFiles: ["app/index.html", "src/components/WorkspaceShell.*", "src/data/sample/*"],
        ownedFiles: ["src/data/sample/*"],
        forbiddenFiles: [
          "app/index.html",
          "src/components/WorkspaceShell.*",
          "src/styles/global.*",
        ],
      },
    });
    expect(evaluateCodeTaskFileBoundaryGateFromTask(polluted).ok).toBe(true);
  });
});
