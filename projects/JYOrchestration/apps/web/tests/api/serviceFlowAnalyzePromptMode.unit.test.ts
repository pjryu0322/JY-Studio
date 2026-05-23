import { describe, expect, it } from "vitest";
import { resolveServiceFlowAnalyzePromptMode } from "@/lib/requirements/serviceFlowAnalyzePromptMode";

describe("serviceFlowAnalyzePromptMode", () => {
  it("prioritizes actor_definition prompt over advice mode", () => {
    expect(
      resolveServiceFlowAnalyzePromptMode({
        adviceToFlowApplyMode: false,
        adviceMode: true,
        serviceFlowSubIntent: "actor_definition",
      }),
    ).toBe("actor_definition");
  });

  it("uses flow_draft prompt mode for flow_draft subIntent", () => {
    expect(
      resolveServiceFlowAnalyzePromptMode({
        adviceToFlowApplyMode: false,
        adviceMode: false,
        serviceFlowSubIntent: "flow_draft",
      }),
    ).toBe("flow_draft");
  });

  it("prioritizes flow_step_definition over advice mode", () => {
    expect(
      resolveServiceFlowAnalyzePromptMode({
        adviceToFlowApplyMode: false,
        adviceMode: true,
        serviceFlowSubIntent: "flow_step_definition",
      }),
    ).toBe("flow_step_definition");
  });

  it("keeps advice_to_flow_apply as highest priority", () => {
    expect(
      resolveServiceFlowAnalyzePromptMode({
        adviceToFlowApplyMode: true,
        adviceMode: true,
        serviceFlowSubIntent: "actor_definition",
      }),
    ).toBe("advice_to_flow_apply");
  });

  it("uses advice when no structural subIntent", () => {
    expect(
      resolveServiceFlowAnalyzePromptMode({
        adviceToFlowApplyMode: false,
        adviceMode: true,
        serviceFlowSubIntent: "general_service_flow",
      }),
    ).toBe("advice");
  });
});
