import { describe, expect, it } from "vitest";
import { buildInitialCodeAgentWipExecution } from "@/lib/prototype/codeAgentWipExecution";
import { buildCursorWorkItemsFromImplementationTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationTaskPlan } from "@/lib/prototype/implementationTaskPlan";
import {
  buildInitialPlatformScmExecutionFromWip,
  extractCursorExternalScmReference,
  normalizeCursorBridgeResultForPlatform,
  platformScmStatusLabel,
} from "@/lib/prototype/platformScmExecution";

const plan = buildImplementationTaskPlan({
  projectId: "p1",
  projectArtifacts: [],
  featureDraftTitles: ["upload"],
  envOk: true,
  designOk: true,
});
const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);

describe("platformScmExecution", () => {
  it("buildInitialPlatformScmExecutionFromWip starts pending", () => {
    const wip = buildInitialCodeAgentWipExecution({
      projectId: "p1",
      plan,
      workItems,
      selectedTaskId: workItems[0]!.taskId,
    });
    const scm = buildInitialPlatformScmExecutionFromWip({
      wip,
      commitSha: "abc1234567890",
      branchName: "wip/cursor/dev-1",
      nowIso: "2026-05-30T00:00:00.000Z",
    });
    expect(scm.pushStatus).toBe("pending");
    expect(scm.sourceCommitSha).toBe("abc1234567890");
    expect(platformScmStatusLabel(scm)).toBe("Push/PR 대기");
  });

  it("extractCursorExternalScmReference captures external push without platform completion", () => {
    const ref = extractCursorExternalScmReference({
      pushed: true,
      pushStatus: "success",
      prNumber: 42,
      prStatus: "PR: opened",
    });
    expect(ref.cursorExternalPushStatus).toBe("success");
    expect(ref.cursorExternalPrNumber).toBe(42);
    expect(ref.cursorExternalPrStatus).toBe("PR: opened");
  });

  it("normalizeCursorBridgeResultForPlatform strips push fields from completed result", () => {
    const normalized = normalizeCursorBridgeResultForPlatform({
      ok: true,
      provider: "cursor",
      status: "completed",
      selectedTaskId: "DEV-1",
      commitSha: "abc1234567890",
      changedFiles: ["src/a.ts"],
      pushed: true,
      pushStatus: "success",
      prNumber: 7,
      prStatus: "PR: opened",
      cursorExternalPushStatus: "success",
      cursorExternalPrNumber: 7,
    });
    expect(normalized.pushed).toBe(false);
    expect(normalized.pushStatus).toBeUndefined();
    expect(normalized.prNumber).toBeUndefined();
    expect(normalized.cursorExternalPushStatus).toBe("success");
  });
});
