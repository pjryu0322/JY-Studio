import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateAgentExecutionRecordWritePathDesign } from "@/lib/agents/evaluateAgentExecutionRecordWritePathDesign";
import * as schemaDecisionModule from "@/lib/agents/evaluateAgentExecutionRecordSchemaDecision";

function checklistItem(
  report: ReturnType<typeof evaluateAgentExecutionRecordWritePathDesign>,
  item: string,
) {
  return report.validationChecklist.find((c) => c.item === item);
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

  it("featureFlagName is JYO_AGENT_EXECUTION_RECORD_WRITE_PATH", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign();
    expect(report.featureFlagName).toBe("JYO_AGENT_EXECUTION_RECORD_WRITE_PATH");
  });

  it("featureFlagDefault is off", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign();
    expect(report.featureFlagDefault).toBe("off");
  });

  it("proposedWriteEntrypoints is non-empty", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign();
    expect(report.proposedWriteEntrypoints.length).toBeGreaterThan(0);
  });

  it("proposedSanitizers is non-empty", () => {
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

  it("validationChecklist has migration applied false", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign();
    expect(checklistItem(report, "migration applied")?.satisfied).toBe(false);
  });

  it("validationChecklist has DB write not implemented in this step true", () => {
    const report = evaluateAgentExecutionRecordWritePathDesign();
    expect(checklistItem(report, "DB write not implemented in this step")?.satisfied).toBe(true);
  });

  it("requiresSchemaApplied is true", () => {
    expect(evaluateAgentExecutionRecordWritePathDesign().requiresSchemaApplied).toBe(true);
  });

  it("requiresMigrationApplied is true", () => {
    expect(evaluateAgentExecutionRecordWritePathDesign().requiresMigrationApplied).toBe(true);
  });

  it("requiresFeatureFlag is true", () => {
    expect(evaluateAgentExecutionRecordWritePathDesign().requiresFeatureFlag).toBe(true);
  });

  it("requiresForbiddenFieldGuard is true", () => {
    expect(evaluateAgentExecutionRecordWritePathDesign().requiresForbiddenFieldGuard).toBe(true);
  });

  it("requiresWritePathRollback is true", () => {
    expect(evaluateAgentExecutionRecordWritePathDesign().requiresWritePathRollback).toBe(true);
  });

  it("requiresOperatorApproval is true", () => {
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

  it("uses schema decision only without Prisma DB or write path calls", () => {
    const schemaSpy = vi.spyOn(schemaDecisionModule, "evaluateAgentExecutionRecordSchemaDecision");
    evaluateAgentExecutionRecordWritePathDesign();
    expect(schemaSpy).toHaveBeenCalledTimes(1);
  });
});
