import { describe, expect, it } from "vitest";
import {
  buildFileBoundaryForRole,
  inferCodeTaskFileBoundary,
} from "@/lib/prototype/codeTaskFileBoundaryPlanner";
import {
  buildCodeTaskFileConflictPlan,
  blockingIssuesForCodeTaskExecute,
} from "@/lib/prototype/codeTaskFileConflictPlanner";
import { buildCodeTaskDeveloperPromptDetailed } from "@/lib/prototype/buildCodeTaskDeveloperPrompt";
import { runIntegrationConflictPrecheck } from "@/lib/prototype/integrationConflictPrecheck";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { repairCodeTaskPlanFileBoundaries } from "@/lib/prototype/codeTaskPlanRepairService";
import { IMPLEMENTATION_CODE_TASK_PLAN_VERSION } from "@/lib/prototype/implementationCodeTaskPlan";

function task(partial: Partial<ImplementationCodeTaskV1> & Pick<ImplementationCodeTaskV1, "codeTaskId" | "title">): ImplementationCodeTaskV1 {
  return {
    codeTaskId: partial.codeTaskId,
    parentTaskId: partial.parentTaskId ?? "DEV-1",
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

describe("P3-M45 file ownership", () => {
  it("App Shell owns WorkspaceShell and workspace.css patterns", () => {
    const b = buildFileBoundaryForRole("app_shell", "화면 프레임/앱 Shell 구성");
    expect(b.ownedFiles.some((p) => p.includes("WorkspaceShell"))).toBe(true);
    expect(b.ownedFiles.some((p) => p.includes("workspace"))).toBe(true);
  });

  it("Sample Data owns data paths only", () => {
    const b = buildFileBoundaryForRole("mock_data", "샘플 데이터 생성");
    expect(b.ownedFiles.some((p) => p.includes("src/data/sample"))).toBe(true);
    expect(b.forbiddenFiles.some((p) => p.includes("WorkspaceShell"))).toBe(true);
  });

  it("Common loading owns common components and forbids shell", () => {
    const b = buildFileBoundaryForRole("common_loading", "로딩 상태");
    expect(b.ownedFiles.some((p) => p.includes("LoadingState"))).toBe(true);
    expect(b.forbiddenFiles.some((p) => p.includes("WorkspaceShell"))).toBe(true);
  });

  it("Screen task forbids shell/global style", () => {
    const b = inferCodeTaskFileBoundary({
      codeTask: task({ codeTaskId: "CODE-1", title: "결과 화면 구현" }),
    });
    expect(b.forbiddenFiles.some((p) => p.includes("workspace"))).toBe(true);
  });

  it("ownedFiles overlap is blocking and creates conflict group", () => {
    const shell = task({
      codeTaskId: "A",
      title: "Shell",
      fileBoundary: buildFileBoundaryForRole("app_shell", "Shell"),
    });
    const other = task({
      codeTaskId: "B",
      title: "Other shell",
      fileBoundary: {
        ...buildFileBoundaryForRole("app_shell", "Shell copy"),
        conflictGroupId: null,
      },
    });
    const plan = buildCodeTaskFileConflictPlan([shell, other]);
    expect(plan.issues.some((i) => i.severity === "blocking" && i.reason === "shared_shell_file")).toBe(
      true,
    );
    expect(plan.conflictGroups.some((g) => g.groupId === "workspace-shell")).toBe(true);
  });

  it("developer prompt includes allowed/forbidden sections and integration hint", () => {
    const codeTask = task({
      codeTaskId: "CODE-DEV-1",
      title: "공통 로딩 상태",
    });
    const { prompt } = buildCodeTaskDeveloperPromptDetailed({
      codeTask,
      targetRepository: { gitRepoUrl: "https://github.com/o/r", repoFullName: "o/r", provider: "github" },
      baseBranch: "main",
      targetRepoKind: "generated_project",
    });
    expect(prompt).toContain("## 수정 허용 파일");
    expect(prompt).toContain("## 수정 금지 파일");
    expect(prompt).toContain("requiresIntegrationChange");
    expect(prompt.includes("관련 파일을 찾아 자유롭게")).toBe(false);
  });

  it("integration precheck passes without overlap", () => {
    const pre = runIntegrationConflictPrecheck({
      included: [
        {
          codeTaskId: "A",
          taskId: "DEV",
          title: "a",
          status: "completed",
          workBranch: "wip/a",
          source: "runtime_run",
        },
      ],
      codeTaskPlan: null,
      codeTaskRuns: [
        {
          runId: "r1",
          version: "code_task_execution_run_v1",
          projectId: "p",
          processTaskId: "DEV",
          workItemId: "w",
          codeTaskId: "A",
          status: "completed",
          attemptNo: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          changedFiles: ["src/a.js"],
        },
      ],
    });
    expect(pre.status).toBe("passed");
  });

  it("integration precheck blocks independent overlap", () => {
    const pre = runIntegrationConflictPrecheck({
      included: [
        {
          codeTaskId: "A",
          taskId: "DEV",
          title: "a",
          status: "completed",
          workBranch: "wip/a",
          source: "runtime_run",
        },
        {
          codeTaskId: "B",
          taskId: "DEV",
          title: "b",
          status: "completed",
          workBranch: "wip/b",
          source: "runtime_run",
        },
      ],
      codeTaskPlan: {
        version: IMPLEMENTATION_CODE_TASK_PLAN_VERSION,
        projectId: "p",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        source: "implementation_task_list",
        parentTaskCount: 1,
        codeTaskCount: 2,
        tasks: [
          task({ codeTaskId: "A", title: "a" }),
          task({ codeTaskId: "B", title: "b" }),
        ],
        readiness: { ready: true, missing: [] },
      },
      codeTaskRuns: [
        {
          runId: "r1",
          version: "code_task_execution_run_v1",
          projectId: "p",
          processTaskId: "DEV",
          workItemId: "w",
          codeTaskId: "A",
          status: "completed",
          attemptNo: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          changedFiles: ["src/shared.js"],
        },
        {
          runId: "r2",
          version: "code_task_execution_run_v1",
          projectId: "p",
          processTaskId: "DEV",
          workItemId: "w",
          codeTaskId: "B",
          status: "completed",
          attemptNo: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          changedFiles: ["src/shared.js"],
        },
      ],
    });
    expect(pre.status).toBe("blocking");
  });

  it("does not block foundation Cursor execute for planned shell overlap with integration", () => {
    const shell = task({
      codeTaskId: "CODE-DEV-FRAME-001-001",
      title: "화면 프레임/앱 Shell 구성",
      fileBoundary: {
        ...buildFileBoundaryForRole("app_shell", "화면 프레임/앱 Shell"),
        conflictGroupId: "workspace-shell",
      },
      branchPlan: {
        branchGroup: "foundation",
        workBranch: "wip/foundation/app-shell",
        baseBranch: "main",
        baseBranchPolicy: "main",
        executionMode: "sequential",
      },
    });
    const integration = task({
      codeTaskId: "CODE-DEV-INTEGRATION-001-001",
      title: "최종 연결/통합 Wiring",
      changeType: "integration",
      fileBoundary: buildFileBoundaryForRole("integration_wiring", "최종 연결/통합 Wiring"),
      branchPlan: {
        branchGroup: "integration",
        workBranch: "wip/integration/final-wiring",
        baseBranch: "wip/screen/workspace",
        baseBranchPolicy: "integration",
        executionMode: "integration_only",
      },
    });
    const plan = buildCodeTaskFileConflictPlan([shell, integration]);
    expect(plan.issues.some((i) => i.severity === "blocking")).toBe(true);
    expect(
      blockingIssuesForCodeTaskExecute({
        plan,
        codeTask: shell,
        allTasks: [shell, integration],
      }),
    ).toEqual([]);
  });

  it("allows App Shell Cursor execute when common tasks forbid shell paths (forbidden overlap)", () => {
    const shell = task({
      codeTaskId: "CODE-DEV-SHELL-001",
      title: "화면 프레임/앱 Shell 구성",
      branchPlan: {
        branchGroup: "foundation",
        workBranch: "wip/foundation/app-shell",
        baseBranch: "main",
        baseBranchPolicy: "main",
        executionMode: "sequential",
      },
      fileBoundary: {
        ...buildFileBoundaryForRole("app_shell", "화면 프레임/앱 Shell 구성"),
        conflictGroupId: "workspace-shell",
      },
    });
    const common = task({
      codeTaskId: "CODE-DEV-COMMON-001",
      title: "로딩 상태 공통 기능 구현",
      fileBoundary: buildFileBoundaryForRole("common_loading", "로딩 상태"),
    });
    const integration = task({
      codeTaskId: "CODE-DEV-INTEGRATION-001-001",
      title: "최종 연결/통합 Wiring",
      changeType: "integration",
      fileBoundary: buildFileBoundaryForRole("integration_wiring", "최종 연결/통합 Wiring"),
    });
    const plan = buildCodeTaskFileConflictPlan([shell, common, integration]);
    expect(
      plan.issues.some(
        (i) =>
          i.reason === "peer_forbidden_owner_mirror" ||
          i.reason === "peer_forbidden_owner_overlap",
      ),
    ).toBe(true);
    expect(
      blockingIssuesForCodeTaskExecute({
        plan,
        codeTask: shell,
        allTasks: [shell, common, integration],
      }),
    ).toEqual([]);
  });

  it("repair plan assigns boundaries and conflict plan", () => {
    const repaired = repairCodeTaskPlanFileBoundaries({
      plan: {
        version: IMPLEMENTATION_CODE_TASK_PLAN_VERSION,
        projectId: "p",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        source: "implementation_task_list",
        parentTaskCount: 1,
        codeTaskCount: 2,
        tasks: [
          task({ codeTaskId: "A", title: "화면 프레임/앱 Shell" }),
          task({ codeTaskId: "B", title: "로딩 상태" }),
        ],
        readiness: { ready: true, missing: [] },
      },
    });
    expect(repaired.plan.tasks.every((t) => t.fileBoundary)).toBe(true);
    expect(repaired.conflictPlan.issues.length).toBeGreaterThanOrEqual(0);
  });
});
