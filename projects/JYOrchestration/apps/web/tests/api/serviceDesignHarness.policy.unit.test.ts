import { describe, expect, it } from "vitest";
import { buildHarnessResponsePolicy, applyHarnessDefaultsToTurnModel, labelAi } from "../../src/lib/service-design/serviceDesignResponsePolicy";
import { detectIntent } from "../../src/lib/service-design/serviceDesignIntentRouter";
import { resolveMentionRouting } from "../../src/lib/service-design/serviceDesignMentionRouter";
import { validateStep } from "../../src/lib/service-design/serviceDesignStepValidator";
import { runHarness } from "../../src/lib/service-design/serviceDesignHarnessRuntime";

describe("buildHarnessResponsePolicy", () => {
  it("maps known AI ids to Korean labels", () => {
    expect(labelAi("planner")).toBe("AI 기획자");
    expect(labelAi("analyst")).toBe("AI 분석가");
    expect(labelAi("feature_designer")).toBe("AI 기능설계자");
    expect(labelAi("unknown_custom")).toBe("unknown_custom");
  });

  it("uses STAGE_CONTROLLED when mentioned AI differs from stage primary and no advisory", async () => {
    const intent = detectIntent("일반 질문입니다");
    const routing = resolveMentionRouting({
      stage: "ideation",
      mentionedAI: "analyst",
      intent,
    });
    expect(routing.visibleResponder).toBe("analyst");
    expect(routing.finalAuthority).toBe("planner");
    const policy = buildHarnessResponsePolicy({
      intent,
      routing,
      validation: "ALLOW",
    });
    expect(policy.responseMode).toBe("STAGE_CONTROLLED");
    expect(policy.responderLabel).toBe("AI 분석가");
    expect(policy.finalAuthorityLabel).toBe("AI 기획자");
  });

  it("uses ADVISORY_SUMMARY when security intent adds security_reviewer", () => {
    const intent = detectIntent("보안 취약점이 걱정됩니다");
    expect(intent).toBe("SECURITY");
    const routing = resolveMentionRouting({
      stage: "ideation",
      mentionedAI: null,
      intent,
    });
    expect(routing.internalAdvisors).toContain("security_reviewer");
    const policy = buildHarnessResponsePolicy({
      intent,
      routing,
      validation: "ALLOW",
    });
    expect(policy.responseMode).toBe("ADVISORY_SUMMARY");
    expect(policy.advisorLabels).toContain("AI 보안관");
  });

  it("uses BLOCKED when validation is FORWARD_BLOCK", () => {
    const intent = detectIntent("프로토타입");
    const routing = resolveMentionRouting({ stage: "ideation", mentionedAI: null, intent });
    const validation = validateStep("프로토타입 만들자", "ideation");
    expect(validation).toBe("FORWARD_BLOCK");
    const policy = buildHarnessResponsePolicy({ intent, routing, validation });
    expect(policy.responseMode).toBe("BLOCKED");
  });
});

describe("runHarness + applyHarnessDefaultsToTurnModel", () => {
  it("runHarness returns responsePolicy alongside routing", async () => {
    const h = await runHarness({ input: "hello", stage: "ideation", mentionedAI: null });
    expect(h.responsePolicy.responseContract).toContain("[하네스 응답 계약]");
    expect(h.responsePolicy.responderLabel).toBeTruthy();
  });

  it("fills omitted LLM harness fields from policy (backward compatible)", async () => {
    const harness = await runHarness({ input: "보안 점검", stage: "service-flow", mentionedAI: null });
    const merged = applyHarnessDefaultsToTurnModel({ assistantMessage: "ok" }, harness);
    expect(merged.responderLabel).toBe(harness.responsePolicy.responderLabel);
    expect(merged.advisorSummary).toMatch(/관점|내부 자문/);
    expect(merged.finalAuthoritySummary).toContain("최종 판단");
    expect(merged.harnessPayload.intent).toBe(harness.intent);
    expect(merged.harnessPayload.responseMode).toBe(harness.responsePolicy.responseMode);
  });
});
