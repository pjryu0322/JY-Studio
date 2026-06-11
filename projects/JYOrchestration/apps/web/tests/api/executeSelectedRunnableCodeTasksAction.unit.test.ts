import { describe, expect, it } from "vitest";
import { buildImplementationRuntimeActionRequest } from "@/lib/prototype/implementationActionRunner";
import { resolveImplementationPrimaryAction } from "@/lib/prototype/implementationActionRoutingPolicy";

describe("execute_selected_runnable_codetasks action routing", () => {
  it("does not map integration primary to execute API", () => {
    const primary = resolveImplementationPrimaryAction({
      selectionSummary: {
        totalCount: 14,
        runnableCount: 0,
        selectedRunnableCount: 0,
        selectedRunnableCodeTaskIds: [],
        integrationReadyCount: 14,
        integrationReadyCodeTaskIds: ["CODE-DONE-1"],
      },
    });
    const runtime = buildImplementationRuntimeActionRequest({ resolution: primary });
    expect(runtime.apiAction).toBe("prepare_integration_preview");
    expect(runtime.apiAction).not.toBe("execute_selected_runnable_codetasks");
  });
});
