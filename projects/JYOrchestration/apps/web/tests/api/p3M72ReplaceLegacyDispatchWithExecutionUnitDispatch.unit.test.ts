import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { dispatchExecutionUnitWithCursor } from "@/lib/prototype/implementationExecutionUnitCursorDispatchService";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

const __dirname = dirname(fileURLToPath(import.meta.url));
const prototypeDir = join(__dirname, "../../src/lib/prototype");
const appDir = join(__dirname, "../../src/app");

function readSource(relativePath: string): string {
  return readFileSync(relativePath, "utf8");
}

function unit(overrides?: Partial<ImplementationExecutionUnitV1>): ImplementationExecutionUnitV1 {
  return {
    unitId: "U1",
    codeTaskId: "CT-A",
    processTaskId: "DEV-A",
    title: "A",
    order: 0,
    branchGroup: "screen",
    baseBranch: "main",
    workBranch: "wip/a",
    dependencies: [],
    status: "ready",
    ...overrides,
  };
}

const minimalContext = {
  targetRepository: { repoFullName: "org/repo", defaultBranch: "main" },
  baseBranch: "main",
  workspaceRoot: "/workspace",
  allowedPathGlobs: ["**/*"],
  cursorApiUrl: "https://cursor.example",
} as const;

describe("P3-M72 legacy dispatch removal", () => {
  it("implementationExecutionUnitDispatchService does not import legacy dispatch", () => {
    const src = readSource(join(prototypeDir, "implementationExecutionUnitDispatchService.ts"));
    expect(src).not.toContain("dispatchQuickRunContinuationOnServer");
    expect(src).toContain("dispatchExecutionUnitWithCursor");
  });

  it("quickRunContinuationAfterGithubVerify does not import legacy dispatch", () => {
    const src = readSource(join(prototypeDir, "quickRunContinuationAfterGithubVerify.ts"));
    expect(src).not.toContain("dispatchQuickRunContinuationOnServer");
    expect(src).not.toContain("advance.nextDispatch");
  });

  it("continue-quick-run default path uses dispatchNextExecutionUnitOnServer", () => {
    const src = readSource(
      join(appDir, "api/prototype/implementation-runtime/continue-quick-run/route.ts"),
    );
    expect(src).toContain("dispatchNextExecutionUnitOnServer");
    expect(src).not.toContain("continueSelectedCodeTaskQueueAfterAutoGate");
    expect(src).toContain('scheduler: "execution_unit"');
  });

  it("legacy dispatch service is marked deprecated", () => {
    const src = readSource(join(prototypeDir, "implementationQuickRunContinuationDispatchService.ts"));
    expect(src).toContain("@deprecated legacy_runtime_deprecated");
  });
});

describe("P3-M72 dispatchExecutionUnitWithCursor tuple gate", () => {
  it("blocks when processTaskId or workBranch is empty", async () => {
    const state: RequirementsStateJson = {};
    const result = await dispatchExecutionUnitWithCursor({
      projectId: "p1",
      unit: unit({ processTaskId: "", workBranch: "" }),
      requirementsState: state,
      codeTaskPlan: null,
      taskList: null,
      cursorWorkItems: [],
      executionContext: minimalContext as never,
      cursorApiToken: "token",
      runId: "run-1",
      triggerKey: "t1",
      nowIso: "2026-06-03T12:00:00.000Z",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("missing_process_task_id");
    }
  });
});
