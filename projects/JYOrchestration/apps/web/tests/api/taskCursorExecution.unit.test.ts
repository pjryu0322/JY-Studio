import { describe, expect, it } from "vitest";
import {
  buildInitialTaskCursorExecution,
  buildTaskCursorWorkBranch,
  mapTaskCursorApiFailureReason,
  parseTaskCursorExecutionV1,
  TASK_CURSOR_FAILURE_MESSAGES,
  validateTaskCursorExecuteApiResult,
} from "@/lib/prototype/taskCursorExecution";
import { buildTaskCursorExecutionRequest } from "@/lib/prototype/prototypeExecutionTaskCursorActions";
import { buildCursorWorkItemsFromImplementationTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationTaskPlan } from "@/lib/prototype/implementationTaskPlan";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";

const plan = buildImplementationTaskPlan({
  projectId: "p1",
  projectArtifacts: [],
  featureDraftTitles: ["upload"],
  envOk: true,
  designOk: true,
});
const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);
const taskId = plan.items[0]?.id ?? "DEV-MOCK-001";
const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
  gitRepoName: "owner/repo",
  baseBranch: "main",
})!;

describe("taskCursorExecution", () => {
  it("builds work branch from task id", () => {
    expect(buildTaskCursorWorkBranch("DEV-MOCK-001")).toBe("wip/cursor/dev-mock-001");
  });

  it("creates initial pending execution", () => {
    const execution = buildInitialTaskCursorExecution({
      projectId: "p1",
      taskId,
      workItemIds: workItems.map((w) => w.id),
      targetRepository: targetRepository.repoFullName,
      baseBranch: "main",
    });
    expect(execution.status).toBe("pending");
    expect(execution.version).toBe("task_cursor_execution_v1");
  });

  it("buildTaskCursorExecutionRequest sets prompt_ready without WIP draft", () => {
    const execution = buildTaskCursorExecutionRequest({
      projectId: "p1",
      taskId,
      workItemIds: workItems.filter((w) => w.taskId === taskId).map((w) => w.id),
      workItems: workItems.filter((w) => w.taskId === taskId),
      targetRepository,
      baseBranch: "main",
      allowedPathGlobs: ["src/**"],
    });
    expect(execution.status).toBe("prompt_ready");
    expect(execution.cursorPrompt?.length).toBeGreaterThan(0);
  });

  it("rejects wip-stub sha on success validation", () => {
    const result = validateTaskCursorExecuteApiResult({
      ok: true,
      status: "completed",
      taskId,
      commitSha: "wip-stub-1",
      pushed: true,
      changedFiles: ["src/a.ts"],
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("commit_not_created");
  });

  it("rejects success without push or changed files", () => {
    expect(
      validateTaskCursorExecuteApiResult({
        ok: true,
        status: "completed",
        taskId,
        commitSha: "abc123def4567890",
        pushed: false,
        changedFiles: ["src/a.ts"],
      }).reason,
    ).toBe("push_failed");
    expect(
      validateTaskCursorExecuteApiResult({
        ok: true,
        status: "completed",
        taskId,
        commitSha: "abc123def4567890",
        pushed: true,
        changedFiles: [],
      }).reason,
    ).toBe("no_changed_files");
  });

  it("rejects diffSummary-only success without commit evidence", () => {
    const result = validateTaskCursorExecuteApiResult({
      ok: true,
      status: "completed",
      taskId,
      diffSummary: ["결과 화면 ui"],
      pushed: false,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("commit_not_created");
  });

  it("accepts noCodeChangeEvidence when inspection proof is present", () => {
    const result = validateTaskCursorExecuteApiResult({
      ok: true,
      status: "completed",
      taskId,
      noCodeChangeEvidence: {
        noCodeChange: true,
        reason: "already implemented",
        inspectedFiles: ["src/App.tsx"],
        validationSummary: "existing tests pass",
      },
    });
    expect(result.ok).toBe(true);
  });

  it("buildTaskCursorExecutionRequest includes completion requirements", () => {
    const execution = buildTaskCursorExecutionRequest({
      projectId: "p1",
      taskId,
      workItemIds: workItems.filter((w) => w.taskId === taskId).map((w) => w.id),
      workItems: workItems.filter((w) => w.taskId === taskId),
      targetRepository,
      baseBranch: "main",
      allowedPathGlobs: ["src/**"],
    });
    expect(execution.cursorPrompt).toContain("## 작업 완료 조건");
    expect(execution.cursorPrompt).toContain("noCodeChange=true");
  });

  it("maps endpoint unsupported reason", () => {
    expect(mapTaskCursorApiFailureReason({ httpStatus: 404 })).toBe("cursor_endpoint_unsupported");
    expect(TASK_CURSOR_FAILURE_MESSAGES.cursor_endpoint_unsupported).toContain("Task 단위");
  });

  it("round-trips parseTaskCursorExecutionV1", () => {
    const raw = buildInitialTaskCursorExecution({
      projectId: "p1",
      taskId,
      workItemIds: ["wi-1"],
      targetRepository: "owner/repo",
      baseBranch: "main",
    });
    const parsed = parseTaskCursorExecutionV1(raw);
    expect(parsed?.taskId).toBe(taskId);
    expect(parsed?.status).toBe("pending");
  });
});
