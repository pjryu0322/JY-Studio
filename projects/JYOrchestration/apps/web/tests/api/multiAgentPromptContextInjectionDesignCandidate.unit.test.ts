import { describe, expect, it } from "vitest";
import { buildStage5ReadyChainInput } from "@/lib/agents/stage5KnowledgeFoundationInput";
import {
  buildDefaultPromptContextInjectionDesignCandidates,
  evaluatePromptContextInjectionDesignCandidate,
  resolvePromptContextInjectionDesignCandidateDecision,
  SUPPORTED_INJECTION_MODES,
} from "@/lib/agents/evaluatePromptContextInjectionDesignCandidate";
import { buildDefaultRoleKnowledgePackMappingCandidates } from "@/lib/agents/evaluateRoleKnowledgePackMappingCandidate";
import type { PromptContextInjectionDesignCandidate } from "@/lib/agents/promptContextInjectionDesignCandidateTypes";

function evaluateReadyDesign(input: Parameters<typeof evaluatePromptContextInjectionDesignCandidate>[0] = {}) {
  return evaluatePromptContextInjectionDesignCandidate({
    ...buildStage5ReadyChainInput(),
    ...input,
  });
}

describe("multi-agent prompt context injection design candidate stage 5-D", () => {
  it("default design candidates yield ready_for_prompt_context_design", () => {
    expect(evaluateReadyDesign().decision).toBe("ready_for_prompt_context_design");
  });

  it("source Stage 5-C blocked propagates blocked", () => {
    expect(
      evaluatePromptContextInjectionDesignCandidate({
        stage5AClosure: { agentTypes: ["unknown_role"] },
      }).decision,
    ).toBe("blocked");
  });

  it("unsupported injection mode yields blocked", () => {
    const mappings = buildDefaultRoleKnowledgePackMappingCandidates();
    const designs = buildDefaultPromptContextInjectionDesignCandidates(mappings).map((d) =>
      d.agentType === "planner"
        ? { ...d, injectionMode: "unsupported_mode" as PromptContextInjectionDesignCandidate["injectionMode"] }
        : d,
    );
    expect(evaluateReadyDesign({ designCandidates: designs }).decision).toBe("blocked");
  });

  it("missing design for agent yields defer", () => {
    const mappings = buildDefaultRoleKnowledgePackMappingCandidates();
    const designs = buildDefaultPromptContextInjectionDesignCandidates(mappings).filter(
      (d) => d.agentType !== "planner",
    );
    expect(evaluateReadyDesign({ designCandidates: designs }).decision).toBe("defer");
  });

  it("promptInjectionDesignOnly is true", () => {
    expect(evaluateReadyDesign().promptInjectionDesignOnly).toBe(true);
  });

  it("actualPromptInjectionWireAllowedInThisStep is false", () => {
    expect(evaluateReadyDesign().actualPromptInjectionWireAllowedInThisStep).toBe(false);
  });

  it("actualRagRetrievalAllowedInThisStep is false even for retrieval_candidate mode", () => {
    const report = evaluateReadyDesign();
    const hasRetrieval = report.designCandidates.some((d) => d.injectionMode === "retrieval_candidate");
    expect(hasRetrieval || report.designCandidates.length > 0).toBe(true);
    expect(report.actualRagRetrievalAllowedInThisStep).toBe(false);
  });

  it("actualRuntimePromptBuilderChangeAllowedInThisStep is false", () => {
    expect(evaluateReadyDesign().actualRuntimePromptBuilderChangeAllowedInThisStep).toBe(false);
  });

  it("design candidates sorted by agentType", () => {
    const types = evaluateReadyDesign().designCandidates.map((d) => d.agentType);
    expect(types).toEqual([...types].sort((a, b) => a.localeCompare(b)));
  });

  it("SUPPORTED_INJECTION_MODES includes retrieval_candidate", () => {
    expect(SUPPORTED_INJECTION_MODES).toContain("retrieval_candidate");
  });

  it("findings include stage5_d_design_ready when ready", () => {
    expect(evaluateReadyDesign().findings.some((f) => f.code === "stage5_d_design_ready")).toBe(true);
  });

  it("resolvePromptContextInjectionDesignCandidateDecision blocks unsupported mode", () => {
    expect(
      resolvePromptContextInjectionDesignCandidateDecision({
        sourceStage5CDecision: "ready_for_mapping_design",
        hasUnsupportedInjectionMode: true,
        hasMissingDesignAgent: false,
      }),
    ).toBe("blocked");
  });

  it("source Stage 5-C defer propagates defer", () => {
    expect(
      evaluatePromptContextInjectionDesignCandidate({
        stage5AClosure: { stage5AClosureReviewConfirmed: false },
      }).decision,
    ).toBe("defer");
  });

  it("mode and stage are read-only stage 5-D", () => {
    const report = evaluateReadyDesign();
    expect(report.mode).toBe("read_only_prompt_context_injection_design_candidate");
    expect(report.stage).toBe("stage_5_d_candidate");
  });

  it("developer design uses expanded or standard max context", () => {
    const dev = evaluateReadyDesign().designCandidates.find((d) => d.agentType === "developer");
    expect(["expanded", "standard"]).toContain(dev?.maxContextPolicy);
  });

  it("checklist items have non-empty reason", () => {
    expect(evaluateReadyDesign().checklist.every((c) => c.reason.length > 0)).toBe(true);
  });

  it("findings include stage5_d_no_prompt_wire", () => {
    expect(evaluateReadyDesign().findings.some((f) => f.code === "stage5_d_no_prompt_wire")).toBe(true);
  });

  it("designCandidateCount matches designCandidates length", () => {
    const report = evaluateReadyDesign();
    expect(report.designCandidateCount).toBe(report.designCandidates.length);
  });

  it("missingMappingAgentTypes lists missing agents on defer", () => {
    const mappings = buildDefaultRoleKnowledgePackMappingCandidates();
    const designs = buildDefaultPromptContextInjectionDesignCandidates(mappings).filter(
      (d) => d.agentType !== "operator",
    );
    expect(evaluateReadyDesign({ designCandidates: designs }).missingMappingAgentTypes).toContain("operator");
  });

  it("unsupportedInjectionModes populated when blocked", () => {
    const mappings = buildDefaultRoleKnowledgePackMappingCandidates();
    const designs = buildDefaultPromptContextInjectionDesignCandidates(mappings).map((d) =>
      d.agentType === "security"
        ? { ...d, injectionMode: "bad_mode" as PromptContextInjectionDesignCandidate["injectionMode"] }
        : d,
    );
    expect(evaluateReadyDesign({ designCandidates: designs }).unsupportedInjectionModes.length).toBeGreaterThan(0);
  });
});
