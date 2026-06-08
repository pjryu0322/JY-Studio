import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CODE_TASK_EXECUTION_RUN_VERSION } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import { saveImplementationExecutionUnitsToState } from "@/lib/prototype/implementationExecutionUnitStore";
import { resolveNextExecutableUnit } from "@/lib/prototype/implementationExecutionScheduler";
import { mergeRequirementsStateJson, type RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

const __dirname = dirname(fileURLToPath(import.meta.url));
const prototypeDir = join(__dirname, "../../src/lib/prototype");
const appDir = join(__dirname, "../../src/app");

const {
  projectFindUniqueMock,
  executionSetupFindUniqueMock,
  getBundleMock,
  ensureDbHistoryMock,
  dispatchCursorMock,
  persistOrchestrationMock,
} = vi.hoisted(() => ({
  projectFindUniqueMock: vi.fn(),
  executionSetupFindUniqueMock: vi.fn(),
  getBundleMock: vi.fn(),
  ensureDbHistoryMock: vi.fn(),
  dispatchCursorMock: vi.fn(),
  persistOrchestrationMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findUnique: (...args: unknown[]) => projectFindUniqueMock(...args) },
    executionSetup: { findUnique: (...args: unknown[]) => executionSetupFindUniqueMock(...args) },
  },
}));

vi.mock("@/lib/runtime/implementationRuntime/implementationRuntimeRepository", () => ({
  getImplementationRuntimeBundle: (...args: unknown[]) => getBundleMock(...args),
}));

vi.mock("@/lib/prototype/implementationExecutionUnitRunHistory", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/prototype/implementationExecutionUnitRunHistory")>();
  return {
    ...actual,
    ensureExecutionUnitDbRunHistory: (...args: unknown[]) => ensureDbHistoryMock(...args),
  };
});

vi.mock("@/lib/prototype/implementationExecutionUnitCursorDispatchService", () => ({
  dispatchExecutionUnitWithCursor: (...args: unknown[]) => dispatchCursorMock(...args),
}));

vi.mock("@/lib/prototype/taskCursorJobStateSync", () => ({
  persistTaskCursorOrchestrationToProject: (...args: unknown[]) => persistOrchestrationMock(...args),
}));

import { dispatchNextExecutionUnitOnServer } from "@/lib/prototype/implementationExecutionUnitDispatchService";

const PID = "p-m73";
const NOW = "2026-06-03T12:00:00.000Z";
const SCREEN_1 = "CODE-DEV-SCREEN-001-001";
const SCREEN_2 = "CODE-DEV-SCREEN-002-001";

function readPrototypeSource(name: string): string {
  return readFileSync(join(prototypeDir, name), "utf8");
}

function readAppSource(relativeFromApp: string): string {
  return readFileSync(join(appDir, relativeFromApp), "utf8");
}

function screenTask(id: string, parent: string, deps: string[] = []) {
  return {
    codeTaskId: id,
    parentTaskId: parent,
    title: id,
    description: "",
    changeType: "feature" as const,
    dependencies: deps,
    codeTaskDependencies: deps,
    acceptanceCriteria: [],
    verificationHints: [],
    forbiddenPaths: [],
    candidateFiles: [],
    branchPlan: {
      branchGroup: "screen" as const,
      workBranch: "wip/screen/workspace",
      baseBranch: "wip/feature/core-flow",
      executionMode: "sequential" as const,
    },
  };
}

const PLAN: ImplementationCodeTaskPlanV1 = {
  version: "implementation_code_task_plan_v1",
  projectId: PID,
  generatedAt: NOW,
  tasks: [
    screenTask(SCREEN_1, "DEV-SCREEN-001"),
    screenTask(SCREEN_2, "DEV-SCREEN-002", [SCREEN_1]),
  ],
};

function executionUnit(
  unitId: string,
  codeTaskId: string,
  processTaskId: string,
  status: ImplementationExecutionUnitV1["status"],
  order: number,
): ImplementationExecutionUnitV1 {
  return {
    unitId,
    codeTaskId,
    processTaskId,
    title: unitId,
    order,
    branchGroup: "screen",
    baseBranch: "wip/feature/core-flow",
    workBranch: "wip/screen/workspace",
    dependencies: codeTaskId === SCREEN_2 ? [SCREEN_1] : [],
    status,
  };
}

function screenWorkItems() {
  return [
    {
      id: `cursor-wi-${SCREEN_1}`,
      taskId: "DEV-SCREEN-001",
      codeTaskId: SCREEN_1,
      title: "wi-1",
      status: "ready" as const,
    },
    {
      id: `cursor-wi-${SCREEN_2}`,
      taskId: "DEV-SCREEN-002",
      codeTaskId: SCREEN_2,
      title: "wi-2",
      status: "ready" as const,
    },
  ];
}

function queuedRunForScreen2() {
  return {
    version: CODE_TASK_EXECUTION_RUN_VERSION,
    runId: `run-${SCREEN_2}`,
    projectId: PID,
    processTaskId: "DEV-SCREEN-002",
    workItemId: `cursor-wi-${SCREEN_2}`,
    codeTaskId: SCREEN_2,
    status: "queued" as const,
    attemptNo: 1,
    createdAt: NOW,
    updatedAt: NOW,
    workBranch: "wip/screen/workspace",
  };
}

function buildScreenContinuationState(): RequirementsStateJson {
  const unitsState = saveImplementationExecutionUnitsToState({
    projectId: PID,
    units: [
      executionUnit("U1", SCREEN_1, "DEV-SCREEN-001", "verified", 14),
      executionUnit("U2", SCREEN_2, "DEV-SCREEN-002", "ready", 15),
    ],
    selectedExecutionUnitIds: ["U1", "U2"],
    reason: "p3-m73-test",
    nowIso: NOW,
  });
  return mergeRequirementsStateJson(unitsState, {
    implementationCodeTaskPlanV1: PLAN,
    cursorWorkItemsV1: screenWorkItems(),
    codeTaskExecutionRunsV1: [queuedRunForScreen2()],
  });
}

function readyExecutionSetupRow() {
  return {
    gitRepoUrl: "https://github.com/org/repo",
    gitRepoName: "org/repo",
    gitRepoProvider: "github",
    baseBranch: "main",
    workspacePath: "/workspace",
    allowedPathGlobs: JSON.stringify(["**/*"]),
    autoCommit: true,
    autoPush: true,
    autoPr: false,
    cursorApiUrl: "https://api.cursor.com",
    cursorApiToken: "cursor-token",
    githubAccessToken: "gh-token",
  };
}

describe("P3-M73 orchestrationPatch safety", () => {
  it("does not reference orchestrationPatch before its let declaration", () => {
    const src = readPrototypeSource("implementationExecutionUnitDispatchService.ts");
    const declareIdx = src.indexOf("let orchestrationPatch = mergeOrchestrationPersistPatches");
    expect(declareIdx).toBeGreaterThan(-1);
    const beforeDeclare = src.slice(0, declareIdx);
    expect(beforeDeclare).not.toMatch(/mergeOrchestrationPersistPatches\(\s*orchestrationPatch,/);
  });

  it("declares baseDispatchPatch before execution_setup_not_ready branch", () => {
    const src = readPrototypeSource("implementationExecutionUnitDispatchService.ts");
    const notReadyIdx = src.indexOf('reason: "execution_setup_not_ready"');
    const baseIdx = src.indexOf("const baseDispatchPatch");
    expect(baseIdx).toBeGreaterThan(-1);
    expect(notReadyIdx).toBeGreaterThan(baseIdx);
  });
});

describe("P3-M73 legacy path guards", () => {
  it("taskCursorGithubVerifyService imports mergeRequirementsStateJson once", () => {
    const src = readPrototypeSource("taskCursorGithubVerifyService.ts");
    const importLines = src
      .split(/\r?\n/)
      .filter((line) => line.includes("mergeRequirementsStateJson") && line.trimStart().startsWith("import"));
    expect(importLines).toHaveLength(1);
  });

  it("implementationExecutionUnitDispatchService does not import legacy dispatch", () => {
    const src = readPrototypeSource("implementationExecutionUnitDispatchService.ts");
    expect(src).not.toContain("dispatchQuickRunContinuationOnServer");
  });

  it("quickRunContinuationAfterGithubVerify does not import legacy dispatch", () => {
    const src = readPrototypeSource("quickRunContinuationAfterGithubVerify.ts");
    expect(src).not.toContain("dispatchQuickRunContinuationOnServer");
  });

  it("continue-quick-run default route uses dispatchNextExecutionUnitOnServer", () => {
    const src = readAppSource("api/prototype/implementation-runtime/continue-quick-run/route.ts");
    expect(src).toContain("dispatchNextExecutionUnitOnServer");
    expect(src).toContain('scheduler: "execution_unit"');
  });
});

describe("P3-M73 DEV-SCREEN-001 verified → SCREEN-002 dispatch", () => {
  it("resolveNextExecutableUnit selects U2 after U1 verified", () => {
    const state = buildScreenContinuationState();
    const units = state.implementationExecutionUnitsV1!.units;
    const selected = state.implementationExecutionUnitsV1!.selectedExecutionUnitIds!;
    const next = resolveNextExecutableUnit({ units, selectedUnitIds: selected });
    expect(next.status).toBe("next");
    if (next.status === "next") {
      expect(next.unit.unitId).toBe("U2");
      expect(next.unit.codeTaskId).toBe(SCREEN_2);
    }
  });
});

describe("P3-M73 dispatchNextExecutionUnitOnServer integration", () => {
  beforeEach(() => {
    projectFindUniqueMock.mockReset();
    executionSetupFindUniqueMock.mockReset();
    getBundleMock.mockReset();
    ensureDbHistoryMock.mockReset();
    dispatchCursorMock.mockReset();
    persistOrchestrationMock.mockReset();

    getBundleMock.mockResolvedValue({ runs: [], job: null, currentRun: null });
    ensureDbHistoryMock.mockResolvedValue({ ok: true });
    persistOrchestrationMock.mockResolvedValue(undefined);
  });

  it("returns execution_setup_not_ready with orchestrationPatch and promptTimeline", async () => {
    const state = buildScreenContinuationState();
    projectFindUniqueMock.mockResolvedValue({ requirementsStateJson: state });
    executionSetupFindUniqueMock.mockResolvedValue(null);

    const result = await dispatchNextExecutionUnitOnServer({
      projectId: PID,
      completedCodeTaskId: SCREEN_1,
      nowIso: NOW,
    });

    expect(result.outcome).toBe("execute_request_failed");
    expect(result.reason).toBe("execution_setup_not_ready");
    expect(result.orchestrationPatch).toBeDefined();
    expect(result.orchestrationPatch?.promptTimeline?.length).toBeGreaterThan(0);
    expect(result.orchestrationPatch?.codeTaskExecutionRunsV1?.length).toBeGreaterThan(0);
    expect(dispatchCursorMock).not.toHaveBeenCalled();
  });

  it("dispatches SCREEN-002 without quick_run_* timeline actions", async () => {
    const state = buildScreenContinuationState();
    projectFindUniqueMock.mockResolvedValue({ requirementsStateJson: state });
    executionSetupFindUniqueMock.mockResolvedValue(readyExecutionSetupRow());
    dispatchCursorMock.mockResolvedValue({
      ok: true,
      execution: { status: "cursor_running" },
      orchestrationPatch: {},
      timelineEntries: [
        {
          action: "implementation_execution_next_unit_dispatched",
          orchestrationTraceGroup: "implementation_orchestration",
          fields: { projectId: PID },
          createdAt: NOW,
        },
      ],
    });

    const result = await dispatchNextExecutionUnitOnServer({
      projectId: PID,
      completedCodeTaskId: SCREEN_1,
      nowIso: NOW,
    });

    expect(result.ok).toBe(true);
    expect(result.outcome).toBe("dispatched");
    expect(result.nextCodeTaskId).toBe(SCREEN_2);
    expect(dispatchCursorMock).toHaveBeenCalled();
    const actions = result.timelineEntries.map((e) => e.action);
    expect(actions).toContain("implementation_execution_next_unit_dispatched");
    expect(actions.some((a) => a.startsWith("quick_run_"))).toBe(false);
  });

  it("continues dispatch when DB runtime audit returns ok false", async () => {
    const state = buildScreenContinuationState();
    projectFindUniqueMock.mockResolvedValue({ requirementsStateJson: state });
    executionSetupFindUniqueMock.mockResolvedValue(readyExecutionSetupRow());
    ensureDbHistoryMock.mockResolvedValue({ ok: false, reason: "db_missing" });
    dispatchCursorMock.mockResolvedValue({
      ok: true,
      execution: { status: "cursor_running" },
      orchestrationPatch: {},
      timelineEntries: [],
    });

    const result = await dispatchNextExecutionUnitOnServer({
      projectId: PID,
      nowIso: NOW,
    });

    expect(result.ok).toBe(true);
    expect(result.outcome).toBe("dispatched");
    expect(dispatchCursorMock).toHaveBeenCalled();
    expect(
      result.timelineEntries.some(
        (e) =>
          e.action === "implementation_execution_unit_run_history_attached" &&
          e.responseText?.includes("db_run_audit_pending"),
      ),
    ).toBe(true);
  });
});
