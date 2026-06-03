import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstMock = vi.fn();
const createJobMock = vi.fn();
const createRunMock = vi.fn();
const createEventMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    implementationExecutionJob: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      create: (...args: unknown[]) => createJobMock(...args),
    },
    implementationCodeTaskRun: {
      create: (...args: unknown[]) => createRunMock(...args),
    },
    implementationRuntimeEvent: {
      create: (...args: unknown[]) => createEventMock(...args),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => transactionMock(fn),
  },
}));

import {
  createImplementationRuntimeJob,
  createImplementationRuntimeJobWithFirstRun,
  parseSelectedCodeTaskIdsJson,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";

describe("implementationRuntimeRepository", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    createJobMock.mockReset();
    createRunMock.mockReset();
    createEventMock.mockReset();
    transactionMock.mockReset();
    findFirstMock.mockResolvedValue(null);
    createEventMock.mockResolvedValue({ id: "ev-1" });
  });

  describe("parseSelectedCodeTaskIdsJson", () => {
    it("parses string array", () => {
      expect(parseSelectedCodeTaskIdsJson([" ct-1 ", "ct-2", ""])).toEqual(["ct-1", "ct-2"]);
    });

    it("returns empty for non-array", () => {
      expect(parseSelectedCodeTaskIdsJson(null)).toEqual([]);
    });
  });

  describe("createImplementationRuntimeJob", () => {
    it("stores selectedCodeTaskIdsJson and maps selectedCodeTaskIds", async () => {
      const now = new Date("2026-06-03T00:00:00.000Z");
      createJobMock.mockResolvedValue({
        id: "job-1",
        projectId: "p1",
        status: "running",
        currentCodeTaskId: "ct-1",
        selectedCodeTaskIdsJson: ["ct-1", "ct-2"],
        failureReason: null,
        startedAt: now,
        completedAt: null,
        updatedAt: now,
      });

      const bundle = await createImplementationRuntimeJob({
        projectId: "p1",
        selectedCodeTaskIds: ["ct-1", "ct-2"],
        now,
      });

      expect(createJobMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            selectedCodeTaskIdsJson: ["ct-1", "ct-2"],
          }),
        }),
      );
      expect(bundle.job?.selectedCodeTaskIds).toEqual(["ct-1", "ct-2"]);
    });

    it("rejects empty selectedCodeTaskIds", async () => {
      await expect(
        createImplementationRuntimeJob({ projectId: "p1", selectedCodeTaskIds: [] }),
      ).rejects.toThrow(/selectedCodeTaskIds is required/);
    });
  });

  describe("createImplementationRuntimeJobWithFirstRun", () => {
    it("creates job and first queued run in a transaction", async () => {
      const now = new Date("2026-06-03T00:00:00.000Z");
      transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          implementationExecutionJob: {
            create: createJobMock,
          },
          implementationCodeTaskRun: {
            create: createRunMock,
          },
          implementationRuntimeEvent: {
            create: createEventMock,
          },
        };
        createJobMock.mockResolvedValue({
          id: "job-1",
          projectId: "p1",
          status: "running",
          currentCodeTaskId: "ct-1",
          selectedCodeTaskIdsJson: ["ct-1", "ct-2"],
          failureReason: null,
          startedAt: now,
          completedAt: null,
          updatedAt: now,
        });
        createRunMock.mockResolvedValue({
          id: "run-1",
          projectId: "p1",
          jobId: "job-1",
          codeTaskId: "ct-1",
          runtimeState: "queued",
          cursorAgentId: null,
          branchName: null,
          commitSha: null,
          pullRequestUrl: null,
          failureReason: null,
          lastHeartbeatAt: now,
          startedAt: now,
          completedAt: null,
          updatedAt: now,
        });
        return fn(tx);
      });

      const bundle = await createImplementationRuntimeJobWithFirstRun({
        projectId: "p1",
        selectedCodeTaskIds: ["ct-1", "ct-2"],
        now,
      });

      expect(transactionMock).toHaveBeenCalled();
      expect(createRunMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            runtimeState: "queued",
            codeTaskId: "ct-1",
          }),
        }),
      );
      expect(createEventMock).toHaveBeenCalledTimes(2);
      expect(bundle.currentRun?.runtimeState).toBe("queued");
      expect(bundle.job?.selectedCodeTaskIds).toEqual(["ct-1", "ct-2"]);
    });

    it("does not create a new job when an active running job exists", async () => {
      const now = new Date("2026-06-03T00:00:00.000Z");
      findFirstMock.mockResolvedValue({
        id: "job-existing",
        projectId: "p1",
        status: "running",
        currentCodeTaskId: "ct-1",
        selectedCodeTaskIdsJson: ["ct-1"],
        failureReason: null,
        startedAt: now,
        completedAt: null,
        updatedAt: now,
        runs: [
          {
            id: "run-1",
            projectId: "p1",
            jobId: "job-existing",
            codeTaskId: "ct-1",
            runtimeState: "cursor_running",
            cursorAgentId: null,
            branchName: null,
            commitSha: null,
            pullRequestUrl: null,
            failureReason: null,
            lastHeartbeatAt: now,
            startedAt: now,
            completedAt: null,
            updatedAt: now,
          },
        ],
      });

      const bundle = await createImplementationRuntimeJobWithFirstRun({
        projectId: "p1",
        selectedCodeTaskIds: ["ct-2"],
      });

      expect(transactionMock).not.toHaveBeenCalled();
      expect(bundle.job?.id).toBe("job-existing");
      expect(bundle.currentRun?.id).toBe("run-1");
    });

    it("rejects empty selectedCodeTaskIds", async () => {
      await expect(
        createImplementationRuntimeJobWithFirstRun({ projectId: "p1", selectedCodeTaskIds: ["  "] }),
      ).rejects.toThrow(/selectedCodeTaskIds is required/);
    });
  });
});
