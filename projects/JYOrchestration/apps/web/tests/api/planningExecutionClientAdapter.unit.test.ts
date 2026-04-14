import { describe, expect, it, vi } from "vitest";
import { runPlanningOriginatedExecution } from "../../src/lib/jy-orchestration/planning-execution";
import { demoPlanningOriginatedExecutionResponse } from "../../src/components/planningExecution/planningExecutionDemoSamples";

const FORBIDDEN = ["bundle", "handoff", "ExecutionPreparationBundle", "screens", "tasks", "context"] as const;

function assertNoForbiddenJsonKeys(json: string): void {
  for (const k of FORBIDDEN) {
    expect(json).not.toContain(`"${k}"`);
  }
}

describe("planning execution client adapter", () => {
  it("returns validation_error without calling fetch for missing fields", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const r = await runPlanningOriginatedExecution({
      projectId: "",
      inputText: "",
      mode: "PREPARE_ONLY",
    });
    expect(r.status).toBe("validation_error");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("maps a normalized API response to a screen view-model", async () => {
    const response = demoPlanningOriginatedExecutionResponse("READY_FOR_EXECUTION");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(response), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    const r = await runPlanningOriginatedExecution({
      projectId: "p1",
      inputText: "hello",
      mode: "PREPARE_ONLY",
    });
    expect(r.status).toBe("success");
    if (r.status === "success") {
      expect(r.response.status).toBe("READY_FOR_EXECUTION");
      expect(r.screen.responseStatus).toBe("READY_FOR_EXECUTION");
      expect(r.screen.visibleSections).toContain("ACTION_BAR");
      assertNoForbiddenJsonKeys(JSON.stringify(r.screen));
    }
    fetchMock.mockRestore();
  });

  it("EXECUTION_STARTED response yields refresh action in screen", async () => {
    const response = demoPlanningOriginatedExecutionResponse("EXECUTION_STARTED");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(response), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    const r = await runPlanningOriginatedExecution({
      projectId: "p1",
      inputText: "hello",
      mode: "PREPARE_ONLY",
    });
    expect(r.status).toBe("success");
    if (r.status === "success") {
      expect(r.screen.viewModel.actions.availableActions).toContain("REFRESH_STATUS");
    }
    fetchMock.mockRestore();
  });

  it("transport error yields transport_error state", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("ECONNRESET"));
    const r = await runPlanningOriginatedExecution({
      projectId: "p1",
      inputText: "hello",
      mode: "PREPARE_ONLY",
    });
    expect(r.status).toBe("transport_error");
    fetchMock.mockRestore();
  });
});

