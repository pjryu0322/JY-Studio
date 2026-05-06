import { describe, expect, it } from "vitest";
import { buildServiceDesignHarnessPayload } from "@/lib/service-design/serviceDesignTurnPayload";

describe("buildServiceDesignHarnessPayload", () => {
  it("preserves stage", () => {
    expect(buildServiceDesignHarnessPayload("ideation", "hello").serviceDesignStage).toBe("ideation");
    expect(buildServiceDesignHarnessPayload("service-flow", "x").serviceDesignStage).toBe("service-flow");
    expect(buildServiceDesignHarnessPayload("feature-planning", "y").serviceDesignStage).toBe("feature-planning");
  });

  it("extracts @@AI분석가 as mentionedAI", () => {
    const p = buildServiceDesignHarnessPayload("ideation", "안녕 @@AI분석가 도와줘");
    expect(p.mentionedAI).toBe("AI분석가");
  });

  it("returns null mentionedAI when no mention", () => {
    expect(buildServiceDesignHarnessPayload("ideation", "no mention here").mentionedAI).toBeNull();
  });

  it("accepts feature-planning stage", () => {
    const p = buildServiceDesignHarnessPayload("feature-planning", "@@planner");
    expect(p.serviceDesignStage).toBe("feature-planning");
    expect(p.mentionedAI).toBe("planner");
  });
});
