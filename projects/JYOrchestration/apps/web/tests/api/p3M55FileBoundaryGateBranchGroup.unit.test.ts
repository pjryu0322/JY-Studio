import { describe, expect, it } from "vitest";
import { buildFileBoundaryForRole } from "@/lib/prototype/codeTaskFileBoundaryPlanner";
import {
  buildCodeTaskFileConflictPlan,
  blockingIssuesForCodeTaskExecute,
} from "@/lib/prototype/codeTaskFileConflictPlanner";
import {
  evaluateCodeTaskFileBoundaryForExecution,
  evaluateCodeTaskFileBoundaryGateFromTask,
  formatCodeTaskFileBoundaryExecutionBlockMessage,
} from "@/lib/prototype/codeTaskFileBoundaryGate";
import { tryBuildCodeTaskCursorExecutionRequest } from "@/lib/prototype/codeTaskExecutionRequest";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { CODE_TASK_FILE_BOUNDARY_VERSION } from "@/lib/prototype/codeTaskFileBoundary";

function task(partial: Partial<ImplementationCodeTaskV1> & Pick<ImplementationCodeTaskV1, "codeTaskId" | "title">): ImplementationCodeTaskV1 {
  return {
    codeTaskId: partial.codeTaskId,
    parentTaskId: partial.parentTaskId ?? "DEV-FRAME-001",
    title: partial.title,
    description: partial.description ?? partial.title,
    changeType: partial.changeType ?? "component",
    targetHints: partial.targetHints ?? ["hint"],
    dependencies: partial.dependencies ?? [],
    acceptanceCriteria: partial.acceptanceCriteria ?? ["ok"],
    verificationHints: partial.verificationHints ?? ["verify"],
    forbiddenPaths: partial.forbiddenPaths ?? ["forbidden"],
    priority: partial.priority ?? "P1",
    status: partial.status ?? "ready",
    blockers: partial.blockers ?? [],
    ...partial,
  };
}

const branchPlanFoundation = {
  branchGroup: "foundation" as const,
  workBranch: "wip/foundation/app-shell",
  baseBranch: "main",
  baseBranchPolicy: "main" as const,
  executionMode: "sequential" as const,
};

const branchPlanIntegration = {
  branchGroup: "integration" as const,
  workBranch: "wip/integration/final-wiring",
  baseBranch: "wip/screen/workspace",
  baseBranchPolicy: "integration" as const,
  executionMode: "integration_only" as const,
};

const branchPlanCommon = {
  branchGroup: "common" as const,
  workBranch: "wip/common/loading",
  baseBranch: "wip/foundation/app-shell",
  baseBranchPolicy: "foundation" as const,
  executionMode: "sequential" as const,
};

describe("P3-M55 file boundary gate branch group aware", () => {
  const foundationBoundary = buildFileBoundaryForRole("app_shell", "화면 프레임/앱 Shell 구성");

  it.each([
    "src/components/WorkspaceShell.*",
    "src/components/LeftPanel.*",
    "src/components/CenterPanel.*",
    "src/components/RightPanel.*",
    "src/styles/workspace.*",
    "app/index.html",
    "src/App.*",
  ])("foundation allows owned pattern %s", (owned) => {
    const res = evaluateCodeTaskFileBoundaryForExecution({
      codeTaskId: "CODE-DEV-FRAME-001-001",
      branchGroup: "foundation",
      ownedFiles: [owned],
      allowedFiles: [],
      forbiddenFiles: ["src/data/sample/*"],
    });
    expect(res.ok).toBe(true);
  });

  it("integration allows WorkspaceShell and route wiring patterns", () => {
    const b = buildFileBoundaryForRole("integration_wiring", "최종 연결/통합 Wiring");
    const res = evaluateCodeTaskFileBoundaryForExecution({
      codeTaskId: "CODE-DEV-INTEGRATION-001-001",
      branchGroup: "integration",
      ownedFiles: b.ownedFiles,
      allowedFiles: b.expectedFiles,
      forbiddenFiles: b.forbiddenFiles,
    });
    expect(res.ok).toBe(true);
  });

  it.each([
    ["common", "src/components/WorkspaceShell.*"],
    ["feature", "src/components/RightPanel.*"],
    ["screen", "src/styles/workspace.*"],
    ["data", "src/App.*"],
  ] as const)("blocks %s from owning %s", (branchGroup, owned) => {
    const res = evaluateCodeTaskFileBoundaryForExecution({
      codeTaskId: "X",
      branchGroup,
      ownedFiles: [owned],
      allowedFiles: [],
      forbiddenFiles: [],
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("shell_global_files_owned_by_non_owner_group");
    expect(res.violationFiles).toContain(owned);
  });

  it("blocks owned/forbidden internal overlap", () => {
    const res = evaluateCodeTaskFileBoundaryForExecution({
      codeTaskId: "X",
      branchGroup: "foundation",
      ownedFiles: ["src/components/WorkspaceShell.*"],
      allowedFiles: [],
      forbiddenFiles: ["src/components/WorkspaceShell.*"],
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("owned_forbidden_overlap");
  });

  it("foundation gate from task allows shell (regression CODE-DEV-FRAME)", () => {
    const frame = task({
      codeTaskId: "CODE-DEV-FRAME-001-001",
      title: "화면 프레임/앱 Shell 구성",
      branchPlan: branchPlanFoundation,
      fileBoundary: {
        ...foundationBoundary,
        conflictGroupId: "workspace-shell",
      },
    });
    expect(evaluateCodeTaskFileBoundaryGateFromTask(frame).ok).toBe(true);
    const integrationTask = task({
      codeTaskId: "CODE-DEV-INTEGRATION-001-001",
      title: "최종 연결/통합 Wiring",
      changeType: "integration",
      branchPlan: branchPlanIntegration,
      fileBoundary: buildFileBoundaryForRole("integration_wiring", "통합"),
    });
    const commonTask = task({
      codeTaskId: "CODE-DEV-COMMON-001",
      title: "로딩 상태",
      branchPlan: branchPlanCommon,
      fileBoundary: buildFileBoundaryForRole("common_loading", "로딩"),
    });
    const plan = buildCodeTaskFileConflictPlan([frame, integrationTask, commonTask]);
    expect(
      blockingIssuesForCodeTaskExecute({
        plan,
        codeTask: frame,
        allTasks: [frame, integrationTask, commonTask],
      }),
    ).toEqual([]);
  });

  it("messages: common shell owner includes branch group and violation files", () => {
    const res = evaluateCodeTaskFileBoundaryForExecution({
      codeTaskId: "C",
      branchGroup: "common",
      ownedFiles: ["src/components/WorkspaceShell.*"],
      allowedFiles: [],
      forbiddenFiles: [],
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    const msg = formatCodeTaskFileBoundaryExecutionBlockMessage(res);
    expect(msg).toContain("branch group: common");
    expect(msg).toContain("WorkspaceShell");
    expect(msg).toContain("requiresIntegrationChange");
  });

  it("messages: overlap uses owned/forbidden copy", () => {
    const res = evaluateCodeTaskFileBoundaryForExecution({
      codeTaskId: "F",
      branchGroup: "foundation",
      ownedFiles: ["src/components/LeftPanel.*"],
      allowedFiles: [],
      forbiddenFiles: ["src/components/LeftPanel.*"],
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    const msg = formatCodeTaskFileBoundaryExecutionBlockMessage(res);
    expect(msg).toContain("수정 허용/소유 파일과 수정 금지 파일");
  });

  it("blocks missing branch plan on cursor execute build", () => {
    const run: CodeTaskExecutionRunV1 = {
      version: "code_task_execution_run_v1",
      runId: "run-1",
      projectId: "p1",
      processTaskId: "DEV-FRAME-001",
      workItemId: "wi-1",
      codeTaskId: "CODE-DEV-FRAME-001-001",
      status: "prompt_ready",
      attemptNo: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const built = tryBuildCodeTaskCursorExecutionRequest({
      projectId: "p1",
      run,
      codeTask: task({
        codeTaskId: "CODE-DEV-FRAME-001-001",
        title: "화면 프레임/앱 Shell 구성",
        fileBoundary: {
          version: CODE_TASK_FILE_BOUNDARY_VERSION,
          expectedFiles: [],
          ownedFiles: ["src/components/WorkspaceShell.*"],
          forbiddenFiles: [],
        },
      }),
      workItem: {
        id: "wi-1",
        taskId: "DEV-FRAME-001",
        codeTaskId: "CODE-DEV-FRAME-001-001",
        title: "wi",
        prompt: "",
        requiredFilesHint: [],
        expectedOutput: [],
        testCommands: [],
        forbiddenPaths: [],
        blocked: false,
        blockers: [],
        qualityGate: { promptReady: true, missing: [], score: 100 },
      },
      targetRepository: {
        repoFullName: "o/r",
        defaultBranch: "main",
        cloneUrl: "https://github.com/o/r",
        kind: "generated_project",
      },
      baseBranch: "main",
    });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.errors).toContain("blocked_missing_branch_plan");
  });
});
