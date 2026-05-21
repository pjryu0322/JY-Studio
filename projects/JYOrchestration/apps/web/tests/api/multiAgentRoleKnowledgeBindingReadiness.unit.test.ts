import { describe, expect, it } from "vitest";
import {
  evaluateRoleKnowledgeBindingReadiness,
  listDefaultKnowledgePackIds,
} from "@/lib/agents/evaluateRoleKnowledgeBindingReadiness";
import {
  getDefaultRoleKnowledgeBindingsForAgent,
  listDefaultRoleKnowledgeBindings,
} from "@/lib/agents/defaultRoleKnowledgeBindings";

function requiredPackIdsForAgent(agentType: string): string[] {
  return getDefaultRoleKnowledgeBindingsForAgent(agentType)
    .filter((b) => b.required)
    .map((b) => b.knowledgePackId);
}

describe("multi-agent role knowledge binding readiness stage 5-A", () => {
  it("mode is read_only_role_knowledge_binding_readiness", () => {
    expect(
      evaluateRoleKnowledgeBindingReadiness({ agentType: "developer", availableKnowledgePackIds: [] }).mode,
    ).toBe("read_only_role_knowledge_binding_readiness");
  });

  it("missing agentType yields blocked", () => {
    const report = evaluateRoleKnowledgeBindingReadiness({});
    expect(report.decision).toBe("blocked");
    expect(report.findings.some((f) => f.code === "agent_type_missing")).toBe(true);
  });

  it("unknown agentType yields blocked", () => {
    const report = evaluateRoleKnowledgeBindingReadiness({ agentType: "unknown_role" });
    expect(report.decision).toBe("blocked");
    expect(report.findings.some((f) => f.code === "role_knowledge_binding_agent_unknown")).toBe(true);
  });

  it("developer has development_standard binding", () => {
    const kinds = getDefaultRoleKnowledgeBindingsForAgent("developer").map((b) => b.knowledgePackKind);
    expect(kinds).toContain("development_standard");
  });

  it("developer has cursor_execution_policy binding", () => {
    const kinds = getDefaultRoleKnowledgeBindingsForAgent("developer").map((b) => b.knowledgePackKind);
    expect(kinds).toContain("cursor_execution_policy");
  });

  it("security has security_standard binding", () => {
    const kinds = getDefaultRoleKnowledgeBindingsForAgent("security").map((b) => b.knowledgePackKind);
    expect(kinds).toContain("security_standard");
  });

  it("reviewer has review_standard binding", () => {
    const kinds = getDefaultRoleKnowledgeBindingsForAgent("reviewer").map((b) => b.knowledgePackKind);
    expect(kinds).toContain("review_standard");
  });

  it("required pack missing yields defer", () => {
    const report = evaluateRoleKnowledgeBindingReadiness({
      agentType: "developer",
      availableKnowledgePackIds: [],
      allowMissingOptionalBindings: false,
    });
    expect(report.decision).toBe("defer");
    expect(report.missingRequiredBindingIds.length).toBeGreaterThan(0);
    expect(report.findings.some((f) => f.code === "required_knowledge_pack_missing")).toBe(true);
  });

  it("all required packs available yields knowledge_binding_ready", () => {
    const report = evaluateRoleKnowledgeBindingReadiness({
      agentType: "developer",
      taskType: "implement_feature",
      availableKnowledgePackIds: requiredPackIdsForAgent("developer"),
    });
    expect(report.decision).toBe("knowledge_binding_ready");
    expect(report.findings.some((f) => f.code === "role_knowledge_binding_ready")).toBe(true);
  });

  it("optional missing with allowMissingOptionalBindings true is not blocked", () => {
    const report = evaluateRoleKnowledgeBindingReadiness({
      agentType: "developer",
      availableKnowledgePackIds: requiredPackIdsForAgent("developer"),
      allowMissingOptionalBindings: true,
    });
    expect(report.decision).toBe("knowledge_binding_ready");
    expect(report.decision).not.toBe("blocked");
  });

  it("optional missing with allowMissingOptionalBindings false yields defer", () => {
    const report = evaluateRoleKnowledgeBindingReadiness({
      agentType: "developer",
      availableKnowledgePackIds: requiredPackIdsForAgent("developer"),
      allowMissingOptionalBindings: false,
    });
    expect(report.decision).toBe("defer");
    expect(report.findings.some((f) => f.code === "optional_knowledge_pack_missing")).toBe(true);
  });

  it("no-run flags are all false", () => {
    const report = evaluateRoleKnowledgeBindingReadiness({
      agentType: "planner",
      availableKnowledgePackIds: requiredPackIdsForAgent("planner"),
    });
    expect(report.usesRagInThisStep).toBe(false);
    expect(report.writesKnowledgePackInThisStep).toBe(false);
    expect(report.modifiesPromptInjectionInThisStep).toBe(false);
    expect(report.modifiesRuntimeExecutionInThisStep).toBe(false);
    expect(report.modifiesDbInThisStep).toBe(false);
  });

  it("findings include rag_not_used_in_stage_5_a", () => {
    expect(
      evaluateRoleKnowledgeBindingReadiness({ agentType: "developer" }).findings.some(
        (f) => f.code === "rag_not_used_in_stage_5_a",
      ),
    ).toBe(true);
  });

  it("findings include prompt_injection_not_modified_in_stage_5_a", () => {
    expect(
      evaluateRoleKnowledgeBindingReadiness({ agentType: "developer" }).findings.some(
        (f) => f.code === "prompt_injection_not_modified_in_stage_5_a",
      ),
    ).toBe(true);
  });

  it("findings state stage5_a is candidate foundation only not full knowledge pack implementation", () => {
    expect(
      evaluateRoleKnowledgeBindingReadiness({ agentType: "developer" }).findings.some(
        (f) => f.code === "stage5_a_candidate_foundation_only",
      ),
    ).toBe(true);
  });

  it("findings exclude runtime wire and db schema migration scope", () => {
    const codes = evaluateRoleKnowledgeBindingReadiness({ agentType: "developer" }).findings.map((f) => f.code);
    expect(codes).toContain("runtime_wire_not_modified_in_stage_5_a");
    expect(codes).toContain("db_schema_migration_not_modified_in_stage_5_a");
    expect(codes).toContain("knowledge_pack_ui_not_implemented_in_stage_5_a");
  });

  it("selectedBindings are deterministic", () => {
    const input = {
      agentType: "architect",
      taskType: "design_system",
      availableKnowledgePackIds: requiredPackIdsForAgent("architect"),
    };
    const first = evaluateRoleKnowledgeBindingReadiness(input);
    const second = evaluateRoleKnowledgeBindingReadiness(input);
    expect(first.selectedBindings).toEqual(second.selectedBindings);
    expect(first.selectedBindings).toEqual(getDefaultRoleKnowledgeBindingsForAgent("architect"));
    expect(listDefaultRoleKnowledgeBindings().length).toBeGreaterThan(0);
    expect(listDefaultKnowledgePackIds().length).toBeGreaterThan(0);
  });
});
