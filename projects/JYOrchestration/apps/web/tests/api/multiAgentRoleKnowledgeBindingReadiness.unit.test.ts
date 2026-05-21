import { describe, expect, it } from "vitest";
import {
  evaluateRoleKnowledgeBindingReadiness,
  listDefaultKnowledgePackIds,
  normalizeAvailableKnowledgePackIds,
} from "@/lib/agents/evaluateRoleKnowledgeBindingReadiness";
import {
  getDefaultRoleKnowledgeBindingsForAgent,
  listDefaultRoleKnowledgeBindings,
} from "@/lib/agents/defaultRoleKnowledgeBindings";
import { MULTI_AGENT_ORCHESTRATION_MVP_BASELINE } from "@/lib/agents/multiAgentOrchestrationMvpBaseline";

function developerReadyReport() {
  return evaluateRoleKnowledgeBindingReadiness({
    agentType: "developer",
    availableKnowledgePackIds: requiredPackIdsForAgent("developer"),
  });
}

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

  describe("boundary and MVP baseline hardening", () => {
    it("stage5CandidateFoundationOnly is true", () => {
      expect(developerReadyReport().stage5CandidateFoundationOnly).toBe(true);
    });

    it("stage5AIsKnowledgePackImplementation is false", () => {
      expect(developerReadyReport().stage5AIsKnowledgePackImplementation).toBe(false);
    });

    it("readsRoleKnowledgeBindingRegistryInThisStep is true", () => {
      expect(developerReadyReport().readsRoleKnowledgeBindingRegistryInThisStep).toBe(true);
    });

    it("writesRoleKnowledgeBindingRegistryInThisStep is false", () => {
      expect(developerReadyReport().writesRoleKnowledgeBindingRegistryInThisStep).toBe(false);
    });

    it("modifiesKnowledgePackRegistryInThisStep is false", () => {
      expect(developerReadyReport().modifiesKnowledgePackRegistryInThisStep).toBe(false);
    });

    it("createsKnowledgePackInThisStep is false", () => {
      expect(developerReadyReport().createsKnowledgePackInThisStep).toBe(false);
    });

    it("updatesKnowledgePackInThisStep is false", () => {
      expect(developerReadyReport().updatesKnowledgePackInThisStep).toBe(false);
    });

    it("versionsKnowledgePackInThisStep is false", () => {
      expect(developerReadyReport().versionsKnowledgePackInThisStep).toBe(false);
    });

    it("uploadsSourceDocumentInThisStep is false", () => {
      expect(developerReadyReport().uploadsSourceDocumentInThisStep).toBe(false);
    });

    it("indexesKnowledgePackInThisStep is false", () => {
      expect(developerReadyReport().indexesKnowledgePackInThisStep).toBe(false);
    });

    it("embedsKnowledgePackInThisStep is false", () => {
      expect(developerReadyReport().embedsKnowledgePackInThisStep).toBe(false);
    });

    it("retrievesKnowledgeWithRagInThisStep is false", () => {
      expect(developerReadyReport().retrievesKnowledgeWithRagInThisStep).toBe(false);
    });

    it("injectsKnowledgeIntoPromptInThisStep is false", () => {
      expect(developerReadyReport().injectsKnowledgeIntoPromptInThisStep).toBe(false);
    });

    it("modifiesRuntimeExecutionInThisStep is false", () => {
      expect(developerReadyReport().modifiesRuntimeExecutionInThisStep).toBe(false);
    });

    it("modifiesDbInThisStep is false", () => {
      expect(developerReadyReport().modifiesDbInThisStep).toBe(false);
    });

    it("modifiesUiInThisStep is false", () => {
      expect(developerReadyReport().modifiesUiInThisStep).toBe(false);
    });

    it("mvpBaselineBindingRole equals role_to_knowledge_pack_id_readiness_only", () => {
      expect(developerReadyReport().mvpBaselineBindingRole).toBe("role_to_knowledge_pack_id_readiness_only");
    });

    it("findings include stage5_a_foundation_only", () => {
      expect(developerReadyReport().findings.some((f) => f.code === "stage5_a_foundation_only")).toBe(true);
    });

    it("findings include stage5_a_not_knowledge_pack_implementation", () => {
      expect(
        developerReadyReport().findings.some((f) => f.code === "stage5_a_not_knowledge_pack_implementation"),
      ).toBe(true);
    });

    it("findings include mvp_role_knowledge_binding_baseline_preserved", () => {
      expect(
        developerReadyReport().findings.some((f) => f.code === "mvp_role_knowledge_binding_baseline_preserved"),
      ).toBe(true);
    });

    it("MVP baseline preserved capability includes role_knowledge_binding_readiness", () => {
      expect(MULTI_AGENT_ORCHESTRATION_MVP_BASELINE.preservedCapabilities).toContain(
        "role_knowledge_binding_readiness",
      );
    });
  });

  describe("input hygiene and baseline regression guard", () => {
    const developerRequired = requiredPackIdsForAgent("developer");
    const governancePackId = "kp.platform.governance-policy.default";

    it("trims availableKnowledgePackIds before matching required bindings", () => {
      const report = evaluateRoleKnowledgeBindingReadiness({
        agentType: "developer",
        availableKnowledgePackIds: developerRequired.map((id) => `  ${id}  `),
      });
      expect(report.decision).toBe("knowledge_binding_ready");
      expect(report.normalizedAvailableKnowledgePackIds).toEqual([...developerRequired].sort());
    });

    it("removes blank availableKnowledgePackIds and reports count", () => {
      const report = evaluateRoleKnowledgeBindingReadiness({
        agentType: "developer",
        availableKnowledgePackIds: ["", "   ", ...developerRequired],
      });
      expect(report.blankAvailableKnowledgePackIdsRemovedCount).toBe(2);
      expect(report.normalizedAvailableKnowledgePackIdCount).toBe(developerRequired.length);
    });

    it("dedupes availableKnowledgePackIds and reports duplicates", () => {
      const duplicateId = developerRequired[0];
      const report = evaluateRoleKnowledgeBindingReadiness({
        agentType: "developer",
        availableKnowledgePackIds: [duplicateId, duplicateId, ...developerRequired.slice(1)],
      });
      expect(report.duplicateAvailableKnowledgePackIdsRemoved).toEqual([duplicateId]);
    });

    it("sorts normalizedAvailableKnowledgePackIds deterministically", () => {
      const shuffled = [...developerRequired].reverse();
      const report = evaluateRoleKnowledgeBindingReadiness({
        agentType: "developer",
        availableKnowledgePackIds: shuffled,
      });
      expect(report.normalizedAvailableKnowledgePackIds).toEqual([...developerRequired].sort());
      expect(normalizeAvailableKnowledgePackIds(shuffled).normalizedIds).toEqual(report.normalizedAvailableKnowledgePackIds);
    });

    it("reports unknownAvailableKnowledgePackIds without blocking ready when required bindings are satisfied", () => {
      const report = evaluateRoleKnowledgeBindingReadiness({
        agentType: "developer",
        availableKnowledgePackIds: [...developerRequired, "kp.platform.unknown-pack.test"],
      });
      expect(report.decision).toBe("knowledge_binding_ready");
      expect(report.unknownAvailableKnowledgePackIds).toEqual(["kp.platform.unknown-pack.test"]);
    });

    it("unknownAvailableKnowledgePackIds causes warning finding", () => {
      expect(
        evaluateRoleKnowledgeBindingReadiness({
          agentType: "developer",
          availableKnowledgePackIds: [...developerRequired, "kp.platform.unknown-pack.test"],
        }).findings.some((f) => f.code === "unknown_available_knowledge_pack_id_reported"),
      ).toBe(true);
    });

    it("missingOptionalBindingIds is included in report", () => {
      const report = evaluateRoleKnowledgeBindingReadiness({
        agentType: "developer",
        availableKnowledgePackIds: developerRequired,
      });
      expect(report.missingOptionalBindingIds).toEqual([governancePackId]);
    });

    it("optionalBindingCount and satisfiedOptionalBindingCount are calculated", () => {
      const report = evaluateRoleKnowledgeBindingReadiness({
        agentType: "developer",
        availableKnowledgePackIds: [...developerRequired, governancePackId],
      });
      expect(report.optionalBindingCount).toBe(1);
      expect(report.satisfiedOptionalBindingCount).toBe(1);
      expect(report.missingOptionalBindingIds).toEqual([]);
    });

    it("sourceDefaultKnowledgePackIds includes all default registry IDs", () => {
      const registryIds = [...listDefaultKnowledgePackIds()].sort();
      expect(developerReadyReport().sourceDefaultKnowledgePackIds).toEqual(registryIds);
    });

    it("sourceDefaultKnowledgePackIdCount equals sourceDefaultKnowledgePackIds.length", () => {
      const report = developerReadyReport();
      expect(report.sourceDefaultKnowledgePackIdCount).toBe(report.sourceDefaultKnowledgePackIds.length);
    });

    it("inputHygieneChecklist includes available knowledge pack ids normalized", () => {
      expect(
        developerReadyReport().inputHygieneChecklist.some(
          (item) => item.item === "available knowledge pack ids normalized",
        ),
      ).toBe(true);
    });

    it("inputHygieneChecklist includes unknown available knowledge pack ids reported", () => {
      const report = evaluateRoleKnowledgeBindingReadiness({
        agentType: "developer",
        availableKnowledgePackIds: [...developerRequired, "kp.platform.unknown-pack.test"],
      });
      const item = report.inputHygieneChecklist.find(
        (entry) => entry.item === "unknown available knowledge pack ids reported",
      );
      expect(item?.satisfied).toBe(false);
    });

    it("available_knowledge_pack_ids_normalized finding is present", () => {
      expect(
        developerReadyReport().findings.some((f) => f.code === "available_knowledge_pack_ids_normalized"),
      ).toBe(true);
    });

    it("duplicate_available_knowledge_pack_id_removed finding is present when duplicate exists", () => {
      const duplicateId = developerRequired[0];
      expect(
        evaluateRoleKnowledgeBindingReadiness({
          agentType: "developer",
          availableKnowledgePackIds: [duplicateId, duplicateId, ...developerRequired.slice(1)],
        }).findings.some((f) => f.code === "duplicate_available_knowledge_pack_id_removed"),
      ).toBe(true);
    });

    it("blank_available_knowledge_pack_id_removed finding is present when blank exists", () => {
      expect(
        evaluateRoleKnowledgeBindingReadiness({
          agentType: "developer",
          availableKnowledgePackIds: ["", ...developerRequired],
        }).findings.some((f) => f.code === "blank_available_knowledge_pack_id_removed"),
      ).toBe(true);
    });

    it("unknown_available_knowledge_pack_id_reported finding is present when unknown exists", () => {
      expect(
        evaluateRoleKnowledgeBindingReadiness({
          agentType: "developer",
          availableKnowledgePackIds: [...developerRequired, "kp.platform.unknown-pack.test"],
        }).findings.some((f) => f.code === "unknown_available_knowledge_pack_id_reported"),
      ).toBe(true);
    });

    it("missing required binding still defers", () => {
      expect(
        evaluateRoleKnowledgeBindingReadiness({
          agentType: "developer",
          availableKnowledgePackIds: [],
        }).decision,
      ).toBe("defer");
    });

    it("unknown agentType still blocks", () => {
      expect(evaluateRoleKnowledgeBindingReadiness({ agentType: "unknown_role" }).decision).toBe("blocked");
    });

    it("Stage 5-A no-run/boundary flags remain unchanged", () => {
      const report = developerReadyReport();
      expect(report.usesRagInThisStep).toBe(false);
      expect(report.modifiesRuntimeExecutionInThisStep).toBe(false);
      expect(report.modifiesDbInThisStep).toBe(false);
      expect(report.modifiesUiInThisStep).toBe(false);
      expect(report.stage5CandidateFoundationOnly).toBe(true);
    });

    it("Stage 5-A is still not knowledge pack implementation", () => {
      expect(developerReadyReport().stage5AIsKnowledgePackImplementation).toBe(false);
    });
  });

  describe("closure source field regression guard", () => {
    it("exposes missingOptionalBindingIds for closure aggregation", () => {
      const report = evaluateRoleKnowledgeBindingReadiness({
        agentType: "developer",
        availableKnowledgePackIds: requiredPackIdsForAgent("developer"),
      });
      expect(report.missingOptionalBindingIds).toEqual(["kp.platform.governance-policy.default"]);
    });

    it("exposes sourceDefaultKnowledgePackIds for closure trace", () => {
      const report = evaluateRoleKnowledgeBindingReadiness({ agentType: "planner" });
      expect(report.sourceDefaultKnowledgePackIds.length).toBeGreaterThan(0);
      expect(report.sourceDefaultKnowledgePackIdCount).toBe(report.sourceDefaultKnowledgePackIds.length);
    });

    it("exposes unknownAvailableKnowledgePackIds for closure hygiene trace", () => {
      const report = evaluateRoleKnowledgeBindingReadiness({
        agentType: "developer",
        availableKnowledgePackIds: [...requiredPackIdsForAgent("developer"), "kp.platform.unknown-pack.test"],
      });
      expect(report.unknownAvailableKnowledgePackIds).toContain("kp.platform.unknown-pack.test");
    });
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
