import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateAgentExecutionRecordDesign } from "@/lib/agents/evaluateAgentExecutionRecordDesign";
import * as persistenceValidation from "@/lib/agents/agentRuntimePersistenceCandidateValidation";

describe("multi-agent agent execution record design stage 2-14", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("default target is execution_record", () => {
    const report = evaluateAgentExecutionRecordDesign();
    expect(report.target).toBe("execution_record");
  });

  it("execution_record returns ready_for_schema_design", () => {
    const report = evaluateAgentExecutionRecordDesign({ target: "execution_record" });
    expect(report.decision).toBe("ready_for_schema_design");
  });

  it("timeline_event_link returns defer", () => {
    const report = evaluateAgentExecutionRecordDesign({ target: "timeline_event_link" });
    expect(report.decision).toBe("defer");
  });

  it("audit_trail_link returns defer", () => {
    const report = evaluateAgentExecutionRecordDesign({ target: "audit_trail_link" });
    expect(report.decision).toBe("defer");
  });

  it("report mode is read_only_agent_execution_record_design", () => {
    const report = evaluateAgentExecutionRecordDesign();
    expect(report.mode).toBe("read_only_agent_execution_record_design");
  });

  it("requires schema change, migration, and rollback plan", () => {
    const report = evaluateAgentExecutionRecordDesign();
    expect(report.requiresSchemaChange).toBe(true);
    expect(report.requiresMigration).toBe(true);
    expect(report.requiresRollbackPlan).toBe(true);
  });

  it("execution_record requires audit and timeline links", () => {
    const report = evaluateAgentExecutionRecordDesign({ target: "execution_record" });
    expect(report.requiresAuditLink).toBe(true);
    expect(report.requiresTimelineLink).toBe(true);
  });

  it("persistFields includes agentId capabilityId executionStatus and summaries", () => {
    const report = evaluateAgentExecutionRecordDesign();
    const fields = new Set(report.persistFields.map((f) => f.field));
    expect(fields.has("agentId")).toBe(true);
    expect(fields.has("capabilityId")).toBe(true);
    expect(fields.has("executionStatus")).toBe(true);
    expect(fields.has("inputSummary")).toBe(true);
    expect(fields.has("outputSummary")).toBe(true);
    expect(fields.has("errorSummary")).toBe(true);
  });

  it("excludedFields marks raw prompt input output diff token apiKey as forbidden", () => {
    const report = evaluateAgentExecutionRecordDesign();
    const byField = new Map(report.excludedFields.map((f) => [f.field, f]));
    for (const field of ["rawPrompt", "fullInput", "fullOutput", "codeDiff", "token", "apiKey"]) {
      expect(byField.get(field)?.sensitivity).toBe("forbidden");
      expect(byField.get(field)?.persist).toBe(false);
    }
  });

  it("does not invoke persistence validation or storage helpers", () => {
    const validateSpy = vi.spyOn(
      persistenceValidation,
      "validateAgentRuntimePersistenceCandidate",
    );
    evaluateAgentExecutionRecordDesign();
    expect(validateSpy).not.toHaveBeenCalled();
  });
});
