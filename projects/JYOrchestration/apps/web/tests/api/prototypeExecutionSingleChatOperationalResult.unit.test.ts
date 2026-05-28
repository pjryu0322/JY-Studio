import { describe, expect, it } from "vitest";
import {
  classifyPrototypeExecutionOperationalResult,
  shouldStopAfterOperationalResult,
} from "@/components/preview/prototypeExecutionOperationalResultHandlers";

describe("classifyPrototypeExecutionOperationalResult", () => {
  it("classifies stage_action_run", () => {
    const result = classifyPrototypeExecutionOperationalResult({
      kind: "stage_action_run",
      run: {
        runId: "run-1",
        projectId: "p1",
        actionId: "SHOW_ARTIFACTS",
        source: "cta",
        status: "succeeded",
        startedAt: "now",
        timelineEntries: [],
      },
    });
    expect(result.kind).toBe("stage_action_run");
    if (result.kind === "stage_action_run") {
      expect(result.run.runId).toBe("run-1");
    }
  });

  it("classifies handled and continue", () => {
    expect(classifyPrototypeExecutionOperationalResult("handled")).toEqual({ kind: "handled" });
    expect(classifyPrototypeExecutionOperationalResult("continue")).toEqual({ kind: "continue" });
  });
});

describe("shouldStopAfterOperationalResult", () => {
  it("stops on stage_action_run and handled", () => {
    expect(shouldStopAfterOperationalResult("handled")).toBe(true);
    expect(
      shouldStopAfterOperationalResult({
        kind: "stage_action_run",
        run: {
          runId: "run-1",
          projectId: "p1",
          actionId: "SHOW_ARTIFACTS",
          source: "cta",
          status: "succeeded",
          startedAt: "now",
          timelineEntries: [],
        },
      }),
    ).toBe(true);
  });

  it("does not stop on continue", () => {
    expect(shouldStopAfterOperationalResult("continue")).toBe(false);
  });
});

