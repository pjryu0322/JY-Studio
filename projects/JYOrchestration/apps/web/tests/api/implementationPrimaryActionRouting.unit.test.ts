import { describe, expect, it } from "vitest";
import { CANONICAL_SAMPLE_DATA_CODE_TASK_ID } from "@/lib/prototype/codeTaskCanonicalId";
import { resolveImplementationPrimaryAction } from "@/lib/prototype/implementationActionRoutingPolicy";
import { buildImplementationRuntimeActionRequest } from "@/lib/prototype/implementationActionRunner";

const sampleId = CANONICAL_SAMPLE_DATA_CODE_TASK_ID;

function selectionSummary(input: {
  readonly runnableCount?: number;
  readonly selectedRunnableCount?: number;
  readonly selectedRunnableCodeTaskIds?: readonly string[];
  readonly integrationReadyCount?: number;
  readonly integrationReadyCodeTaskIds?: readonly string[];
}) {
  return {
    totalCount: 15,
    runnableCount: input.runnableCount ?? 0,
    selectedRunnableCount: input.selectedRunnableCount ?? 0,
    selectedRunnableCodeTaskIds: input.selectedRunnableCodeTaskIds ?? [],
    integrationReadyCount: input.integrationReadyCount ?? 0,
    integrationReadyCodeTaskIds: input.integrationReadyCodeTaskIds ?? [],
  };
}

describe("resolveImplementationPrimaryAction (P3-09)", () => {
  it("returns execute when selectedRunnableCodeTaskIds is non-empty", () => {
    const resolved = resolveImplementationPrimaryAction({
      selectionSummary: selectionSummary({
        runnableCount: 1,
        selectedRunnableCount: 1,
        selectedRunnableCodeTaskIds: [sampleId],
        integrationReadyCount: 14,
      }),
    });
    expect(resolved.action).toBe("execute_selected_runnable_codetasks");
    expect(resolved.codeTaskIds).toEqual([sampleId]);
    expect(resolved.enabled).toBe(true);
  });

  it("returns blocked_no_selection when runnable remain but none selected", () => {
    const resolved = resolveImplementationPrimaryAction({
      selectionSummary: selectionSummary({
        runnableCount: 1,
        selectedRunnableCount: 0,
        integrationReadyCount: 14,
      }),
    });
    expect(resolved.action).toBe("blocked_no_selection");
    expect(resolved.disabledReason).toContain("선택");
  });

  it("returns prepare_integration when no runnable and integration ready", () => {
    const ids = ["A", "B"];
    const resolved = resolveImplementationPrimaryAction({
      selectionSummary: selectionSummary({
        runnableCount: 0,
        integrationReadyCount: 2,
        integrationReadyCodeTaskIds: ids,
      }),
    });
    expect(resolved.action).toBe("prepare_integration_preview");
    expect(resolved.codeTaskIds).toEqual(ids);
  });

  it("does not return prepare_integration when runnableCount > 0", () => {
    const resolved = resolveImplementationPrimaryAction({
      selectionSummary: selectionSummary({
        runnableCount: 1,
        selectedRunnableCount: 0,
        integrationReadyCount: 14,
      }),
    });
    expect(resolved.action).not.toBe("prepare_integration_preview");
  });

  it("maps execute to runtime API action with ids", () => {
    const primary = resolveImplementationPrimaryAction({
      selectionSummary: selectionSummary({
        runnableCount: 1,
        selectedRunnableCount: 1,
        selectedRunnableCodeTaskIds: [sampleId],
      }),
    });
    const runtime = buildImplementationRuntimeActionRequest({ resolution: primary });
    expect(runtime.apiAction).toBe("execute_selected_runnable_codetasks");
    expect(runtime.selectedCodeTaskIds).toEqual([sampleId]);
  });

  it("rejects empty execute ids at runtime request builder", () => {
    const runtime = buildImplementationRuntimeActionRequest({
      resolution: {
        action: "execute_selected_runnable_codetasks",
        label: "",
        enabled: true,
        codeTaskIds: [],
        disabledReason: null,
      },
    });
    expect(runtime.apiAction).toBeNull();
    expect(runtime.blockedMessage).toBeTruthy();
  });
});
