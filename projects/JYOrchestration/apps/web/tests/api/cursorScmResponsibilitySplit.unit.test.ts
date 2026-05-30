import { describe, expect, it } from "vitest";
import {
  buildCursorBridgeExecuteRequestFromWorkItems,
  validateBridgeResultForRealSourceGeneration,
} from "@/lib/prototype/cursorBridgeExecution";
import { buildCursorApiDirectRequestFromBridgeRequest } from "@/lib/prototype/cursorApiDirectExecution";
import {
  applyCursorBridgeResultToWipExecution,
  patchWipForCursorBridgePhase,
} from "@/lib/prototype/prototypeExecutionCursorBridgeActions";
import { buildInitialCodeAgentWipExecution } from "@/lib/prototype/codeAgentWipExecution";
import { buildCursorWorkItemsFromImplementationTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationTaskPlan } from "@/lib/prototype/implementationTaskPlan";
import { normalizeCursorBridgeResultForPlatform } from "@/lib/prototype/platformScmExecution";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";
import { buildCodeAgentExecutionProgressView } from "@/lib/prototype/codeAgentExecutionProgressView";

const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
  gitRepoName: "pjryu0322/aiproject",
  gitRepoUrl: "https://github.com/pjryu0322/aiproject",
  baseBranch: "main",
})!;

const plan = buildImplementationTaskPlan({
  projectId: "p1",
  projectArtifacts: [],
  featureDraftTitles: ["upload"],
  envOk: true,
  designOk: true,
});
const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);

const workItem = workItems[0]!;

describe("cursorScmResponsibilitySplit", () => {
  it("bridge request builder never forwards autoPush/autoPr to Cursor", () => {
    const built = buildCursorBridgeExecuteRequestFromWorkItems({
      projectId: "p1",
      selectedTaskId: workItem.taskId,
      selectedWorkItemIds: [workItem.id],
      workItems,
      targetRepository,
      branchName: "wip/cursor/dev-1",
      baseBranch: "main",
      workspaceRoot: "C:/workspace/aiproject",
      commitMessage: "wip: test",
      allowedPathGlobs: ["src/**"],
      autoCommit: true,
      autoPush: true,
      autoPr: true,
    });
    expect("prompt" in built).toBe(true);
    if ("prompt" in built) {
      expect(built.autoPush).toBe(false);
      expect(built.autoPr).toBe(false);
      const direct = buildCursorApiDirectRequestFromBridgeRequest(
        { ...built, cursorApiUrl: "https://api.cursor.com" },
        "token",
      );
      expect(direct.autoPush).toBe(false);
      expect(direct.autoPr).toBe(false);
    }
  });

  it("cursor bridge wip patch stores bridgeAutoPush/bridgeAutoPr as false", () => {
    const wip = buildInitialCodeAgentWipExecution({
      projectId: "p1",
      plan,
      workItems,
      provider: "cursor",
    });
    const patched = patchWipForCursorBridgePhase({
      wip,
      phase: "requested",
    });
    expect(patched.bridgeAutoPush).toBe(false);
    expect(patched.bridgeAutoPr).toBe(false);
  });

  it("applyCursorBridgeResultToWipExecution keeps official SCM pending despite external push refs", () => {
    const wip = buildInitialCodeAgentWipExecution({
      projectId: "p1",
      plan,
      workItems,
      selectedTaskId: workItem.taskId,
      provider: "cursor",
    });
    const updated = applyCursorBridgeResultToWipExecution({
      wip,
      bridgeResult: normalizeCursorBridgeResultForPlatform({
        ok: true,
        provider: "cursor",
        status: "completed",
        selectedTaskId: workItem.taskId,
        targetRepository: targetRepository.repoFullName,
        branchName: "wip/cursor/dev-1",
        commitSha: "abc123def4567890",
        changedFiles: ["src/App.tsx"],
        pushed: true,
        pushStatus: "success",
        prNumber: 99,
        prStatus: "PR: opened",
        cursorExternalPushStatus: "success",
        cursorExternalPrNumber: 99,
      }),
      commitTitle: "wip: test",
      nowIso: "2026-05-30T00:00:00.000Z",
    });
    expect(updated.pushed).toBe(false);
    expect(updated.pushStatus).toBeUndefined();
    expect(updated.prNumber).toBeUndefined();
    expect(updated.platformScmExecutionV1?.pushStatus).toBe("pending");
    expect(updated.cursorExternalPrNumber).toBe(99);
  });

  it("validateBridgeResultForRealSourceGeneration ignores push/pr fields", () => {
    const result = validateBridgeResultForRealSourceGeneration(
      {
        ok: true,
        provider: "cursor",
        status: "completed",
        selectedTaskId: workItem.taskId,
        targetRepository: targetRepository.repoFullName,
        commitSha: "abc123def4567890",
        changedFiles: ["src/App.tsx"],
        pushed: false,
        prNumber: undefined,
      },
      {
        targetRepository,
        allowedPathGlobs: [],
        forbiddenPathGlobs: [],
      },
    );
    expect(result.ok).toBe(true);
  });

  it("progress view shows SCM pending after cursor completion", () => {
    const wip = applyCursorBridgeResultToWipExecution({
      wip: buildInitialCodeAgentWipExecution({
        projectId: "p1",
        plan,
        workItems,
        selectedTaskId: workItem.taskId,
        provider: "cursor",
      }),
      bridgeResult: {
        ok: true,
        provider: "cursor",
        status: "completed",
        selectedTaskId: workItem.taskId,
        targetRepository: targetRepository.repoFullName,
        branchName: "wip/cursor/dev-1",
        commitSha: "abc123def4567890",
        changedFiles: ["src/App.tsx"],
      },
      commitTitle: "wip: test",
      nowIso: "2026-05-30T00:00:00.000Z",
    });
    const view = buildCodeAgentExecutionProgressView({ codeAgentWipExecutionV1: wip });
    expect(view.status).toBe("cursor_completed");
    expect(view.scmStatusLabel).toBe("Push/PR 대기");
    expect(view.summaryLine).toContain("플랫폼 SCM");
  });
});
