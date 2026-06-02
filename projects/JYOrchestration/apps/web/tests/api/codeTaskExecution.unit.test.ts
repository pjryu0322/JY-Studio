import { describe, expect, it } from "vitest";
import { buildCodeTaskDeveloperPrompt } from "@/lib/prototype/buildCodeTaskDeveloperPrompt";
import {
  advanceCodeTaskExecutionQueue,
  expandProcessTaskIdsToCodeTaskIds,
  getCurrentQueueCodeTaskId,
  resolveSelectedCodeTaskIdsForQueue,
  startCodeTaskExecutionQueue,
} from "@/lib/prototype/codeTaskExecutionQueue";
import { classifyCodeTaskExecutionRunFromTaskCursor } from "@/lib/prototype/codeTaskExecutionRunResult";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

const NOW = "2026-06-01T12:00:00.000Z";

function samplePlan(): ImplementationCodeTaskPlanV1 {
  return {
    version: "implementation_code_task_plan_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    tasks: [
      {
        codeTaskId: "CT-1",
        parentTaskId: "DEV-A",
        title: "목록 API",
        description: "회의록 목록 API를 구현한다.",
        changeType: "feature",
        acceptanceCriteria: ["목록 조회 API 동작"],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: ["src/api/meetings.ts"],
        candidateFileHints: [],
      },
      {
        codeTaskId: "CT-2",
        parentTaskId: "DEV-A",
        title: "Mock 연결",
        description: "Mock 데이터를 연결한다.",
        changeType: "feature",
        acceptanceCriteria: ["Mock 데이터 표시"],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
        candidateFileHints: [],
      },
      {
        codeTaskId: "CT-3",
        parentTaskId: "DEV-B",
        title: "업로드 UI",
        description: "업로드 화면을 구현한다.",
        changeType: "feature",
        acceptanceCriteria: ["파일 업로드"],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
        candidateFileHints: [],
      },
    ],
  };
}

function baseExecution(overrides: Partial<TaskCursorExecutionV1> = {}): TaskCursorExecutionV1 {
  return {
    version: "task_cursor_execution_v1",
    projectId: "p1",
    taskId: "DEV-A",
    workItemIds: ["w1"],
    status: "cursor_completed",
    cursorProvider: "cursor",
    targetRepository: "org/repo",
    baseBranch: "main",
    workBranch: "wip/cursor/dev-a",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("code task execution queue", () => {
  it("starts queue at index 0 with running status", () => {
    const queue = startCodeTaskExecutionQueue({
      projectId: "p1",
      selectedCodeTaskIds: ["CT-1", "CT-2", "CT-3"],
      nowIso: NOW,
    });
    expect(queue?.currentIndex).toBe(0);
    expect(queue?.status).toBe("running");
    expect(getCurrentQueueCodeTaskId(queue)).toBe("CT-1");
  });

  it("expands process task selection to code tasks without mock gate", () => {
    const plan = samplePlan();
    const ids = expandProcessTaskIdsToCodeTaskIds({
      codeTaskPlan: plan,
      processTaskIds: ["DEV-A"],
    });
    expect(ids).toEqual(["CT-1", "CT-2"]);
    expect(ids).not.toContain("DEV-MOCK-001");
  });

  it("continues to next code task after failure by default", () => {
    const queue = startCodeTaskExecutionQueue({
      projectId: "p1",
      selectedCodeTaskIds: ["CT-1", "CT-2"],
      nowIso: NOW,
    })!;
    const advanced = advanceCodeTaskExecutionQueue({
      queue,
      lastRunStatus: "failed",
      nowIso: NOW,
    });
    expect(advanced.finished).toBe(false);
    expect(advanced.nextCodeTaskId).toBe("CT-2");
    expect(advanced.queue.currentIndex).toBe(1);
  });

  it("stops queue on failure when stopOnFailure is set", () => {
    const queue = startCodeTaskExecutionQueue({
      projectId: "p1",
      selectedCodeTaskIds: ["CT-1", "CT-2"],
      stopOnFailure: true,
      nowIso: NOW,
    })!;
    const advanced = advanceCodeTaskExecutionQueue({
      queue,
      lastRunStatus: "failed",
      nowIso: NOW,
    });
    expect(advanced.finished).toBe(true);
    expect(advanced.queue.status).toBe("failed");
    expect(advanced.nextCodeTaskId).toBeNull();
  });

  it("prefers explicit code task ids over process expansion", () => {
    const ids = resolveSelectedCodeTaskIdsForQueue({
      codeTaskPlan: samplePlan(),
      processTaskIds: ["DEV-A", "DEV-B"],
      explicitCodeTaskIds: ["CT-2"],
    });
    expect(ids).toEqual(["CT-2"]);
  });
});

describe("buildCodeTaskDeveloperPrompt", () => {
  it("includes acceptance criteria and github pr requirements", () => {
    const prompt = buildCodeTaskDeveloperPrompt({
      codeTask: samplePlan().tasks[0]!,
      parentTask: {
        taskId: "DEV-A",
        title: "회의록 목록",
        description: "목록 화면",
        taskType: "feature",
        ownerRole: "developer",
        priority: "high",
        dependencies: [],
        acceptanceCriteria: [],
        status: "ready",
      },
      targetRepository: {
        repoFullName: "org/repo",
        defaultBranch: "main",
        provider: "github",
      },
      baseBranch: "main",
    });
    expect(prompt).toContain("목록 API");
    expect(prompt).toContain("목록 조회 API 동작");
    expect(prompt).toMatch(/commit.*push.*PR/i);
    expect(prompt).toContain("noCodeChange");
  });
});

describe("classifyCodeTaskExecutionRunFromTaskCursor", () => {
  it("requires github evidence when cursor says completed", () => {
    const result = classifyCodeTaskExecutionRunFromTaskCursor(baseExecution());
    expect(result.status).toBe("rework_required");
  });

  it("marks completed when branch head commit exists", () => {
    const result = classifyCodeTaskExecutionRunFromTaskCursor(
      baseExecution({
        status: "github_verified",
        commitSha: "abc123",
      }),
    );
    expect(result.status).toBe("completed");
  });

  it("marks no_code_change_completed when evidence exists", () => {
    const result = classifyCodeTaskExecutionRunFromTaskCursor(
      baseExecution({
        status: "github_verified",
        noCodeChangeEvidence: {
          validationSummary: "이미 구현되어 변경 불필요",
        },
      } as TaskCursorExecutionV1),
    );
    expect(result.status).toBe("no_code_change_completed");
  });
});
