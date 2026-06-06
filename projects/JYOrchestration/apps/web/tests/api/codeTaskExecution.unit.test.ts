import { describe, expect, it } from "vitest";
import { buildCodeTaskDeveloperPrompt } from "@/lib/prototype/buildCodeTaskDeveloperPrompt";
import {
  advanceCodeTaskExecutionQueue,
  expandProcessTaskIdsToCodeTaskIds,
  getCurrentQueueCodeTaskId,
  resolveQueueFinalStatusFromRunStatuses,
  resolveSelectedCodeTaskIdsForQueue,
  startCodeTaskExecutionQueue,
} from "@/lib/prototype/codeTaskExecutionQueue";
import { classifyCodeTaskExecutionRunFromTaskCursor } from "@/lib/prototype/codeTaskExecutionRunResult";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { buildCodeTaskWorkBranch } from "@/lib/prototype/taskCursorExecution";
import { buildImplementationTaskListFromSeed } from "@/lib/requirements/implementationTaskList";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
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

function makeSeed(): ImplementationSeedV1 {
  return {
    version: "implementation_seed_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "planning_slots_and_artifacts",
    lifecycleStatus: "confirmed",
    readiness: { ready: true, score: 1, missing: [], warnings: [] },
    processImplementationItems: [
      {
        id: "proc-1",
        processName: "회원가입",
        actors: ["user"],
        screens: ["회원가입"],
        actions: ["submit"],
        dataTouched: ["user"],
        exceptions: [],
      },
    ],
    screenImplementationItems: [
      {
        id: "screen-1",
        screenName: "회의록 업로드",
        accessibleActors: ["user"],
        actions: ["upload"],
        visibleData: ["title"],
        editableData: ["file"],
        states: ["idle"],
      },
    ],
    actorCapabilityMatrix: [],
    commonDetailFeatures: [],
    dataModelSeed: {
      entities: ["MeetingNote"],
      fieldsByEntity: { MeetingNote: ["id"] },
      relationships: [],
      mockDataNotes: [],
    },
    assumptions: [],
    gaps: [],
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

  it("continues to next code task after status_check_stopped", () => {
    const queue = startCodeTaskExecutionQueue({
      projectId: "p1",
      selectedCodeTaskIds: ["CT-1", "CT-2"],
      nowIso: NOW,
    })!;
    const advanced = advanceCodeTaskExecutionQueue({
      queue,
      lastRunStatus: "status_check_stopped",
      nowIso: NOW,
    });
    expect(advanced.finished).toBe(false);
    expect(advanced.nextCodeTaskId).toBe("CT-2");
  });

  it("finishes with completed_with_issues when some runs have issues", () => {
    const queue = startCodeTaskExecutionQueue({
      projectId: "p1",
      selectedCodeTaskIds: ["CT-1", "CT-2", "CT-3"],
      nowIso: NOW,
    })!;
    const advanced = advanceCodeTaskExecutionQueue({
      queue: { ...queue, currentIndex: 2 },
      lastRunStatus: "completed",
      processedRunStatuses: ["completed", "rework_required", "completed"],
      nowIso: NOW,
    });
    expect(advanced.finished).toBe(true);
    expect(advanced.queue.status).toBe("completed_with_issues");
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

  it("returns empty when no explicit or process selection", () => {
    const ids = resolveSelectedCodeTaskIdsForQueue({
      codeTaskPlan: samplePlan(),
      processTaskIds: [],
      explicitCodeTaskIds: [],
    });
    expect(ids).toEqual([]);
  });

  it("does not auto-select fallback code task", () => {
    const ids = resolveSelectedCodeTaskIdsForQueue({
      codeTaskPlan: samplePlan(),
      processTaskIds: [],
    });
    expect(ids).toEqual([]);
  });

  it("resolves completed when all runs succeeded", () => {
    expect(
      resolveQueueFinalStatusFromRunStatuses(["completed", "no_code_change_completed"]),
    ).toBe("completed");
  });
});

describe("buildCodeTaskDeveloperPrompt", () => {
  it("includes acceptance criteria and github push requirements without pr creation", () => {
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
    expect(prompt).toMatch(/commit.*push/i);
    expect(prompt).toContain("PR 생성·merge는 플랫폼");
    expect(prompt).toContain("noCodeChange");
    expect(prompt).toContain("CT-1");
  });
});

describe("buildCodeTaskWorkBranch", () => {
  it("uses code task id for branch naming", () => {
    const branch = buildCodeTaskWorkBranch("CT-DEV-COMMON-001-01");
    expect(branch).toContain("ct-dev-common-001-01");
    expect(branch).not.toBe("wip/cursor/dev-common-001");
  });
});

describe("classifyCodeTaskExecutionRunFromTaskCursor", () => {
  it("keeps github_verifying when cursor completed with branch and agent id but no local commit", () => {
    const result = classifyCodeTaskExecutionRunFromTaskCursor(
      baseExecution({ cursorRunId: "agent-1" }),
    );
    expect(result.status).toBe("github_verifying");
  });

  it("requires github evidence when cursor says completed without branch evidence", () => {
    const result = classifyCodeTaskExecutionRunFromTaskCursor(
      baseExecution({ workBranch: undefined, cursorRunId: undefined }),
    );
    expect(result.status).toBe("rework_required");
  });

  it("marks status_check_stopped separately from failed", () => {
    const result = classifyCodeTaskExecutionRunFromTaskCursor(
      baseExecution({
        status: "status_check_stopped",
        errorMessage: "상태 확인이 중단되었습니다.",
      }),
    );
    expect(result.status).toBe("status_check_stopped");
    expect(result.status).not.toBe("failed");
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

describe("implementation task list review/security dependencies", () => {
  it("excludes mock-only developer tasks from REVIEW/SECURITY dependencies", () => {
    const list = buildImplementationTaskListFromSeed({
      projectId: "p1",
      seed: makeSeed(),
      nowIso: NOW,
    });
    const review = list.tasks.find((t) => t.taskId === "REVIEW-001");
    const security = list.tasks.find((t) => t.taskId === "SECURITY-001");
    expect(review?.dependencies).not.toContain("DEV-MOCK-001");
    expect(security?.dependencies).not.toContain("DEV-MOCK-001");
    expect(review?.dependencies.length).toBeGreaterThan(0);
  });
});
