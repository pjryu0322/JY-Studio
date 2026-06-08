import { describe, expect, it } from "vitest";
import {
  ensurePersistedImplementationExecutionUnits,
  buildExecutionUnitGithubVerifyPatch,
  shouldPersistHasNextQuickRunDispatch,
} from "@/lib/prototype/implementationExecutionRuntime";
import {
  loadImplementationExecutionUnitsFromState,
  parseImplementationExecutionUnitsStateV1,
  saveImplementationExecutionUnitsToState,
} from "@/lib/prototype/implementationExecutionUnitStore";
import { resolveNextExecutableUnit } from "@/lib/prototype/implementationExecutionScheduler";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

const PID = "p-m69";
const NOW = "2026-06-03T12:00:00.000Z";

function unit(id: string, status: ImplementationExecutionUnitV1["status"]): ImplementationExecutionUnitV1 {
  return {
    unitId: id,
    codeTaskId: id,
    processTaskId: `DEV-${id}`,
    title: id,
    order: 0,
    branchGroup: "screen",
    baseBranch: "main",
    workBranch: "wip/screen/workspace",
    dependencies: [],
    status,
  };
}

describe("P3-M69 execution unit store", () => {
  it("bootstraps from legacy when persisted state is missing", () => {
    const plan = {
      version: "implementation_code_task_plan_v1" as const,
      projectId: PID,
      generatedAt: NOW,
      tasks: [
        {
          codeTaskId: "CT-A",
          parentTaskId: "DEV-A",
          title: "A",
          description: "",
          changeType: "feature" as const,
          acceptanceCriteria: [],
          verificationHints: [],
          forbiddenPaths: [],
          candidateFiles: [],
          branchPlan: {
            branchGroup: "screen" as const,
            workBranch: "wip/a",
            baseBranch: "main",
            executionMode: "sequential" as const,
          },
        },
      ],
    };
    const result = ensurePersistedImplementationExecutionUnits({
      projectId: PID,
      requirementsState: {},
      codeTaskPlan: plan,
      nowIso: NOW,
    });
    expect(result.bootstrapped).toBe(true);
    expect(result.units).toHaveLength(1);
    expect(result.orchestrationPatch.implementationExecutionUnitsV1?.units).toHaveLength(1);
  });

  it("uses persisted units without re-bootstrap", () => {
    const persisted = saveImplementationExecutionUnitsToState({
      projectId: PID,
      units: [unit("CT-P", "verified")],
      reason: "test",
      nowIso: NOW,
    });
    const state: RequirementsStateJson = { ...persisted };
    const result = ensurePersistedImplementationExecutionUnits({
      projectId: PID,
      requirementsState: state,
      codeTaskPlan: null,
    });
    expect(result.bootstrapped).toBe(false);
    expect(result.units).toHaveLength(1);
    expect(result.units[0]?.status).toBe("verified");
  });

  it("parseImplementationExecutionUnitsStateV1 round-trips", () => {
    const raw = saveImplementationExecutionUnitsToState({
      projectId: PID,
      units: [unit("CT-1", "ready")],
      reason: "test",
      nowIso: NOW,
    }).implementationExecutionUnitsV1;
    const parsed = parseImplementationExecutionUnitsStateV1(raw);
    expect(parsed?.units).toHaveLength(1);
    expect(parsed?.units[0]?.processTaskId).toBe("DEV-CT-1");
  });
});

describe("P3-M69 hasNextDispatch from persisted units", () => {
  it("hasNextDispatch true when ready unit remains", () => {
    const state: RequirementsStateJson = {
      ...saveImplementationExecutionUnitsToState({
        projectId: PID,
        units: [unit("U1", "verified"), unit("U2", "ready")],
        reason: "test",
        nowIso: NOW,
      }),
    };
    expect(
      shouldPersistHasNextQuickRunDispatch({
        projectId: PID,
        requirementsState: state,
        selectedCodeTaskIds: ["U1", "U2"],
      }),
    ).toBe(true);
  });

  it("hasNextDispatch false only when complete", () => {
    const state: RequirementsStateJson = {
      ...saveImplementationExecutionUnitsToState({
        projectId: PID,
        units: [unit("U1", "verified"), unit("U2", "verified")],
        reason: "test",
        nowIso: NOW,
      }),
    };
    const next = resolveNextExecutableUnit({
      units: loadImplementationExecutionUnitsFromState(state),
      selectedUnitIds: ["U1", "U2"],
    });
    expect(next.status).toBe("complete");
    expect(
      shouldPersistHasNextQuickRunDispatch({
        projectId: PID,
        requirementsState: state,
        selectedCodeTaskIds: ["U1", "U2"],
      }),
    ).toBe(false);
  });
});

describe("P3-M69 github verify patches execution unit", () => {
  it("marks unit verified when head sha changes", () => {
    const state: RequirementsStateJson = {
      ...saveImplementationExecutionUnitsToState({
        projectId: PID,
        units: [{ ...unit("CT-1", "verifying"), beforeHeadSha: "aaa", runId: "run-1" }],
        reason: "test",
        nowIso: NOW,
      }),
    };
    const patch = buildExecutionUnitGithubVerifyPatch({
      state,
      projectId: PID,
      codeTaskId: "CT-1",
      githubOutcome: {
        status: "verified",
        checkedAt: NOW,
        workBranch: "wip/screen/workspace",
        commitSha: "bbb",
        source: "github_rest",
        headSha: "bbb",
        baseHeadSha: "aaa",
      },
      run: {
        version: "code_task_execution_run_v1",
        runId: "run-1",
        projectId: PID,
        processTaskId: "DEV-CT-1",
        workItemId: "wi",
        codeTaskId: "CT-1",
        status: "github_verifying",
        attemptNo: 1,
        createdAt: NOW,
        updatedAt: NOW,
        workBranch: "wip/screen/workspace",
      },
      nowIso: NOW,
    });
    const saved = patch.orchestrationPatch.implementationExecutionUnitsV1?.units?.[0];
    expect(saved?.status).toBe("verified");
    expect(saved?.afterHeadSha).toBe("bbb");
    expect(saved?.commitSha).toBe("bbb");
  });
});
