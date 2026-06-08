import { describe, expect, it } from "vitest";
import {
  mapSelectedCodeTaskIdsToExecutionUnitIds,
  resolveNextExecutableUnit,
} from "@/lib/prototype/implementationExecutionScheduler";
import {
  reconcileImplementationExecutionSelectedUnits,
  areAllSelectedExecutionUnitsVerified,
} from "@/lib/prototype/implementationExecutionSelectedUnits";
import { buildImplementationExecutionSummaryCounts } from "@/lib/prototype/implementationExecutionSummary";
import { shouldPersistHasNextQuickRunDispatch } from "@/lib/prototype/implementationExecutionRuntime";
import { saveImplementationExecutionUnitsToState } from "@/lib/prototype/implementationExecutionUnitStore";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { LEGACY_QUICK_RUN_RUNTIME_USAGE_MAP } from "@/lib/prototype/legacyQuickRunRuntimeUsageMap";

const PID = "p-m70";
const NOW = "2026-06-03T12:00:00.000Z";

function unit(id: string, status: ImplementationExecutionUnitV1["status"], order = 0): ImplementationExecutionUnitV1 {
  return {
    unitId: id,
    codeTaskId: id,
    processTaskId: `DEV-${id}`,
    title: id,
    order,
    branchGroup: "screen",
    baseBranch: "main",
    workBranch: "wip/screen/workspace",
    dependencies: [],
    status,
  };
}

describe("P3-M70 selectedExecutionUnitIds", () => {
  it("migrates selectedCodeTaskIds to selectedExecutionUnitIds once", () => {
    const units = [unit("CT-A", "ready"), unit("CT-B", "ready", 1)];
    const state: RequirementsStateJson = {
      ...saveImplementationExecutionUnitsToState({
        projectId: PID,
        units,
        reason: "test",
        nowIso: NOW,
      }),
    };
    const result = reconcileImplementationExecutionSelectedUnits({
      projectId: PID,
      state,
      units,
      legacySelectedCodeTaskIds: ["CT-A", "CT-B"],
      nowIso: NOW,
    });
    expect(result.selectedUnitIds).toEqual(["CT-A", "CT-B"]);
    expect(result.timeline.some((e) => e.action === "legacy_selected_code_task_ids_migrated")).toBe(true);
    expect(
      result.orchestrationPatch.implementationExecutionUnitsV1?.selectedExecutionUnitIds,
    ).toEqual(["CT-A", "CT-B"]);
  });

  it("uses persisted selectedExecutionUnitIds for next dispatch resolution", () => {
    const state: RequirementsStateJson = {
      ...saveImplementationExecutionUnitsToState({
        projectId: PID,
        units: [unit("U1", "verified"), unit("U2", "ready", 1)],
        selectedExecutionUnitIds: ["U1", "U2"],
        reason: "test",
        nowIso: NOW,
      }),
    };
    const next = resolveNextExecutableUnit({
      units: state.implementationExecutionUnitsV1!.units,
      selectedUnitIds: state.implementationExecutionUnitsV1!.selectedExecutionUnitIds!,
    });
    expect(next.status).toBe("next");
    if (next.status === "next") expect(next.unit.unitId).toBe("U2");
  });

  it("maps code task ids to unit ids when they differ by lookup", () => {
    const units = [{ ...unit("unit-a", "ready"), codeTaskId: "CODE-A", unitId: "unit-a" }];
    expect(mapSelectedCodeTaskIdsToExecutionUnitIds(["CODE-A"], units)).toEqual(["unit-a"]);
  });
});

describe("P3-M70 summary counts execution-unit-only", () => {
  it("total is execution unit count not work item count", () => {
    const plan = {
      version: "implementation_code_task_plan_v1" as const,
      projectId: PID,
      generatedAt: NOW,
      tasks: Array.from({ length: 15 }, (_, i) => ({
        codeTaskId: `CT-${i}`,
        parentTaskId: `DEV-${i}`,
        title: `T${i}`,
        description: "",
        changeType: "feature" as const,
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
        branchPlan: {
          branchGroup: "screen" as const,
          workBranch: `wip/${i}`,
          baseBranch: "main",
          executionMode: "sequential" as const,
        },
      })),
    };
    const summary = buildImplementationExecutionSummaryCounts({
      projectId: PID,
      requirementsState: {},
      codeTaskPlan: plan,
      selectedCodeTaskIds: plan.tasks.map((t) => t.codeTaskId),
      workItemCount: 16,
    });
    expect(summary.totalCodeTaskCount).toBe(15);
    expect(summary.totalCodeTaskCount).not.toBe(16);
  });
});

describe("P3-M70 hasNextDispatch from units only", () => {
  it("hasNextDispatch true when ready unit remains after verify", () => {
    const state: RequirementsStateJson = {
      ...saveImplementationExecutionUnitsToState({
        projectId: PID,
        units: [unit("U1", "verified"), unit("U2", "ready", 1)],
        selectedExecutionUnitIds: ["U1", "U2"],
        reason: "test",
        nowIso: NOW,
      }),
    };
    expect(
      shouldPersistHasNextQuickRunDispatch({
        projectId: PID,
        requirementsState: state,
      }),
    ).toBe(true);
  });

  it("hasNextDispatch false when all selected units verified", () => {
    const state: RequirementsStateJson = {
      ...saveImplementationExecutionUnitsToState({
        projectId: PID,
        units: [unit("U1", "verified"), unit("U2", "verified", 1)],
        selectedExecutionUnitIds: ["U1", "U2"],
        reason: "test",
        nowIso: NOW,
      }),
    };
    expect(
      shouldPersistHasNextQuickRunDispatch({
        projectId: PID,
        requirementsState: state,
      }),
    ).toBe(false);
  });
});

describe("P3-M70 integration eligible from execution units", () => {
  it("eligible when all selected units are verified", () => {
    const units = [unit("A", "verified"), unit("B", "verified", 1)];
    expect(
      areAllSelectedExecutionUnitsVerified({ units, selectedUnitIds: ["A", "B"] }),
    ).toBe(true);
    expect(
      areAllSelectedExecutionUnitsVerified({ units, selectedUnitIds: ["A", "B", "C"] }),
    ).toBe(false);
  });
});

describe("P3-M70 legacy usage map", () => {
  it("documents deprecated fallback dispatch", () => {
    expect(LEGACY_QUICK_RUN_RUNTIME_USAGE_MAP["quick_run_queued_fallback_dispatch_requested"]).toBe(
      "legacy_runtime_deprecated",
    );
  });
});
