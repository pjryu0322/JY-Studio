import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveExecutionUnitRunHistory } from "@/lib/prototype/implementationExecutionUnitRunHistory";
import { resolveNextExecutableUnit } from "@/lib/prototype/implementationExecutionScheduler";
import { saveImplementationExecutionUnitsToState } from "@/lib/prototype/implementationExecutionUnitStore";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

const __dirname = dirname(fileURLToPath(import.meta.url));
const prototypeDir = join(__dirname, "../../src/lib/prototype");

function readPrototypeSource(name: string): string {
  return readFileSync(join(prototypeDir, name), "utf8");
}

function unit(
  id: string,
  status: ImplementationExecutionUnitV1["status"],
  overrides?: Partial<ImplementationExecutionUnitV1>,
): ImplementationExecutionUnitV1 {
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
    ...overrides,
  };
}

const PLAN = {
  version: "implementation_code_task_plan_v1" as const,
  projectId: "p-m71",
  generatedAt: "2026-06-03T12:00:00.000Z",
  tasks: [
    {
      codeTaskId: "CT-A",
      parentTaskId: "DEV-CT-A",
      title: "A",
      description: "",
      changeType: "feature" as const,
      acceptanceCriteria: [],
      verificationHints: [],
      forbiddenPaths: [],
      candidateFiles: [],
      branchPlan: {
        branchGroup: "screen" as const,
        workBranch: "wip/screen/workspace",
        baseBranch: "main",
        executionMode: "sequential" as const,
      },
    },
  ],
};

describe("P3-M71 direct scheduler cutover", () => {
  it("implementationExecutionSchedulerDispatch does not call legacy continuation", () => {
    const src = readPrototypeSource("implementationExecutionSchedulerDispatch.ts");
    expect(src).not.toContain("continueSelectedCodeTaskQueueAfterAutoGate");
    expect(src).toContain("dispatchNextExecutionUnitOnServer");
  });

  it("implementationExecutionUnitDispatchService does not import legacy continuation", () => {
    const src = readPrototypeSource("implementationExecutionUnitDispatchService.ts");
    expect(src).not.toContain("continueSelectedCodeTaskQueueAfterAutoGate");
  });

  it("serverQuickRunContinuationService marks legacy entrypoints deprecated", () => {
    const src = readPrototypeSource("serverQuickRunContinuationService.ts");
    expect(src).toContain("@deprecated legacy_runtime_deprecated");
    expect(src).toContain("continueSelectedCodeTaskQueueAfterAutoGate");
    expect(src).toContain("tryDispatchCurrentQueuedQuickRunAfterDbAdvance");
  });
});

describe("P3-M71 execution unit run history", () => {
  it("blocks dispatch when processTaskId or workBranch is missing", () => {
    const result = resolveExecutionUnitRunHistory({
      projectId: "p1",
      unit: unit("CT-A", "ready", { processTaskId: "", workBranch: "" }),
      runs: [],
      codeTaskPlan: PLAN,
      taskList: null,
    });
    expect(result.status).toBe("blocked");
  });

  it("creates run history from unit tuple when missing", () => {
    const u = unit("CT-A", "ready", { processTaskId: "DEV-CT-A" });
    const result = resolveExecutionUnitRunHistory({
      projectId: "p1",
      unit: u,
      runs: [],
      codeTaskPlan: PLAN,
      taskList: null,
      cursorWorkItems: [{ id: "cursor-wi-CT-A", taskId: "DEV-CT-A", codeTaskId: "CT-A", title: "wi", status: "ready" }],
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.created).toBe(true);
      expect(result.runs[0]?.workBranch).toBe("wip/screen/workspace");
      expect(result.runs[0]?.processTaskId).toBe("DEV-CT-A");
    }
  });

  it("records mismatch when existing run workBranch differs", () => {
    const u = unit("CT-A", "ready", { processTaskId: "DEV-CT-A" });
    const result = resolveExecutionUnitRunHistory({
      projectId: "p1",
      unit: u,
      runs: [
        {
          version: "code_task_execution_run_v1",
          runId: "r1",
          projectId: "p1",
          processTaskId: "DEV-CT-A",
          workItemId: "wi",
          codeTaskId: "CT-A",
          status: "queued",
          attemptNo: 1,
          createdAt: "2026-06-03T12:00:00.000Z",
          updatedAt: "2026-06-03T12:00:00.000Z",
          workBranch: "wip/other-branch",
        },
      ],
      codeTaskPlan: PLAN,
      taskList: null,
      cursorWorkItems: [{ id: "cursor-wi-CT-A", taskId: "DEV-CT-A", codeTaskId: "CT-A", title: "wi", status: "ready" }],
    });
  });
});

describe("P3-M71 scheduler resolution", () => {
  it("empty selectedExecutionUnitIds yields empty_selection", () => {
    const state: RequirementsStateJson = {
      ...saveImplementationExecutionUnitsToState({
        projectId: "p1",
        units: [unit("U1", "ready")],
        selectedExecutionUnitIds: [],
        reason: "test",
      }),
    };
    const next = resolveNextExecutableUnit({
      units: state.implementationExecutionUnitsV1!.units,
      selectedUnitIds: [],
    });
    expect(next.status).toBe("empty_selection");
  });

  it("all verified selected units yield complete", () => {
    const next = resolveNextExecutableUnit({
      units: [unit("U1", "verified"), unit("U2", "verified", { order: 1 })],
      selectedUnitIds: ["U1", "U2"],
    });
    expect(next.status).toBe("complete");
  });

  it("verifying unit yields in_flight", () => {
    const next = resolveNextExecutableUnit({
      units: [unit("U1", "verifying")],
      selectedUnitIds: ["U1"],
    });
    expect(next.status).toBe("in_flight");
  });
});
