import { describe, expect, it } from "vitest";
import { CANONICAL_SAMPLE_DATA_CODE_TASK_ID } from "@/lib/prototype/codeTaskCanonicalId";
import { resolveImplementationPrimaryAction } from "@/lib/prototype/implementationActionRoutingPolicy";
import { buildImplementationRuntimeActionRequest } from "@/lib/prototype/implementationActionRunner";
import {
  INTEGRATION_BLOCKED_BY_RUNNABLE_USER_MESSAGE,
  INTEGRATION_NO_COMPLETED_TARGETS_USER_MESSAGE,
} from "@/lib/prototype/implementationBoardIntegrationGate";
import { INTEGRATION_STRICT_GATE_INCOMPLETE_USER_MESSAGE } from "@/lib/prototype/implementationIntegrationGate";

const sampleId = CANONICAL_SAMPLE_DATA_CODE_TASK_ID;

function selectionSummary(input: {
  readonly totalCount?: number;
  readonly runnableCount?: number;
  readonly selectedRunnableCount?: number;
  readonly selectedRunnableCodeTaskIds?: readonly string[];
  readonly integrationReadyCount?: number;
  readonly integrationReadyCodeTaskIds?: readonly string[];
}) {
  return {
    totalCount: input.totalCount ?? 15,
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

  it("returns prepare_integration enabled when all executable tasks are integration-ready", () => {
    const ids = ["A", "B"];
    const resolved = resolveImplementationPrimaryAction({
      selectionSummary: selectionSummary({
        totalCount: 2,
        runnableCount: 0,
        integrationReadyCount: 2,
        integrationReadyCodeTaskIds: ids,
      }),
    });
    expect(resolved.action).toBe("prepare_integration_preview");
    expect(resolved.enabled).toBe(true);
    expect(resolved.codeTaskIds).toEqual(ids);
  });

  it("returns prepare_integration disabled when runnable tasks remain", () => {
    const resolved = resolveImplementationPrimaryAction({
      selectionSummary: selectionSummary({
        runnableCount: 1,
        selectedRunnableCount: 0,
        integrationReadyCount: 14,
        integrationReadyCodeTaskIds: ["CT-1"],
      }),
    });
    expect(resolved.action).toBe("prepare_integration_preview");
    expect(resolved.enabled).toBe(false);
    expect(resolved.disabledReason).toBe(INTEGRATION_BLOCKED_BY_RUNNABLE_USER_MESSAGE);
  });

  it("returns prepare_integration disabled when integration-ready count is partial", () => {
    const resolved = resolveImplementationPrimaryAction({
      selectionSummary: selectionSummary({
        totalCount: 3,
        runnableCount: 0,
        integrationReadyCount: 2,
        integrationReadyCodeTaskIds: ["A", "B"],
      }),
    });
    expect(resolved.enabled).toBe(false);
    expect(resolved.disabledReason).toBe(INTEGRATION_STRICT_GATE_INCOMPLETE_USER_MESSAGE);
  });

  it("returns prepare_integration disabled when no integration-ready tasks", () => {
    const resolved = resolveImplementationPrimaryAction({
      selectionSummary: selectionSummary({
        runnableCount: 0,
        integrationReadyCount: 0,
        integrationReadyCodeTaskIds: [],
      }),
    });
    expect(resolved.enabled).toBe(false);
    expect(resolved.disabledReason).toBe(INTEGRATION_NO_COMPLETED_TARGETS_USER_MESSAGE);
  });

  it("returns open_preview when preview is ready with url", () => {
    const resolved = resolveImplementationPrimaryAction({
      selectionSummary: selectionSummary({
        runnableCount: 0,
        integrationReadyCount: 2,
        integrationReadyCodeTaskIds: ["A", "B"],
      }),
      previewReady: true,
      actualPreviewUrl: "https://preview.example/app",
    });
    expect(resolved.action).toBe("open_preview");
    expect(resolved.enabled).toBe(true);
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
