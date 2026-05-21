import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateAgentExecutionRecordWritePathDesign } from "@/lib/agents/evaluateAgentExecutionRecordWritePathDesign";
import * as schemaDecisionModule from "@/lib/agents/evaluateAgentExecutionRecordSchemaDecision";

function checklistItem(
  report: ReturnType<typeof evaluateAgentExecutionRecordWritePathDesign>,
  item: string,
) {
  return report.validationChecklist.find((c) => c.item === item);
}

function arrayHasNoDuplicates(values: readonly string[]): boolean {
  const keys = values.map((v) => v.trim().toLowerCase());
  return new Set(keys).size === keys.length;
}

describe("multi-agent agent execution record write path design stage 2-20", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("default target is agent_execution_record", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign();
    expect(report.target).toBe("agent_execution_record");
  });

  it("mode is read_only_agent_execution_record_write_path_design", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign();
    expect(report.mode).toBe("read_only_agent_execution_record_write_path_design");
  });

  it("default target returns defer decision", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign();
    expect(report.decision).toBe("defer");
  });

  it("defer includes schema/migration not applied findings", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign();
    expect(report.findings.some((f) => f.code === "schema_not_applied")).toBe(true);
    expect(report.findings.some((f) => f.code === "migration_not_applied")).toBe(true);
    expect(report.findings.some((f) => f.code === "write_path_deferred_until_schema_applied")).toBe(
      true,
    );
  });

  it("report includes sourceSchemaDecision and sourceSchemaTarget", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign();
    expect(report.sourceSchemaDecision).toBe("ready_for_schema_proposal");
    expect(report.sourceSchemaTarget).toBe("agent_execution_record");
  });

  it("report includes sourceProposedTableName", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign();
    expect(report.sourceProposedTableName).toBe("AgentExecutionRecord");
  });

  it("report includes sourceRequiresPrismaSchemaChange and sourceRequiresMigration", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign();
    expect(report.sourceRequiresPrismaSchemaChange).toBe(true);
    expect(report.sourceRequiresMigration).toBe(true);
  });

  it("featureFlagName is JYO_AGENT_EXECUTION_RECORD_WRITE_PATH for active target", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign();
    expect(report.featureFlagName).toBe("JYO_AGENT_EXECUTION_RECORD_WRITE_PATH");
  });

  it("featureFlagDefault is off", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign();
    expect(report.featureFlagDefault).toBe("off");
  });

  it("proposedWriteEntrypoints is non-empty for active target", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign();
    expect(report.proposedWriteEntrypoints.length).toBeGreaterThan(0);
  });

  it("proposedSanitizers is non-empty for active target", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign();
    expect(report.proposedSanitizers.length).toBeGreaterThan(0);
  });

  it("forbiddenFieldGuards include rejectRawPrompt rejectFullInput rejectFullOutput rejectTokenSecrets", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign();
    const guards = new Set(report.forbiddenFieldGuards);
    expect(guards.has("rejectRawPrompt")).toBe(true);
    expect(guards.has("rejectFullInput")).toBe(true);
    expect(guards.has("rejectFullOutput")).toBe(true);
    expect(guards.has("rejectTokenSecrets")).toBe(true);
  });

  it("proposed arrays have no duplicates", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign();
    expect(arrayHasNoDuplicates(report.proposedWriteEntrypoints)).toBe(true);
    expect(arrayHasNoDuplicates(report.proposedSanitizers)).toBe(true);
    expect(arrayHasNoDuplicates(report.forbiddenFieldGuards)).toBe(true);
    expect(arrayHasNoDuplicates(report.rollbackPlan)).toBe(true);
  });

  it("validationChecklist has schema applied false", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign();
    expect(checklistItem(report, "schema applied")?.satisfied).toBe(false);
  });

  it("validationChecklist has migration applied false", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign();
    expect(checklistItem(report, "migration applied")?.satisfied).toBe(false);
  });

  it("validationChecklist has write adapter implemented false", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign();
    expect(checklistItem(report, "write adapter implemented")?.satisfied).toBe(false);
  });

  it("validationChecklist has DB write not implemented in this step true", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign();
    expect(checklistItem(report, "DB write not implemented in this step")?.satisfied).toBe(true);
  });

  it("requiresSchemaApplied is true for defer target", () => {
    expect(evaluateAgentExecutionRecordWritePathDesign().requiresSchemaApplied).toBe(true);
  });

  it("requiresMigrationApplied is true for defer target", () => {
    expect(evaluateAgentExecutionRecordWritePathDesign().requiresMigrationApplied).toBe(true);
  });

  it("requiresFeatureFlag is true for defer target", () => {
    expect(evaluateAgentExecutionRecordWritePathDesign().requiresFeatureFlag).toBe(true);
  });

  it("requiresForbiddenFieldGuard is true for defer target", () => {
    expect(evaluateAgentExecutionRecordWritePathDesign().requiresForbiddenFieldGuard).toBe(true);
  });

  it("requiresWritePathRollback is true for defer target", () => {
    expect(evaluateAgentExecutionRecordWritePathDesign().requiresWritePathRollback).toBe(true);
  });

  it("requiresOperatorApproval is true for defer target", () => {
    expect(evaluateAgentExecutionRecordWritePathDesign().requiresOperatorApproval).toBe(true);
  });

  it("timeline_event_link returns defer", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign({ target: "timeline_event_link" });
    expect(report.decision).toBe("defer");
    expect(report.findings.some((f) => f.code === "timeline_link_write_deferred")).toBe(true);
  });

  it("audit_trail_link returns defer", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign({ target: "audit_trail_link" });
    expect(report.decision).toBe("defer");
    expect(report.findings.some((f) => f.code === "audit_link_write_deferred")).toBe(true);
  });

  it("unknown target returns blocked", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign({ target: "invalid" });
    expect(report.decision).toBe("blocked");
    expect(report.target).toBe("unknown");
    expect(report.findings.some((f) => f.code === "unknown_write_path_target")).toBe(true);
  });

  it("unknown target returns empty featureFlagName", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign({ target: "invalid" });
    expect(report.featureFlagName).toBe("");
    expect(report.findings.some((f) => f.code === "write_path_target_unknown_no_feature_flag")).toBe(
      true,
    );
  });

  it("unknown target returns empty proposed arrays and rollbackPlan", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign({ target: "bad" });
    expect(report.proposedWriteEntrypoints).toEqual([]);
    expect(report.proposedSanitizers).toEqual([]);
    expect(report.forbiddenFieldGuards).toEqual([]);
    expect(report.rollbackPlan).toEqual([]);
  });

  it("unknown target has requiresFeatureFlag false", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign({ target: "invalid" });
    expect(report.requiresFeatureFlag).toBe(false);
  });

  it("unknown target has requiresOperatorApproval false", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign({ target: "invalid" });
    expect(report.requiresOperatorApproval).toBe(false);
  });

  it("unknown target keeps source schema trace", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign({ target: "invalid" });
    expect(report.sourceSchemaTarget).toBe("unknown");
    expect(report.sourceSchemaDecision).toBe("blocked");
  });

  it("uses schema decision only without Prisma DB or write path calls", () => {
    const schemaSpy = vi.spyOn(schemaDecisionModule, "evaluateAgentExecutionRecordSchemaDecision");
    evaluateAgentExecutionRecordWritePathDesign();
    expect(schemaSpy).toHaveBeenCalledTimes(1);
  });
});
