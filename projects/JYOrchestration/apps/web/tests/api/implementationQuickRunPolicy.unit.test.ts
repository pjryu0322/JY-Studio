import { describe, expect, it } from "vitest";
import { CANONICAL_SAMPLE_DATA_CODE_TASK_ID } from "@/lib/prototype/codeTaskCanonicalId";
import { resolveQuickRunToolbarAction } from "@/lib/prototype/implementationQuickRunPolicy";

const sampleId = CANONICAL_SAMPLE_DATA_CODE_TASK_ID;

function summary(input: {
  readonly runnableCount?: number;
  readonly selectedRunnableCount?: number;
  readonly selectedRunnableCodeTaskIds?: readonly string[];
  readonly integrationReadyCount?: number;
  readonly integrationReadyCodeTaskIds?: readonly string[];
}) {
  return {
    totalCount: 15,
    runnableCount: input.runnableCount ?? 0,
    selectedCount: input.selectedRunnableCount ?? 0,
    selectedRunnableCount: input.selectedRunnableCount ?? 0,
    selectedRunnableCodeTaskIds: input.selectedRunnableCodeTaskIds ?? [],
    integrationReadyCount: input.integrationReadyCount ?? 0,
    integrationReadyCodeTaskIds: input.integrationReadyCodeTaskIds ?? [],
    incompleteCount: 0,
  };
}

describe("resolveQuickRunToolbarAction (P3-08G)", () => {
  it("executes when selectedRunnableCodeTaskIds is non-empty", () => {
    const resolved = resolveQuickRunToolbarAction({
      summary: summary({
        runnableCount: 1,
        selectedRunnableCount: 1,
        selectedRunnableCodeTaskIds: [sampleId],
        integrationReadyCount: 14,
      }),
    });
    expect(resolved.action).toBe("execute_selected_runnable_codetasks");
    if (resolved.action === "execute_selected_runnable_codetasks") {
      expect(resolved.codeTaskIds).toEqual([sampleId]);
    }
  });

  it("prepares integration when runnable remain but nothing runnable selected", () => {
    const resolved = resolveQuickRunToolbarAction({
      summary: summary({ runnableCount: 1, selectedRunnableCount: 0, integrationReadyCount: 14 }),
    });
    expect(resolved.action).toBe("prepare_integration_preview");
  });

  it("does not block when selectedRunnableCount > 0", () => {
    const resolved = resolveQuickRunToolbarAction({
      summary: summary({
        runnableCount: 1,
        selectedRunnableCount: 1,
        selectedRunnableCodeTaskIds: [sampleId],
      }),
    });
    expect(resolved.action).not.toBe("blocked_no_selection");
  });

  it("prepares integration when runnableCount > 0 and none selected", () => {
    const resolved = resolveQuickRunToolbarAction({
      summary: summary({ runnableCount: 1, selectedRunnableCount: 0, integrationReadyCount: 14 }),
    });
    expect(resolved.action).toBe("prepare_integration_preview");
  });

  it("prepares integration when no runnable and integration ready tasks exist", () => {
    const doneIds = ["A", "B"];
    const resolved = resolveQuickRunToolbarAction({
      summary: summary({
        runnableCount: 0,
        integrationReadyCount: 2,
        integrationReadyCodeTaskIds: doneIds,
      }),
    });
    expect(resolved.action).toBe("prepare_integration_preview");
    if (resolved.action === "prepare_integration_preview") {
      expect(resolved.codeTaskIds).toEqual(doneIds);
    }
  });
});
