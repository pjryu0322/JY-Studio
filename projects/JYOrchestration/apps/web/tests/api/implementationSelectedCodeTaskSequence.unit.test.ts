import { describe, expect, it } from "vitest";
import {
  jobSelectedCodeTaskIdsNeedBoardReconcile,
  reconcileJobSelectedCodeTaskIdsWithBoardSelection,
  resolveNextCodeTaskIdAfterCompletion,
  resolveNextQuickRunCodeTaskId,
  resolveSelectedCodeTaskIdsForContinuation,
} from "@/lib/prototype/implementationSelectedCodeTaskSequence";

describe("implementationSelectedCodeTaskSequence", () => {
  const jobBundle = {
    job: {
      id: "j1",
      projectId: "p1",
      status: "running" as const,
      currentCodeTaskId: "CODE-B",
      selectedCodeTaskIds: ["CODE-A", "CODE-B", "CODE-C"],
      failureReason: null,
      startedAt: null,
      completedAt: null,
      updatedAt: "2026-06-04T00:00:00.000Z",
    },
    currentRun: {
      id: "r2",
      projectId: "p1",
      jobId: "j1",
      codeTaskId: "CODE-B",
      runtimeState: "queued" as const,
      cursorAgentId: null,
      branchName: null,
      commitSha: null,
      pullRequestUrl: null,
      failureReason: null,
      startedAt: null,
      lastHeartbeatAt: null,
      completedAt: null,
    },
    runs: [],
  };

  it("resolveNextCodeTaskIdAfterCompletion walks job selection order", () => {
    expect(
      resolveNextCodeTaskIdAfterCompletion({
        selectedCodeTaskIds: ["CODE-A", "CODE-B", "CODE-C"],
        completedCodeTaskId: "CODE-A",
      }),
    ).toBe("CODE-B");
    expect(
      resolveNextCodeTaskIdAfterCompletion({
        selectedCodeTaskIds: ["CODE-A", "CODE-B", "CODE-C"],
        completedCodeTaskId: "CODE-C",
      }),
    ).toBeNull();
  });

  it("resolveSelectedCodeTaskIdsForContinuation uses job selection", () => {
    expect(
      resolveSelectedCodeTaskIdsForContinuation({
        dbBundle: jobBundle,
      }),
    ).toEqual(["CODE-A", "CODE-B", "CODE-C"]);
  });

  it("resolveNextQuickRunCodeTaskId uses job selection", () => {
    expect(
      resolveNextQuickRunCodeTaskId({
        completedCodeTaskId: "CODE-A",
        dbBundle: jobBundle,
      }),
    ).toBe("CODE-B");
  });

  it("reconcileJobSelectedCodeTaskIdsWithBoardSelection appends board-only ids", () => {
    expect(
      reconcileJobSelectedCodeTaskIdsWithBoardSelection({
        jobSelectedCodeTaskIds: ["CODE-A"],
        boardSelectedCodeTaskIds: ["CODE-A", "CODE-B", "CODE-C"],
      }),
    ).toEqual(["CODE-A", "CODE-B", "CODE-C"]);
    expect(
      jobSelectedCodeTaskIdsNeedBoardReconcile({
        jobSelectedCodeTaskIds: ["CODE-A"],
        boardSelectedCodeTaskIds: ["CODE-A", "CODE-B"],
      }),
    ).toBe(true);
  });
});
