import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateAgentExecutionRecordSchemaDecision } from "@/lib/agents/evaluateAgentExecutionRecordSchemaDecision";
import * as executionRecordDesign from "@/lib/agents/evaluateAgentExecutionRecordDesign";

describe("multi-agent agent execution record schema decision stage 2-17", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("default target is agent_execution_record", () => {
    const report = evaluateAgentExecutionRecordSchemaDecision();
    expect(report.target).toBe("agent_execution_record");
  });

  it("agent_execution_record returns ready_for_schema_proposal", () => {
    const report = evaluateAgentExecutionRecordSchemaDecision({
      target: "agent_execution_record",
    });
    expect(report.decision).toBe("ready_for_schema_proposal");
  });

  it("proposedTableName is AgentExecutionRecord", () => {
    const report = evaluateAgentExecutionRecordSchemaDecision();
    expect(report.proposedTableName).toBe("AgentExecutionRecord");
  });

  it("requiresPrismaSchemaChange is true", () => {
    const report = evaluateAgentExecutionRecordSchemaDecision();
    expect(report.requiresPrismaSchemaChange).toBe(true);
  });

  it("requiresMigration is true", () => {
    const report = evaluateAgentExecutionRecordSchemaDecision();
    expect(report.requiresMigration).toBe(true);
  });

  it("requiresRollbackPlan is true", () => {
    const report = evaluateAgentExecutionRecordSchemaDecision();
    expect(report.requiresRollbackPlan).toBe(true);
  });

  it("requiresRetentionPolicy is true", () => {
    const report = evaluateAgentExecutionRecordSchemaDecision();
    expect(report.requiresRetentionPolicy).toBe(true);
  });

  it("requiresAccessControlReview is true", () => {
    const report = evaluateAgentExecutionRecordSchemaDecision();
    expect(report.requiresAccessControlReview).toBe(true);
  });

  it("fieldProposals includes agentId capabilityId executionStatus and summaries", () => {
    const report = evaluateAgentExecutionRecordSchemaDecision();
    const fields = new Set(report.fieldProposals.map((f) => f.field));
    expect(fields.has("agentId")).toBe(true);
    expect(fields.has("capabilityId")).toBe(true);
    expect(fields.has("executionStatus")).toBe(true);
    expect(fields.has("inputSummary")).toBe(true);
    expect(fields.has("outputSummary")).toBe(true);
    expect(fields.has("errorSummary")).toBe(true);
  });

  it("indexes projectId runId agentId capabilityId executionStatus createdAt", () => {
    const report = evaluateAgentExecutionRecordSchemaDecision();
    const byField = new Map(report.fieldProposals.map((f) => [f.field, f]));
    for (const field of ["projectId", "runId", "agentId", "capabilityId", "executionStatus", "createdAt"]) {
      expect(byField.get(field)?.indexed).toBe(true);
    }
  });

  it("excludedFields marks rawPrompt fullInput fullOutput codeDiff token apiKey stackTraceRaw as forbidden", () => {
    const report = evaluateAgentExecutionRecordSchemaDecision();
    const byField = new Map(report.excludedFields.map((f) => [f.field, f]));
    for (const field of ["rawPrompt", "fullInput", "fullOutput", "codeDiff", "token", "apiKey", "stackTraceRaw"]) {
      expect(byField.get(field)?.sensitivity).toBe("forbidden");
    }
  });

  it("summary field reasons include summary meaning", () => {
    const report = evaluateAgentExecutionRecordSchemaDecision();
    const byField = new Map(report.fieldProposals.map((f) => [f.field, f]));
    for (const field of ["inputSummary", "outputSummary", "errorSummary", "connectorSummary", "governanceSummary"]) {
      expect(byField.get(field)?.reason.toLowerCase()).toMatch(/summary/);
    }
  });

  it("excludedFields use Forbidden type and are not indexed", () => {
    const report = evaluateAgentExecutionRecordSchemaDecision();
    for (const field of report.excludedFields) {
      expect(field.type).toBe("Forbidden");
      expect(field.indexed).toBe(false);
    }
  });

  it("includes forbidden_field_policy_enforced when required forbidden fields are present", () => {
    const report = evaluateAgentExecutionRecordSchemaDecision();
    expect(report.findings.some((f) => f.code === "forbidden_field_policy_enforced")).toBe(true);
  });

  it("unknown target has empty rolloutPlan and rollbackPlan", () => {
    const report = evaluateAgentExecutionRecordSchemaDecision({ target: "invalid" });
    expect(report.rolloutPlan).toEqual([]);
    expect(report.rollbackPlan).toEqual([]);
  });

  it("unknown target includes schema_target_unknown_no_rollout finding", () => {
    const report = evaluateAgentExecutionRecordSchemaDecision({ target: "bad" });
    expect(report.findings.some((f) => f.code === "schema_target_unknown_no_rollout")).toBe(true);
  });

  it("timeline_event_link returns defer", () => {
    const report = evaluateAgentExecutionRecordSchemaDecision({ target: "timeline_event_link" });
    expect(report.decision).toBe("defer");
    expect(report.proposedTableName).toBe("AgentExecutionTimelineLink");
  });

  it("audit_trail_link returns defer", () => {
    const report = evaluateAgentExecutionRecordSchemaDecision({ target: "audit_trail_link" });
    expect(report.decision).toBe("defer");
    expect(report.proposedTableName).toBe("AgentExecutionAuditLink");
  });

  it("unknown target returns blocked", () => {
    const report = evaluateAgentExecutionRecordSchemaDecision({ target: "invalid" });
    expect(report.decision).toBe("blocked");
    expect(report.target).toBe("unknown");
    expect(report.proposedTableName).toBe("");
  });

  it("rolloutPlan and rollbackPlan are non-empty for active targets", () => {
    const report = evaluateAgentExecutionRecordSchemaDecision();
    expect(report.rolloutPlan.length).toBeGreaterThan(0);
    expect(report.rollbackPlan.length).toBeGreaterThan(0);
  });

  it("report mode is read_only_agent_execution_record_schema_decision", () => {
    const report = evaluateAgentExecutionRecordSchemaDecision();
    expect(report.mode).toBe("read_only_agent_execution_record_schema_decision");
  });

  it("uses execution record design only without Prisma or migration calls", () => {
    const designSpy = vi.spyOn(executionRecordDesign, "evaluateAgentExecutionRecordDesign");
    evaluateAgentExecutionRecordSchemaDecision();
    expect(designSpy).toHaveBeenCalledTimes(1);
  });
});
