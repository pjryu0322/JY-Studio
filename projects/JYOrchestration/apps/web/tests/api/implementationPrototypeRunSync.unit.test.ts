import { describe, expect, it } from "vitest";
import {
  buildInitialImplementationTaskExecutionStateFromTaskList,
  markPostDeveloperReviewTasksQueued,
  markRoleTasksInProgress,
  summarizeImplementationTaskExecutionItems,
} from "@/lib/prototype/implementationTaskExecutionState";
import {
  buildPrototypeRunExecutionSyncPatch,
  deriveImplementationPrototypeRunSyncSnapshot,
  isImplementationPrototypeComplete,
  isImplementationTaskExecutionStateEqual,
  syncImplementationTaskExecutionFromPrototypeRun,
} from "@/lib/prototype/implementationPrototypeRunSync";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-05-29T00:00:00.000Z";

function taskListWithScm(): ImplementationTaskListV1 {
  return {
    version: "implementation_task_list_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed",
    tasks: [
      {
        taskId: "dev-1",
        title: "개발",
        description: "d",
        taskType: "feature",
        ownerRole: "developer",
        priority: "high",
        dependencies: [],
        acceptanceCriteria: [],
        status: "ready",
      },
      {
        taskId: "rev-1",
        title: "검수",
        description: "d",
        taskType: "validation",
        ownerRole: "reviewer",
        priority: "medium",
        dependencies: [],
        acceptanceCriteria: [],
        status: "ready",
      },
      {
        taskId: "sec-1",
        title: "보안",
        description: "d",
        taskType: "security",
        ownerRole: "security",
        priority: "medium",
        dependencies: [],
        acceptanceCriteria: [],
        status: "ready",
      },
      {
        taskId: "scm-1",
        title: "SCM",
        description: "d",
        taskType: "scm",
        ownerRole: "scm",
        priority: "low",
        dependencies: [],
        acceptanceCriteria: [],
        status: "ready",
      },
    ],
    roleSummary: { developer: 1, designer: 0, reviewer: 1, security: 1, scm: 1 },
  };
}

function executionStateWithScmQueued() {
  let state = buildInitialImplementationTaskExecutionStateFromTaskList({
    projectId: "p1",
    taskList: taskListWithScm(),
    nowIso: NOW,
  });
  state = {
    ...state,
    items: state.items.map((item) => {
      if (item.ownerRole === "developer") {
        return { ...item, status: "done" as const, completedAt: NOW };
      }
      return item;
    }),
    summary: summarizeImplementationTaskExecutionItems(
      state.items.map((item) =>
        item.ownerRole === "developer"
          ? { ...item, status: "done" as const, completedAt: NOW }
          : item,
      ),
    ),
  };
  state = markPostDeveloperReviewTasksQueued({ state, nowIso: NOW });
  return state;
}

describe("deriveImplementationPrototypeRunSyncSnapshot", () => {
  it("detects prOpened from run status and prNumber", () => {
    const snapshot = deriveImplementationPrototypeRunSyncSnapshot({
      latestRun: { id: "run-1", status: "PR_OPENED", prNumber: 42 },
    });
    expect(snapshot.prOpened).toBe(true);
    expect(snapshot.merged).toBe(false);
    expect(snapshot.previewReady).toBe(false);
    expect(snapshot.hasRun).toBe(true);
  });

  it("detects merged from run status", () => {
    const snapshot = deriveImplementationPrototypeRunSyncSnapshot({
      latestRun: { id: "run-1", status: "MERGED", mergeSha: "abc123" },
    });
    expect(snapshot.merged).toBe(true);
    expect(snapshot.prOpened).toBe(true);
  });

  it("detects previewReady from previewUrl or PREVIEW_READY status", () => {
    const fromUrl = deriveImplementationPrototypeRunSyncSnapshot({
      latestRun: { id: "run-1", status: "DEPLOYING", previewUrl: "https://preview.example/app" },
    });
    expect(fromUrl.previewReady).toBe(true);
    expect(fromUrl.previewUrl).toBe("https://preview.example/app");

    const fromStatus = deriveImplementationPrototypeRunSyncSnapshot({
      latestRun: { id: "run-1", status: "PREVIEW_READY" },
    });
    expect(fromStatus.previewReady).toBe(true);
  });

  it("tolerates null/unknown input", () => {
    const snapshot = deriveImplementationPrototypeRunSyncSnapshot({ latestRun: null });
    expect(snapshot.hasRun).toBe(false);
    expect(snapshot.prOpened).toBe(false);
    expect(snapshot.merged).toBe(false);
    expect(snapshot.previewReady).toBe(false);
    expect(snapshot.summaryLines).toEqual([]);
  });
});

describe("syncImplementationTaskExecutionFromPrototypeRun", () => {
  it("prOpened true moves scm ready/queued to in_progress", () => {
    const state = executionStateWithScmQueued();
    const snapshot = deriveImplementationPrototypeRunSyncSnapshot({
      latestRun: { id: "run-1", status: "PR_OPENED", prNumber: 7 },
    });
    const next = syncImplementationTaskExecutionFromPrototypeRun({ state, snapshot, nowIso: NOW });
    expect(next?.items.find((i) => i.ownerRole === "scm")?.status).toBe("in_progress");
  });

  it("previewReady true moves scm to done", () => {
    let state = executionStateWithScmQueued();
    state = markRoleTasksInProgress({ state, ownerRole: "scm", nowIso: NOW });
    const snapshot = deriveImplementationPrototypeRunSyncSnapshot({
      latestRun: { id: "run-1", status: "PREVIEW_READY", previewUrl: "https://preview.example/app" },
    });
    const next = syncImplementationTaskExecutionFromPrototypeRun({ state, snapshot, nowIso: NOW });
    expect(next?.items.find((i) => i.ownerRole === "scm")?.status).toBe("done");
    expect(next?.items.find((i) => i.ownerRole === "reviewer")?.status).toBe("done");
    expect(next?.items.find((i) => i.ownerRole === "security")?.status).toBe("done");
  });

  it("previewReady true does not overwrite failed", () => {
    let state = executionStateWithScmQueued();
    state = {
      ...state,
      items: state.items.map((item) =>
        item.ownerRole === "scm" ? { ...item, status: "failed" as const, errorMessage: "merge failed" } : item,
      ),
      summary: summarizeImplementationTaskExecutionItems(
        state.items.map((item) =>
          item.ownerRole === "scm" ? { ...item, status: "failed" as const, errorMessage: "merge failed" } : item,
        ),
      ),
    };
    const snapshot = deriveImplementationPrototypeRunSyncSnapshot({
      latestRun: { id: "run-1", status: "PREVIEW_READY", previewUrl: "https://preview.example/app" },
    });
    const next = syncImplementationTaskExecutionFromPrototypeRun({ state, snapshot, nowIso: NOW });
    expect(next?.items.find((i) => i.ownerRole === "scm")?.status).toBe("failed");
  });

  it("returns null when state is missing", () => {
    const snapshot = deriveImplementationPrototypeRunSyncSnapshot({
      latestRun: { id: "run-1", status: "PR_OPENED" },
    });
    expect(syncImplementationTaskExecutionFromPrototypeRun({ state: null, snapshot })).toBeNull();
  });

  it("does not bump updatedAt when sync applies no item changes", () => {
    let state = executionStateWithScmQueued();
    state = markRoleTasksInProgress({ state, ownerRole: "scm", nowIso: NOW });
    const snapshot = deriveImplementationPrototypeRunSyncSnapshot({
      latestRun: { id: "run-1", status: "PREVIEW_READY", previewUrl: "https://preview.example/app" },
    });
    const syncedOnce = syncImplementationTaskExecutionFromPrototypeRun({ state, snapshot, nowIso: NOW })!;
    expect(syncedOnce.updatedAt).toBe(NOW);

    const resynced = syncImplementationTaskExecutionFromPrototypeRun({
      state: syncedOnce,
      snapshot,
      nowIso: "2026-05-29T01:00:00.000Z",
    });
    expect(resynced).toBe(syncedOnce);
    expect(resynced?.updatedAt).toBe(NOW);
  });

  it("does not bump updatedAt when scm is already in_progress for prOpened", () => {
    let state = executionStateWithScmQueued();
    state = markRoleTasksInProgress({ state, ownerRole: "scm", nowIso: NOW });
    const snapshot = deriveImplementationPrototypeRunSyncSnapshot({
      latestRun: { id: "run-1", status: "PR_OPENED", prNumber: 7 },
    });
    const resynced = syncImplementationTaskExecutionFromPrototypeRun({
      state,
      snapshot,
      nowIso: "2026-05-29T01:00:00.000Z",
    });
    expect(resynced).toBe(state);
    expect(resynced?.updatedAt).toBe(NOW);
  });
});

describe("isImplementationPrototypeComplete", () => {
  it("returns true when previewReady + developer done + scm done", () => {
    let state = executionStateWithScmQueued();
    const snapshot = deriveImplementationPrototypeRunSyncSnapshot({
      latestRun: { id: "run-1", status: "PREVIEW_READY", previewUrl: "https://preview.example/app" },
    });
    state = syncImplementationTaskExecutionFromPrototypeRun({ state, snapshot, nowIso: NOW })!;
    expect(isImplementationPrototypeComplete({ executionState: state, prototypeSnapshot: snapshot })).toBe(true);
  });

  it("returns false when previewReady is false", () => {
    const state = executionStateWithScmQueued();
    const snapshot = deriveImplementationPrototypeRunSyncSnapshot({
      latestRun: { id: "run-1", status: "PR_OPENED" },
    });
    expect(isImplementationPrototypeComplete({ executionState: state, prototypeSnapshot: snapshot })).toBe(false);
  });

  it("returns false when developer task failed", () => {
    let state = executionStateWithScmQueued();
    state = {
      ...state,
      items: state.items.map((item) =>
        item.ownerRole === "developer" ? { ...item, status: "failed" as const } : item,
      ),
      summary: summarizeImplementationTaskExecutionItems(
        state.items.map((item) =>
          item.ownerRole === "developer" ? { ...item, status: "failed" as const } : item,
        ),
      ),
    };
    const snapshot = deriveImplementationPrototypeRunSyncSnapshot({
      latestRun: { id: "run-1", status: "PREVIEW_READY", previewUrl: "https://preview.example/app" },
    });
    expect(isImplementationPrototypeComplete({ executionState: state, prototypeSnapshot: snapshot })).toBe(false);
  });
});

describe("buildPrototypeRunExecutionSyncPatch", () => {
  it("reports changed when execution state updates", () => {
    const state = executionStateWithScmQueued();
    const patch = buildPrototypeRunExecutionSyncPatch({
      currentState: state,
      latestRun: { id: "run-1", status: "PR_OPENED", prNumber: 3 },
      nowIso: NOW,
    });
    expect(patch.changed).toBe(true);
    expect(patch.nextState?.items.find((i) => i.ownerRole === "scm")?.status).toBe("in_progress");
  });

  it("reports unchanged when state is equal", () => {
    const state = executionStateWithScmQueued();
    const snapshot = deriveImplementationPrototypeRunSyncSnapshot({
      latestRun: { id: "run-1", status: "DRAFT" },
    });
    const unchanged = syncImplementationTaskExecutionFromPrototypeRun({ state, snapshot, nowIso: NOW });
    expect(isImplementationTaskExecutionStateEqual(state, unchanged)).toBe(true);
    const patch = buildPrototypeRunExecutionSyncPatch({
      currentState: state,
      latestRun: { id: "run-1", status: "DRAFT" },
      nowIso: NOW,
    });
    expect(patch.changed).toBe(false);
  });

  it("reports unchanged and preserves updatedAt when re-syncing an already synced preview-ready state", () => {
    let state = executionStateWithScmQueued();
    state = markRoleTasksInProgress({ state, ownerRole: "scm", nowIso: NOW });
    const latestRun = { id: "run-1", status: "PREVIEW_READY", previewUrl: "https://preview.example/app" };
    const first = buildPrototypeRunExecutionSyncPatch({
      currentState: state,
      latestRun,
      nowIso: NOW,
    });
    expect(first.changed).toBe(true);

    const resync = buildPrototypeRunExecutionSyncPatch({
      currentState: first.nextState,
      latestRun,
      nowIso: "2026-05-29T01:00:00.000Z",
    });
    expect(resync.changed).toBe(false);
    expect(resync.nextState).toBe(first.nextState);
    expect(resync.nextState?.updatedAt).toBe(NOW);
  });
});
