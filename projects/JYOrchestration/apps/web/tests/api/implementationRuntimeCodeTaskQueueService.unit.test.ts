import { describe, expect, it } from "vitest";
import { resolveEffectiveCodeTaskExecutionQueue } from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueSnapshot";
import {
  canCompleteQueueItemFromGithubVerify,
  resolveNoCodeChangeEvidence,
  resolveQueueItemStatusAfterGithubVerify,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueuePolicy";

describe("implementationRuntimeCodeTaskQueueService policy", () => {
  it("allows completed only when github verify ok with commit sha", () => {
    expect(
      canCompleteQueueItemFromGithubVerify({
        ok: true,
        verifiedCommitSha: "abc123",
        reason: "github_verified",
      }),
    ).toBe(true);
    expect(
      resolveQueueItemStatusAfterGithubVerify({
        verify: { ok: true, verifiedCommitSha: "abc123", reason: "github_verified" },
      }),
    ).toBe("completed");
  });

  it("does not complete when verify ok but verifiedCommitSha missing", () => {
    expect(
      canCompleteQueueItemFromGithubVerify({
        ok: true,
        reason: "github_verified",
      }),
    ).toBe(false);
    expect(
      resolveQueueItemStatusAfterGithubVerify({
        verify: { ok: true, reason: "github_verified" },
      }),
    ).toBe("failed");
  });

  it("does not complete on cursor_completed or review_pending alone", () => {
    expect(
      canCompleteQueueItemFromGithubVerify({
        ok: false,
        reason: "cursor_completed",
        message: "cursor done",
      }),
    ).toBe(false);
    expect(
      resolveQueueItemStatusAfterGithubVerify({
        verify: { ok: false, reason: "review_pending", message: "waiting review" },
      }),
    ).toBe("failed");
  });

  it("does not complete on pr url only without verify ok and commit", () => {
    expect(
      canCompleteQueueItemFromGithubVerify({
        ok: false,
        reason: "pr_opened",
        pullRequestUrl: "https://github.com/o/r/pull/1",
      } as { ok: false; reason: string; pullRequestUrl: string }),
    ).toBe(false);
  });

  it("allows no_code_change_completed only with structured evidence", () => {
    expect(
      resolveNoCodeChangeEvidence({
        ok: false,
        detailReason: "changed_files_empty",
        message: "no files",
      }),
    ).toBe("no files");
    expect(
      resolveQueueItemStatusAfterGithubVerify({
        verify: {
          ok: false,
          detailReason: "changed_files_empty",
          message: "no files",
        },
      }),
    ).toBe("no_code_change_completed");
  });

  it("rejects reason-string-only no_code_change for completed path", () => {
    expect(
      resolveQueueItemStatusAfterGithubVerify({
        verify: { ok: false, reason: "no_code_change", message: "no change" },
      }),
    ).toBe("failed");
    expect(
      resolveNoCodeChangeEvidence({
        ok: false,
        reason: "no_code_change",
        message: "no change",
      }),
    ).toBeNull();
  });

  it("maps path guard failures to rework_required", () => {
    expect(
      resolveQueueItemStatusAfterGithubVerify({
        verify: { ok: false, detailReason: "path_guard_failed", message: "bad path" },
      }),
    ).toBe("rework_required");
    expect(
      resolveQueueItemStatusAfterGithubVerify({
        verify: { ok: false, detailReason: "commit_message_missing_task_id", message: "id" },
      }),
    ).toBe("rework_required");
  });
});

describe("resolveEffectiveCodeTaskExecutionQueue", () => {
  const dbSnap = {
    version: "code_task_execution_queue_v1" as const,
    projectId: "p1",
    selectedCodeTaskIds: ["a"],
    currentIndex: 0,
    status: "running" as const,
    createdAt: "t",
    updatedAt: "t",
    stopOnFailure: true,
  };

  it("prefers DB snapshot over JSON", () => {
    const json = {
      ...dbSnap,
      selectedCodeTaskIds: ["b"],
      currentIndex: 1,
    };
    expect(
      resolveEffectiveCodeTaskExecutionQueue({
        dbQueueSnapshot: dbSnap,
        jsonQueue: json,
        dbJobStatus: "running",
      }),
    ).toEqual(dbSnap);
  });

  it("returns null for running job without DB snapshot (no JSON fallback)", () => {
    expect(
      resolveEffectiveCodeTaskExecutionQueue({
        dbQueueSnapshot: null,
        jsonQueue: dbSnap,
        dbJobStatus: "running",
      }),
    ).toBeNull();
  });

  it("allows JSON when job is not running", () => {
    expect(
      resolveEffectiveCodeTaskExecutionQueue({
        dbQueueSnapshot: undefined,
        jsonQueue: dbSnap,
        dbJobStatus: "idle",
      }),
    ).toMatchObject({ selectedCodeTaskIds: ["a"] });
  });
});
