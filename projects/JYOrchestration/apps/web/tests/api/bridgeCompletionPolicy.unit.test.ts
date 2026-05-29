import { describe, expect, it } from "vitest";
import {
  BRIDGE_SOURCE_GENERATION_REJECTED_HEADING,
  buildQualityGateBridgeTargetFromWip,
  evaluateBridgeResultEligibleForCompletion,
  formatBridgeSourceGenerationRejectionMessage,
  resolveBridgePushAndPrStatus,
} from "@/lib/prototype/bridgeCompletionPolicy";
import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import type { CursorBridgeExecuteResult } from "@/lib/prototype/cursorBridgeExecution";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";

const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
  gitRepoName: "pjryu0322/aiproject",
  baseBranch: "main",
})!;

const context = {
  targetRepository,
  allowedPathGlobs: ["src/**"] as string[],
  forbiddenPathGlobs: [] as string[],
};

const baseResult: CursorBridgeExecuteResult = {
  ok: true,
  provider: "cursor",
  status: "completed",
  selectedTaskId: "DEV-1",
  targetRepository: "pjryu0322/aiproject",
  branchName: "wip/cursor/dev-1",
  commitSha: "abc123def4567890",
  changedFiles: ["src/App.tsx"],
};

describe("resolveBridgePushAndPrStatus", () => {
  it("autoPush=false shows skipped push", () => {
    const status = resolveBridgePushAndPrStatus({ autoPush: false, autoPr: false });
    expect(status.pushStatus).toBe("skipped");
    expect(status.pushStatusLine).toContain("autoPush=false");
  });

  it("autoPr=false shows PR skipped", () => {
    const status = resolveBridgePushAndPrStatus({ autoPush: true, autoPr: false, pushed: true });
    expect(status.prStatusLine).toContain("autoPr=false");
  });

  it("autoPr=true without prNumber shows unimplemented", () => {
    const status = resolveBridgePushAndPrStatus({ autoPush: true, autoPr: true, pushed: true });
    expect(status.prStatusLine).toContain("미연결");
  });

  it("prNumber preserved in status line", () => {
    const status = resolveBridgePushAndPrStatus({
      autoPush: true,
      autoPr: true,
      pushed: true,
      prNumber: 42,
    });
    expect(status.prStatusLine).toContain("#42");
  });
});

describe("evaluateBridgeResultEligibleForCompletion", () => {
  it("valid target repo result eligible", () => {
    expect(evaluateBridgeResultEligibleForCompletion(baseResult, context).ok).toBe(true);
  });

  it("completed without commitSha becomes ineligible", () => {
    const r = evaluateBridgeResultEligibleForCompletion(
      { ...baseResult, commitSha: undefined },
      context,
    );
    expect(r.ok).toBe(false);
  });

  it("completed with wip-stub sha becomes ineligible", () => {
    const r = evaluateBridgeResultEligibleForCompletion(
      { ...baseResult, commitSha: "wip-stub-1" },
      context,
    );
    expect(r.ok).toBe(false);
  });

  it("completed without changedFiles becomes ineligible", () => {
    const r = evaluateBridgeResultEligibleForCompletion({ ...baseResult, changedFiles: [] }, context);
    expect(r.ok).toBe(false);
  });

  it("allowedPathGlobs rejects README.md", () => {
    const r = evaluateBridgeResultEligibleForCompletion(
      { ...baseResult, changedFiles: ["README.md"] },
      context,
    );
    expect(r.ok).toBe(false);
  });
});

describe("formatBridgeSourceGenerationRejectionMessage", () => {
  it("uses rejection heading", () => {
    const msg = formatBridgeSourceGenerationRejectionMessage(["실제 commitSha 없음"]);
    expect(msg).toContain(BRIDGE_SOURCE_GENERATION_REJECTED_HEADING);
    expect(msg).toContain("- 실제 commitSha 없음");
  });
});

describe("buildQualityGateBridgeTargetFromWip", () => {
  const wip: CodeAgentWipExecutionV1 = {
    version: "code_agent_wip_execution_v1",
    projectId: "p1",
    provider: "cursor",
    status: "developer_reviewing",
    branchName: "wip/cursor/dev-1",
    requestedAt: "2026-05-29T00:00:00.000Z",
    requestedBy: "ai_developer",
    workItems: ["wi-1"],
    commits: [
      {
        provider: "cursor",
        sha: "deadbeef1234567890",
        branchName: "wip/cursor/dev-1",
        commitMessage: "wip",
        taskId: "DEV-1",
        workItemId: "wi-1",
        changedFiles: ["src/App.tsx"],
        diffSummary: [],
        testResults: [],
        unresolvedIssues: [],
        createdAt: "2026-05-29T01:00:00.000Z",
      },
    ],
    developerReview: {
      status: "pending",
      reviewedAt: "2026-05-29T01:00:00.000Z",
      reviewedBy: "ai_developer",
      summary: "x",
      findings: [],
      requestedActions: [],
    },
    refactorRequests: [],
    executionMode: "cursor_bridge",
    bridgeExecutionStatus: "bridge_completed",
    selectedTaskId: "DEV-1",
    targetRepositorySnapshot: targetRepository,
    targetRepoFullName: targetRepository.repoFullName,
    workspacePath: "C:/workspace/aiproject",
    baseBranch: "main",
  };

  it("returns commitSha and changedFiles for bridge_completed wip", () => {
    const target = buildQualityGateBridgeTargetFromWip(wip);
    expect(target?.commitSha).toBe("deadbeef1234567890");
    expect(target?.changedFiles).toEqual(["src/App.tsx"]);
    expect(target?.targetRepository).toBe("pjryu0322/aiproject");
  });
});
