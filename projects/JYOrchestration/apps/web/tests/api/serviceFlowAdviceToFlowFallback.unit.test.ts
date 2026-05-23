import { describe, expect, it } from "vitest";
import {
  ADVICE_TO_FLOW_QUALITY_FAILURE_CODE,
  ADVICE_TO_FLOW_QUALITY_USER_MESSAGE,
  buildAdviceToFlowQualityFailure,
  serviceFlowRegenerationTracePrefix,
  shouldUseProposalFallbackSynthesis,
} from "@/lib/requirements/serviceFlowAdviceApplyMode";

describe("serviceFlowAdviceToFlowFallback", () => {
  it("uses advice-to-flow trace prefix for advice_to_flow_apply mode", () => {
    expect(
      serviceFlowRegenerationTracePrefix({
        adviceMode: false,
        adviceToFlowApplyMode: true,
      }),
    ).toBe("service_flow_advice_to_flow");
  });

  it("uses advice trace prefix for advice mode", () => {
    expect(
      serviceFlowRegenerationTracePrefix({
        adviceMode: true,
        adviceToFlowApplyMode: false,
      }),
    ).toBe("service_flow_advice");
  });

  it("uses proposal trace prefix for normal proposal mode", () => {
    expect(
      serviceFlowRegenerationTracePrefix({
        adviceMode: false,
        adviceToFlowApplyMode: false,
      }),
    ).toBe("service_flow_proposal");
  });

  it("does not use proposal fallback synthesis in advice_to_flow_apply mode", () => {
    expect(
      shouldUseProposalFallbackSynthesis({
        adviceMode: false,
        adviceToFlowApplyMode: true,
      }),
    ).toBe(false);
  });

  it("does not use proposal fallback synthesis in advice mode", () => {
    expect(
      shouldUseProposalFallbackSynthesis({
        adviceMode: true,
        adviceToFlowApplyMode: false,
      }),
    ).toBe(false);
  });

  it("uses proposal fallback synthesis only for normal proposal mode", () => {
    expect(
      shouldUseProposalFallbackSynthesis({
        adviceMode: false,
        adviceToFlowApplyMode: false,
      }),
    ).toBe(true);
  });

  it("exposes advice-to-flow quality failure code and user message", () => {
    expect(ADVICE_TO_FLOW_QUALITY_FAILURE_CODE).toBe("ADVICE_TO_FLOW_QUALITY");
    expect(ADVICE_TO_FLOW_QUALITY_USER_MESSAGE).toMatch(/액터와 단계/);
  });

  it("builds advice-to-flow quality failure result for API layer", () => {
    const result = buildAdviceToFlowQualityFailure("trace");
    expect(result.ok).toBe(false);
    expect(result.code).toBe("ADVICE_TO_FLOW_QUALITY");
    expect(result.message).toBe(ADVICE_TO_FLOW_QUALITY_USER_MESSAGE);
    expect(result.promptText).toBe("trace");
  });
});
