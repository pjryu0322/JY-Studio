import { describe, expect, it } from "vitest";
import { CODE_TASK_EXECUTION_RUN_VERSION } from "@/lib/prototype/codeTaskExecutionRun";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { buildFailedCodeTaskGithubOutcome } from "@/lib/prototype/codeTaskGithubOutcome";
import { resolveAuthoritativeCodeTaskOutcome } from "@/lib/prototype/implementationCodeTaskOutcomeResolver";
import { buildUserSafeCodeTaskFailureMessage } from "@/lib/prototype/implementationUserSafeFailureMessage";
import {
  buildCodeTaskOperatorDiagnosticTimelineEntry,
  shouldPersistOperatorDiagnosticForFailure,
} from "@/lib/prototype/implementationOperatorDiagnosticLogger";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import {
  buildImplementationRuntimeSnapshot,
  formatImplementationRuntimeSnapshotSummaryLines,
} from "@/lib/prototype/implementationRuntimeSnapshotBuilder";
import { evaluateIntegrationPipelineButtonFromSnapshot } from "@/lib/prototype/implementationIntegrationButtonPolicy";
import { prepareFailedExecutionUnitRetry } from "@/lib/prototype/implementationExecutionRetryService";

const PID = "p-core-021";
const NOW = "2026-06-08T12:00:00.000Z";

function unit(
  input: Partial<ImplementationExecutionUnitV1> & Pick<ImplementationExecutionUnitV1, "unitId" | "codeTaskId">,
): ImplementationExecutionUnitV1 {
  return {
    processTaskId: "DEV-FRAME-001",
    title: "화면 프레임/앱 Shell 구성",
    order: 0,
    branchGroup: "foundation",
    baseBranch: "main",
    workBranch: "wip/foundation/app-shell",
    dependencies: [],
    status: "ready",
    ...input,
  };
}

function verifiedRun(codeTaskId: string): CodeTaskExecutionRunV1 {
  return {
    version: CODE_TASK_EXECUTION_RUN_VERSION,
    runId: `run-verified-${codeTaskId}`,
    projectId: PID,
    processTaskId: "DEV-FRAME-001",
    workItemId: "wi",
    codeTaskId,
    status: "github_verified",
    attemptNo: 1,
    createdAt: NOW,
    updatedAt: NOW,
    commitSha: "abc",
    githubOutcome: {
      status: "verified",
      checkedAt: NOW,
      workBranch: "wip/foundation/app-shell",
      commitSha: "abc",
      source: "github_rest",
    },
  };
}

function branchMissingFailedRun(codeTaskId: string): CodeTaskExecutionRunV1 {
  return {
    version: CODE_TASK_EXECUTION_RUN_VERSION,
    runId: "run-failed-branch",
    projectId: PID,
    processTaskId: "DEV-FRAME-001",
    workItemId: "wi",
    codeTaskId,
    status: "failed",
    attemptNo: 1,
    createdAt: NOW,
    updatedAt: NOW,
    workBranch: "wip/foundation/app-shell",
    githubOutcome: buildFailedCodeTaskGithubOutcome({
      checkedAt: NOW,
      reason: "github_branch_missing",
      retryable: true,
      message: "apiStatus=404",
    }),
  };
}

describe("P3-Runtime-Core-02-1 operator diagnostic logging", () => {
  it("creates operator diagnostic timeline entry for persisted failed outcome", () => {
    expect(
      shouldPersistOperatorDiagnosticForFailure({
        outcomeStatus: "failed",
        reason: "github_branch_missing",
      }),
    ).toBe(true);
    const entry = buildCodeTaskOperatorDiagnosticTimelineEntry({
      projectId: PID,
      codeTaskId: "CODE-A",
      runId: "run-failed-branch",
      workBranch: "wip/foundation/app-shell",
      apiStatus: 404,
      reason: "github_branch_missing",
      outcomeStatus: "failed",
    });
    expect(entry.action).toBe("implementation_codetask_operator_diagnostic_logged");
    expect(entry.responseText).toContain("workBranch=wip/foundation/app-shell");
    expect(entry.responseText).toContain("apiStatus=404");
    expect(entry.responseText).toContain("runId=run-failed-branch");
  });

  it("keeps operator fields out of user-safe messages", () => {
    const msg = buildUserSafeCodeTaskFailureMessage({
      reason: "github_branch_missing",
      codeTaskTitle: "Shell",
    });
    expect(msg.reasonLine).toContain("작업 branch를 확인하지 못했습니다.");
    expect(msg.message).not.toContain("404");
    expect(msg.message).not.toContain("wip/foundation/app-shell");
    expect(msg.message).not.toContain("run-failed");
  });
});

describe("P3-Runtime-Core-02-1 integration button visibility", () => {
  it("shows disabled button when failed units exist", () => {
    const u1 = unit({ unitId: "u1", codeTaskId: "CT-1", status: "verified" });
    const u2 = unit({ unitId: "u2", codeTaskId: "CT-2", status: "failed" });
    const snapshot = buildImplementationRuntimeSnapshot({
      projectId: PID,
      executionUnits: [u1, u2],
      selectedExecutionUnitIds: [u1.unitId, u2.unitId],
      codeTaskRuns: [branchMissingFailedRun("CT-2")],
      integrationSteps: [
        { stepId: "s1", kind: "final_wiring", title: "Wiring", order: 1, status: "pending" },
      ],
    });
    const button = evaluateIntegrationPipelineButtonFromSnapshot(snapshot);
    expect(button.show).toBe(true);
    expect(button.enabled).toBe(false);
    expect(button.disabledReasonLines.join("\n")).toContain("실패한 CodeTask가 있어");
  });

  it("shows disabled button when integration steps are empty", () => {
    const u1 = unit({ unitId: "u1", codeTaskId: "CT-1", status: "verified" });
    const snapshot = buildImplementationRuntimeSnapshot({
      projectId: PID,
      executionUnits: [u1],
      selectedExecutionUnitIds: [u1.unitId],
      codeTaskRuns: [verifiedRun("CT-1")],
      integrationSteps: [],
    });
    const button = evaluateIntegrationPipelineButtonFromSnapshot(snapshot);
    expect(button.show).toBe(true);
    expect(button.enabled).toBe(false);
    expect(button.disabledReasonLines.join("\n")).toContain("통합 단계를 준비하지 못했습니다.");
  });
});

describe("P3-Runtime-Core-02-1 user-safe snapshot cards", () => {
  it("does not mark failed outcome as completed in summary", () => {
    const failed = unit({ unitId: "u1", codeTaskId: "CT-1", status: "verified" });
    const snapshot = buildImplementationRuntimeSnapshot({
      projectId: PID,
      executionUnits: [failed],
      selectedExecutionUnitIds: [failed.unitId],
      codeTaskRuns: [branchMissingFailedRun("CT-1")],
      integrationSteps: [],
    });
    expect(snapshot.codeTask.completed).toBe(0);
    expect(snapshot.codeTask.failed).toBe(1);
    const row = snapshot.units[0]!;
    expect(row.statusLabel).toBe("실패");
    expect(row.userSafeFailureReasonLine).toContain("작업 branch를 확인하지 못했습니다.");
    const summary = formatImplementationRuntimeSnapshotSummaryLines(snapshot).join("\n");
    expect(summary).toContain("실패 CodeTask: 1개");
  });
});

describe("P3-Runtime-Core-02-1 retry logging", () => {
  it("logs retry_prepared on success path", () => {
    const u = unit({ unitId: "u1", codeTaskId: "CT-1", status: "failed", retryable: true });
    const result = prepareFailedExecutionUnitRetry({
      projectId: PID,
      codeTaskId: "CT-1",
      requirementsState: {
        implementationExecutionUnitsV1: {
          version: "implementation_execution_units_v1",
          projectId: PID,
          updatedAt: NOW,
          units: [u],
        },
        codeTaskExecutionRunsV1: [branchMissingFailedRun("CT-1")],
      },
    });
    expect(result.ok).toBe(true);
    expect(result.timeline.some((t) => t.action === "implementation_codetask_retry_prepared")).toBe(true);
  });

  it("logs retry_blocked when unit is not retryable", () => {
    const u = unit({ unitId: "u1", codeTaskId: "CT-1", status: "failed", retryable: false });
    const result = prepareFailedExecutionUnitRetry({
      projectId: PID,
      codeTaskId: "CT-1",
      requirementsState: {
        implementationExecutionUnitsV1: {
          version: "implementation_execution_units_v1",
          projectId: PID,
          updatedAt: NOW,
          units: [u],
        },
        codeTaskExecutionRunsV1: [branchMissingFailedRun("CT-1")],
      },
    });
    expect(result.ok).toBe(false);
    expect(result.timeline.some((t) => t.action === "implementation_codetask_retry_blocked")).toBe(true);
  });
});

describe("P3-Runtime-Core-02-1 task tree user-safe fields", () => {
  it("does not attach githubVerifyTechnicalLines to nodes", () => {
    const failed = unit({ unitId: "u1", codeTaskId: "CODE-A", status: "verified" });
    const snapshot = buildImplementationRuntimeSnapshot({
      projectId: PID,
      executionUnits: [failed],
      selectedExecutionUnitIds: [failed.unitId],
      codeTaskRuns: [branchMissingFailedRun("CODE-A")],
      integrationSteps: [],
    });
    const outcome = resolveAuthoritativeCodeTaskOutcome({
      unit: failed,
      runs: [branchMissingFailedRun("CODE-A")],
    });
    expect(outcome.status).toBe("failed");
    expect(snapshot.units[0]?.userSafeFailureReasonLine).toBeTruthy();
    expect(JSON.stringify(snapshot.units[0])).not.toContain("githubVerifyTechnicalLines");
  });
});
