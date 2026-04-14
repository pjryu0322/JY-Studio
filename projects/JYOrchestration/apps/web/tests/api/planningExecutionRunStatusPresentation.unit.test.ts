import { describe, expect, it } from "vitest";
import { buildPlanningExecutionRunStatusPresentation } from "../../src/components/planningExecution/planningExecutionRunStatusPresentation";

describe("buildPlanningExecutionRunStatusPresentation", () => {
  it("RUNNING summary", () => {
    const p = buildPlanningExecutionRunStatusPresentation({
      run: {
        runId: "r1",
        status: "RUNNING",
        currentStep: "1:START",
        totalSteps: 10,
        progressPercent: 10,
        lastMessage: "ok",
        canRetry: false,
        canInspect: true,
      },
    });
    expect(p.summaryLine).toContain("진행");
    expect(p.statusLabel).toBe("실행 중");
  });

  it("COMPLETED summary", () => {
    const p = buildPlanningExecutionRunStatusPresentation({
      run: {
        runId: "r1",
        status: "COMPLETED",
        currentStep: null,
        totalSteps: 10,
        progressPercent: 100,
        lastMessage: null,
        canRetry: false,
        canInspect: true,
      },
    });
    expect(p.summaryLine).toContain("완료");
    expect(p.tone).toBe("success");
  });

  it("FAILED summary", () => {
    const p = buildPlanningExecutionRunStatusPresentation({
      run: {
        runId: "r1",
        status: "FAILED",
        currentStep: "9:FAIL",
        totalSteps: 10,
        progressPercent: 80,
        lastMessage: "boom",
        canRetry: true,
        canInspect: true,
      },
    });
    expect(p.summaryLine).toContain("오류");
    expect(p.tone).toBe("danger");
  });
});

