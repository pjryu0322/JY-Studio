import { describe, expect, it } from "vitest";
import { CODE_TASK_EXECUTION_RUN_VERSION } from "@/lib/prototype/codeTaskExecutionRun";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { buildFailedCodeTaskGithubOutcome } from "@/lib/prototype/codeTaskGithubOutcome";
import {
  findAuthoritativeLatestRunForCodeTask,
  resolveAuthoritativeCodeTaskOutcome,
} from "@/lib/prototype/implementationCodeTaskOutcomeResolver";
import { buildUserSafeCodeTaskFailureMessage } from "@/lib/prototype/implementationUserSafeFailureMessage";
import {
  buildAuthoritativeOutcomeResolvedLogEntry,
  buildOperatorDiagnosticLoggedEntry,
} from "@/lib/prototype/implementationExecutionLogger";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import {
  buildImplementationRuntimeSnapshot,
  formatImplementationRuntimeSnapshotSummaryLines,
} from "@/lib/prototype/implementationRuntimeSnapshotBuilder";
import { evaluateIntegrationPipelineButtonFromSnapshot } from "@/lib/prototype/implementationIntegrationButtonPolicy";
import { markFinalWiringIntegrationStepReady } from "@/lib/prototype/implementationFinalWiringService";
import { resolveExecutionUnitVerificationDisplayStatus } from "@/lib/prototype/implementationExecutionUnitVerification";

const PID = "p-core-02";
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

function verifiedRun(codeTaskId: string, attemptNo = 1): CodeTaskExecutionRunV1 {
  return {
    version: CODE_TASK_EXECUTION_RUN_VERSION,
    runId: `run-verified-${attemptNo}`,
    projectId: PID,
    processTaskId: "DEV-FRAME-001",
    workItemId: "wi",
    codeTaskId,
    status: "github_verified",
    attemptNo,
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
    attemptNo: 2,
    createdAt: "2026-06-08T13:00:00.000Z",
    updatedAt: "2026-06-08T13:00:00.000Z",
    workBranch: "wip/foundation/app-shell",
    githubOutcome: buildFailedCodeTaskGithubOutcome({
      checkedAt: NOW,
      reason: "github_branch_missing",
      retryable: true,
      message: "apiStatus=404",
    }),
  };
}

describe("P3-Runtime-Core-02 authoritative outcome", () => {
  it("treats persisted failed outcome as failed", () => {
    const u = unit({ unitId: "u1", codeTaskId: "CODE-DEV-FRAME-001-001", status: "failed" });
    const outcome = resolveAuthoritativeCodeTaskOutcome({
      unit: u,
      runs: [branchMissingFailedRun(u.codeTaskId)],
    });
    expect(outcome.status).toBe("failed");
    expect(outcome.latestOutcomeStatus).toBe("failed");
  });

  it("unit verified with persisted failed outcome is failed (not completed)", () => {
    const u = unit({ unitId: "u1", codeTaskId: "CODE-DEV-FRAME-001-001", status: "verified" });
    const runs = [branchMissingFailedRun(u.codeTaskId)];
    const outcome = resolveAuthoritativeCodeTaskOutcome({ unit: u, runs });
    expect(outcome.status).toBe("failed");
    expect(resolveExecutionUnitVerificationDisplayStatus({ unit: u, run: null, runs })).toBe("failed");
  });

  it("requires persisted verified outcome for verified status", () => {
    const u = unit({ unitId: "u1", codeTaskId: "CODE-A", status: "verified" });
    const outcome = resolveAuthoritativeCodeTaskOutcome({
      unit: u,
      runs: [verifiedRun("CODE-A")],
    });
    expect(outcome.status).toBe("verified");
  });

  it("does not verify from quality gate pass alone", () => {
    const u = unit({ unitId: "u1", codeTaskId: "CODE-A", status: "verified" });
    const outcome = resolveAuthoritativeCodeTaskOutcome({
      unit: u,
      runs: [
        {
          ...verifiedRun("CODE-A"),
          status: "quality_gate_passed",
          githubOutcome: undefined,
        },
      ],
    });
    expect(outcome.status).toBe("inconsistent");
  });

  it("picks latest run by attemptNo", () => {
    const runs = [verifiedRun("CODE-A", 1), branchMissingFailedRun("CODE-A")];
    const latest = findAuthoritativeLatestRunForCodeTask(runs, "CODE-A");
    expect(latest?.runId).toBe("run-failed-branch");
  });
});

describe("P3-Runtime-Core-02 user-safe failure messages", () => {
  it("maps github_branch_missing for users", () => {
    const msg = buildUserSafeCodeTaskFailureMessage({
      reason: "github_branch_missing",
      codeTaskTitle: "화면 프레임/앱 Shell 구성",
    });
    expect(msg.message).toContain("작업 branch를 확인하지 못했습니다.");
    expect(msg.message).not.toContain("404");
    expect(msg.message).not.toContain("wip/foundation/app-shell");
  });

  it("logs operator diagnostics without exposing them in user message", () => {
    const entry = buildOperatorDiagnosticLoggedEntry({
      projectId: PID,
      fields: {
        runId: "run-failed-branch",
        workBranch: "wip/foundation/app-shell",
        apiStatus: 404,
        reason: "github_branch_missing",
      },
    });
    expect(entry.action).toBe("implementation_codetask_operator_diagnostic_logged");
    expect(entry.responseText).toContain("runId=run-failed-branch");
    expect(entry.responseText).toContain("apiStatus=404");
  });
});

describe("P3-Runtime-Core-02 snapshot and integration UI policy", () => {
  const units = [
    unit({ unitId: "u1", codeTaskId: "CT-1", status: "verified", order: 0 }),
    unit({ unitId: "u2", codeTaskId: "CT-2", status: "verified", order: 1, title: "B" }),
  ];

  it("summary shows failed count when one unit failed", () => {
    const failedUnit = unit({
      unitId: "u3",
      codeTaskId: "CT-3",
      status: "failed",
      order: 2,
      title: "C",
    });
    const allUnits = [...units, failedUnit];
    const runs = [verifiedRun("CT-1"), verifiedRun("CT-2"), branchMissingFailedRun("CT-3")];
    const snapshot = buildImplementationRuntimeSnapshot({
      projectId: PID,
      executionUnits: allUnits,
      selectedExecutionUnitIds: allUnits.map((u) => u.unitId),
      codeTaskRuns: runs,
      integrationSteps: [
        {
          stepId: "s1",
          kind: "final_wiring",
          title: "Wiring",
          order: 1,
          status: "pending",
        },
      ],
    });
    expect(snapshot.codeTask.completed).toBe(2);
    expect(snapshot.codeTask.failed).toBe(1);
    const summary = formatImplementationRuntimeSnapshotSummaryLines(snapshot).join("\n");
    expect(summary).toContain("실패 CodeTask: 1개");
    expect(summary).toContain("실패 작업 재실행 필요");
  });

  it("keeps integration button visible but disabled when failed units exist", () => {
    const failedUnit = unit({ unitId: "u3", codeTaskId: "CT-3", status: "failed", order: 2 });
    const allUnits = [...units, failedUnit];
    const snapshot = buildImplementationRuntimeSnapshot({
      projectId: PID,
      executionUnits: allUnits,
      selectedExecutionUnitIds: allUnits.map((u) => u.unitId),
      codeTaskRuns: [verifiedRun("CT-1"), verifiedRun("CT-2"), branchMissingFailedRun("CT-3")],
      integrationSteps: [
        { stepId: "s1", kind: "final_wiring", title: "Wiring", order: 1, status: "pending" },
      ],
    });
    const button = evaluateIntegrationPipelineButtonFromSnapshot(snapshot);
    expect(button.show).toBe(true);
    expect(button.enabled).toBe(false);
    expect(button.disabledReasonLines.join("\n")).toContain("실패한 CodeTask가 있어 통합을 시작할 수 없습니다.");
    expect(button.disabledReasonLines.join("\n")).not.toContain("run-failed");
  });

  it("snapshot unit exposes user-safe failed card labels", () => {
    const failedUnit = unit({ unitId: "u1", codeTaskId: "CODE-DEV-FRAME-001-001", status: "verified" });
    const snapshot = buildImplementationRuntimeSnapshot({
      projectId: PID,
      executionUnits: [failedUnit],
      selectedExecutionUnitIds: [failedUnit.unitId],
      codeTaskRuns: [branchMissingFailedRun("CODE-DEV-FRAME-001-001")],
      integrationSteps: [],
    });
    const row = snapshot.units[0]!;
    expect(row.statusLabel).toBe("실패");
    expect(row.progressLabel).toBe("다시 실행 필요");
    expect(row.userSafeFailureMessage).toContain("작업 branch를 확인하지 못했습니다.");
    expect(row.userSafeFailureMessage).not.toContain("404");
    expect(row.userSafeFailureMessage).not.toContain("wip/foundation/app-shell");
  });
});

describe("P3-Runtime-Core-02 integration gate", () => {
  it("blocks final_wiring_ready when failed outcome exists", async () => {
    const u = unit({ unitId: "u1", codeTaskId: "CODE-DEV-FRAME-001-001", status: "verified" });
    const result = await markFinalWiringIntegrationStepReady({
      projectId: PID,
      requirementsState: {
        implementationExecutionUnitsV1: {
          version: "implementation_execution_units_v1",
          projectId: PID,
          updatedAt: NOW,
          units: [u],
          selectedExecutionUnitIds: [u.unitId],
        },
        implementationIntegrationStepsV1: {
          version: "implementation_integration_steps_v1",
          projectId: PID,
          updatedAt: NOW,
          steps: [
            {
              stepId: "final-wiring",
              kind: "final_wiring",
              title: "최종 연결/통합 Wiring",
              order: 1,
              status: "pending",
            },
          ],
        },
      },
      codeTaskPlan: null,
      runs: [branchMissingFailedRun("CODE-DEV-FRAME-001-001")],
    });
    expect(
      result.timeline.some((t) => t.action === "implementation_integration_gate_blocked_by_failed_codetask"),
    ).toBe(true);
    expect(result.timeline.some((t) => t.action === "implementation_integration_final_wiring_ready")).toBe(
      false,
    );
  });
});

describe("P3-Runtime-Core-02 logging", () => {
  it("records authoritative outcome resolution for operators", () => {
    const u = unit({ unitId: "u1", codeTaskId: "CODE-A", status: "failed" });
    const outcome = resolveAuthoritativeCodeTaskOutcome({
      unit: u,
      runs: [branchMissingFailedRun("CODE-A")],
    });
    const entry = buildAuthoritativeOutcomeResolvedLogEntry({
      projectId: PID,
      outcome,
      workBranch: "wip/foundation/app-shell",
      apiStatus: 404,
    });
    expect(entry.action).toBe("implementation_codetask_authoritative_outcome_resolved");
    expect(entry.responseText).toContain("reason=github_branch_missing");
  });
});
