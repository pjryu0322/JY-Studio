import { describe, expect, it } from "vitest";
import {
  buildImplementationTraceTimelineEntry,
  maskWorkspacePathForTimeline,
} from "@/lib/prototype/implementationTraceTimeline";
import { resolvePlatformScmWipContext } from "@/lib/prototype/platformScmWipContext";
import { buildPlatformScmWipFixture } from "../fixtures/platformScmWipFixture";

describe("implementationTraceTimeline", () => {
  it("masks long workspace paths", () => {
    expect(maskWorkspacePathForTimeline("C:/very/long/workspace/path")).toBe("C:/v…ath");
    expect(maskWorkspacePathForTimeline("")).toBe("(없음)");
  });

  it("builds platform_scm timeline entry with formatted fields", () => {
    const entry = buildImplementationTraceTimelineEntry({
      action: "platform_scm_push_completed",
      orchestrationTraceGroup: "platform_scm",
      mode: "platform_scm",
      projectId: "p1",
      nowIso: "2026-05-29T12:00:00.000Z",
      fields: {
        selectedTaskId: "task-1",
        commitSha: "abc123def4567890",
        reason: "push ok",
      },
    });
    expect(entry.action).toBe("platform_scm_push_completed");
    expect(entry.orchestrationTraceGroup).toBe("platform_scm");
    expect(entry.responseText).toContain("commitSha=abc123def456");
    expect(entry.responseText).toContain("reason=push_ok");
  });
});

describe("resolvePlatformScmWipContext", () => {
  it("prefers scm fields over wip fallbacks", () => {
    const wip = buildPlatformScmWipFixture({ preset: "merge_ready" });
    const ctx = resolvePlatformScmWipContext(wip);
    expect(ctx.projectId).toBe(wip.projectId);
    expect(ctx.taskId).toBeTruthy();
    expect(ctx.repoFullName).toBeTruthy();
    expect(ctx.branchName).toBeTruthy();
    expect(ctx.commitSha).toBeTruthy();
    expect(ctx.scm).toBeDefined();
  });
});
