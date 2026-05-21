import { describe, expect, it } from "vitest";
import {
  buildStage6AModelBaselineConfirmedInput,
  buildStage6AReadyBaselineInput,
  DEFAULT_RUNTIME_EXECUTION_UNIT_KINDS,
  evaluateRuntimeExecutionModelBaseline,
  REQUIRED_STAGE6_A_MODEL_BASELINE_CONFIRMATIONS,
  resolveRuntimeExecutionModelBaselineDecision,
  STAGE6_A_SEPARATED_WORK_ITEMS,
} from "@/lib/agents/evaluateRuntimeExecutionModelBaseline";
import { buildStage5ReadyChainInput } from "@/lib/agents/stage5KnowledgeFoundationInput";

function evaluateReadyBaseline(input: Parameters<typeof evaluateRuntimeExecutionModelBaseline>[0] = {}) {
  return evaluateRuntimeExecutionModelBaseline({ ...buildStage6AReadyBaselineInput(), ...input });
}

describe("multi-agent runtime execution model baseline stage 6-A", () => {
  it("default input without confirmations defers", () => {
    expect(evaluateRuntimeExecutionModelBaseline().decision).toBe("defer");
  });

  it("buildStage6AReadyBaselineInput yields ready_for_execution_model_candidate", () => {
    expect(evaluateReadyBaseline().decision).toBe("ready_for_execution_model_candidate");
  });

  it("Stage 5 closure blocked propagates blocked", () => {
    expect(
      evaluateRuntimeExecutionModelBaseline({
        stage5Closure: { stage5AClosure: { agentTypes: ["unknown_role"] } },
        ...buildStage6AModelBaselineConfirmedInput(),
      }).decision,
    ).toBe("blocked");
  });

  it("Stage 5 closure defer propagates defer", () => {
    expect(
      evaluateRuntimeExecutionModelBaseline({
        stage5Closure: buildStage5ReadyChainInput(),
        stage6ModelReviewConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("reflects stage6EntryMode design_candidate_only from Stage 5-F", () => {
    expect(evaluateReadyBaseline().sourceStage6EntryMode).toBe("design_candidate_only");
    expect(evaluateReadyBaseline().sourceStage6EntryCandidate).toBe("runtime_execution_model_design");
  });

  it("actualRuntimeExecutionAllowedInThisStep is false", () => {
    expect(evaluateReadyBaseline().actualRuntimeExecutionAllowedInThisStep).toBe(false);
  });

  it("actualCursorExecutionAllowedInThisStep is false", () => {
    expect(evaluateReadyBaseline().actualCursorExecutionAllowedInThisStep).toBe(false);
  });

  it("actualGithubOperationAllowedInThisStep is false", () => {
    expect(evaluateReadyBaseline().actualGithubOperationAllowedInThisStep).toBe(false);
  });

  it("actualDbWriteAllowedInThisStep is false", () => {
    expect(evaluateReadyBaseline().actualDbWriteAllowedInThisStep).toBe(false);
  });

  it("executionUnitKinds includes default 6 kinds", () => {
    expect(evaluateReadyBaseline().executionUnitKinds).toEqual([...DEFAULT_RUNTIME_EXECUTION_UNIT_KINDS]);
  });

  it("separatedWorkItems includes actual_runtime_execution_api", () => {
    expect(evaluateReadyBaseline().separatedWorkItems).toContain("actual_runtime_execution_api");
    expect(STAGE6_A_SEPARATED_WORK_ITEMS).toContain("actual_execution_runner");
  });

  it("missing confirmation yields defer", () => {
    expect(
      evaluateRuntimeExecutionModelBaseline({
        stage5Closure: buildStage5ReadyChainInput(),
        ...buildStage6AModelBaselineConfirmedInput(),
        stage6NoFeatureFlagWireConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("unknown execution unit kind yields blocked", () => {
    expect(
      evaluateRuntimeExecutionModelBaseline({
        ...buildStage6AReadyBaselineInput(),
        requestedExecutionUnitKinds: ["unknown_execution_unit"],
      }).decision,
    ).toBe("blocked");
  });

  it("findings include runtime_execution_model_design_only", () => {
    expect(
      evaluateReadyBaseline().findings.some((f) => f.code === "runtime_execution_model_design_only"),
    ).toBe(true);
  });

  it("findings include actual_execution_disallowed", () => {
    expect(evaluateReadyBaseline().findings.some((f) => f.code === "actual_execution_disallowed")).toBe(true);
  });

  it("REQUIRED_STAGE6_A_MODEL_BASELINE_CONFIRMATIONS has length 5", () => {
    expect(REQUIRED_STAGE6_A_MODEL_BASELINE_CONFIRMATIONS).toHaveLength(5);
  });

  it("executionModelDesignOnly is true", () => {
    expect(evaluateReadyBaseline().executionModelDesignOnly).toBe(true);
  });

  it("resolveRuntimeExecutionModelBaselineDecision blocks unknown units", () => {
    expect(
      resolveRuntimeExecutionModelBaselineDecision({
        sourceStage5Decision: "stage5_knowledge_foundation_ready",
        sourceStage6EntryMode: "design_candidate_only",
        sourceStage6ActualRuntimeExecutionAllowed: false,
        confirmationsSatisfied: true,
        hasUnknownExecutionUnitKind: true,
      }),
    ).toBe("blocked");
  });
});
