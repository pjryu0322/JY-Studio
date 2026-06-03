import { describe, expect, it } from "vitest";
import {
  canCompleteQueueItemFromGithubVerify,
  resolveQueueItemStatusAfterGithubVerify,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueService";

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

  it("allows no_code_change_completed when evidence reason is explicit", () => {
    expect(
      resolveQueueItemStatusAfterGithubVerify({
        verify: { ok: false, reason: "no_code_change", message: "no change" },
      }),
    ).toBe("no_code_change_completed");
  });
});
