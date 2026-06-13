import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildScheduledCodeTaskGithubPollingEntry,
  formatCodeTaskGithubPollingBoardLabels,
  isCodeTaskGithubPollingBlockingIntegration,
  listActiveCodeTaskGithubPollingEntries,
  upsertCodeTaskGithubPollingEntryInState,
} from "@/lib/prototype/implementationCodeTaskGithubPollingState";
import {
  CODE_TASK_GITHUB_FIRST_POLL_DELAY_MS,
  CODE_TASK_GITHUB_POLL_INTERVAL_MS,
} from "@/lib/prototype/implementationGithubPollingScheduler";
import { isCodeTaskRunIntegrationReady } from "@/lib/prototype/codeTaskIntegrationReadiness";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

describe("implementationCodeTaskGithubPollingState", () => {
  it("creates github polling state when CodeTask execution unit is dispatched", () => {
    const dispatchedAt = "2026-06-03T12:00:00.000Z";
    const entry = buildScheduledCodeTaskGithubPollingEntry({
      projectId: "p1",
      unitId: "CODE-A",
      codeTaskId: "CODE-A",
      processTaskId: "DEV-1",
      targetRepository: "o/r",
      baseBranch: "main",
      workBranch: "wip/feature/core-flow",
      nowIso: dispatchedAt,
    });

    expect(entry.status).toBe("scheduled");
    expect(entry.pollIntervalMs).toBe(CODE_TASK_GITHUB_POLL_INTERVAL_MS);
    expect(Date.parse(entry.firstPollAt) - Date.parse(dispatchedAt)).toBe(
      CODE_TASK_GITHUB_FIRST_POLL_DELAY_MS,
    );
    expect(entry.nextPollAt).toBe(entry.firstPollAt);
  });

  it("does not poll github before firstPollAt (waiting labels)", () => {
    const entry = buildScheduledCodeTaskGithubPollingEntry({
      projectId: "p1",
      unitId: "CODE-A",
      codeTaskId: "CODE-A",
      targetRepository: "o/r",
      workBranch: "wip/x",
      nowIso: new Date().toISOString(),
    });
    const waitingEntry = { ...entry, status: "waiting" as const };
    const labels = formatCodeTaskGithubPollingBoardLabels(waitingEntry);
    expect(labels?.statusLabel).toBe("검증 대기");
    expect(labels?.progressLabel).toContain("Cursor");
  });

  it("retries when workBranch is missing before timeout (branch_missing_retrying)", () => {
    const entry = buildScheduledCodeTaskGithubPollingEntry({
      projectId: "p1",
      unitId: "CODE-A",
      codeTaskId: "CODE-A",
      targetRepository: "o/r",
      workBranch: "wip/x",
    });
    const retrying = { ...entry, status: "branch_missing_retrying" as const };
    expect(isCodeTaskGithubPollingBlockingIntegration(retrying)).toBe(true);
    const labels = formatCodeTaskGithubPollingBoardLabels(retrying);
    expect(labels?.progressLabel).toContain("재시도");
  });

  it("marks execution unit verified when workBranch head commit is found", () => {
    const passed = buildScheduledCodeTaskGithubPollingEntry({
      projectId: "p1",
      unitId: "CODE-A",
      codeTaskId: "CODE-A",
      targetRepository: "o/r",
      workBranch: "wip/x",
    });
    const entry = {
      ...passed,
      status: "passed" as const,
      githubVerifyStatus: "passed" as const,
      branchHeadCommit: "abc123",
    };
    expect(isCodeTaskGithubPollingBlockingIntegration(entry)).toBe(false);
    const labels = formatCodeTaskGithubPollingBoardLabels(entry);
    expect(labels?.statusLabel).toBe("완료");
  });

  it("marks github verify failed after timeout", () => {
    const entry = buildScheduledCodeTaskGithubPollingEntry({
      projectId: "p1",
      unitId: "CODE-A",
      codeTaskId: "CODE-A",
      targetRepository: "o/r",
      workBranch: "wip/x",
    });
    const timedOut = {
      ...entry,
      status: "timeout" as const,
      githubVerifyStatus: "failed" as const,
      lastErrorCode: "github_branch_missing",
    };
    const labels = formatCodeTaskGithubPollingBoardLabels(timedOut);
    expect(labels?.statusLabel).toBe("검증 실패");
    expect(isCodeTaskGithubPollingBlockingIntegration(timedOut)).toBe(true);
  });

  it("does not count polling or branch_missing_retrying units as integration ready", () => {
    const baseState = {} as RequirementsStateJson;
    const entry = buildScheduledCodeTaskGithubPollingEntry({
      projectId: "p1",
      unitId: "CODE-A",
      codeTaskId: "CODE-A",
      targetRepository: "o/r",
      workBranch: "wip/x",
    });
    const patch = upsertCodeTaskGithubPollingEntryInState({
      state: baseState,
      entry: { ...entry, status: "branch_missing_retrying" },
    });
    const state = { ...baseState, ...patch } as RequirementsStateJson;
    expect(listActiveCodeTaskGithubPollingEntries(state).length).toBe(1);
    expect(
      isCodeTaskRunIntegrationReady(
        {
          version: "code_task_execution_run_v1",
          runId: "r1",
          projectId: "p1",
          processTaskId: "DEV-1",
          workItemId: "",
          codeTaskId: "CODE-A",
          status: "cursor_running",
          attemptNo: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        state,
      ),
    ).toBe(false);
  });

  it("counts only github verified units as integration ready when polling passed", () => {
    const entry = buildScheduledCodeTaskGithubPollingEntry({
      projectId: "p1",
      unitId: "CODE-A",
      codeTaskId: "CODE-A",
      targetRepository: "o/r",
      workBranch: "wip/x",
    });
    const state = {
      ...upsertCodeTaskGithubPollingEntryInState({
        state: {},
        entry: {
          ...entry,
          status: "passed",
          githubVerifyStatus: "passed",
          branchHeadCommit: "sha1",
        },
      }),
    } as RequirementsStateJson;
    expect(
      isCodeTaskRunIntegrationReady(
        {
          version: "code_task_execution_run_v1",
          runId: "r1",
          projectId: "p1",
          processTaskId: "DEV-1",
          workItemId: "",
          codeTaskId: "CODE-A",
          status: "github_verified",
          attemptNo: 1,
          commitSha: "sha1",
          branchHeadCommitSha: "sha1",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        state,
      ),
    ).toBe(true);
  });
});

describe("runCodeTaskGithubPollingTick waiting", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("does not call github verify before firstPollAt", async () => {
    const verifyMock = vi.fn();
    vi.doMock("@/lib/prototype/taskCursorGithubVerifyService", () => ({
      runTaskCursorGithubVerifyWithQuickRunAdvance: verifyMock,
    }));
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        project: {
          findUnique: vi.fn().mockResolvedValue({
            requirementsStateJson: {
              implementationCodeTaskGithubPollingV1: {
                version: "implementation_code_task_github_polling_v1",
                projectId: "p1",
                updatedAt: new Date().toISOString(),
                byCodeTaskId: {
                  "CODE-A": buildScheduledCodeTaskGithubPollingEntry({
                    projectId: "p1",
                    unitId: "CODE-A",
                    codeTaskId: "CODE-A",
                    targetRepository: "o/r",
                    workBranch: "wip/x",
                    nowIso: new Date().toISOString(),
                  }),
                },
              },
            },
          }),
          update: vi.fn(),
        },
      },
    }));

    const { runCodeTaskGithubPollingTick } = await import(
      "@/lib/prototype/implementationCodeTaskGithubPollingService"
    );
    const result = await runCodeTaskGithubPollingTick({ projectId: "p1" });
    expect(result.checkedCount).toBe(1);
    expect(verifyMock).not.toHaveBeenCalled();
  });
});
