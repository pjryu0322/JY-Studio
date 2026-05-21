import { afterEach, describe, expect, it, vi } from "vitest";
import {
  evaluateAgentExecutionRecordSchemaPrReadiness,
  modelDraftContainsForbiddenField,
} from "@/lib/agents/evaluateAgentExecutionRecordSchemaPrReadiness";
import * as schemaDecisionModule from "@/lib/agents/evaluateAgentExecutionRecordSchemaDecision";

const FORBIDDEN_IN_DRAFT = [
  "rawPrompt",
  "fullInput",
  "fullOutput",
  "codeDiff",
  "token",
  "apiKey",
  "stackTraceRaw",
];

describe("multi-agent agent execution record schema PR readiness stage 2-23", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("default target is agent_execution_record", () => {
    const report = evaluateAgentExecutionRecordSchemaPrReadiness();
    expect(report.target).toBe("agent_execution_record");
  });

  it("mode is read_only_agent_execution_record_schema_pr_readiness", () => {
    const report = evaluateAgentExecutionRecordSchemaPrReadiness();
    expect(report.mode).toBe("read_only_agent_execution_record_schema_pr_readiness");
  });

  it("default target returns ready_for_schema_pr_plan", () => {
    const report = evaluateAgentExecutionRecordSchemaPrReadiness();
    expect(report.decision).toBe("ready_for_schema_pr_plan");
  });

  it("sourceSchemaDecision is ready_for_schema_proposal", () => {
    const report = evaluateAgentExecutionRecordSchemaPrReadiness();
    expect(report.sourceSchemaDecision).toBe("ready_for_schema_proposal");
  });

  it("sourceProposedTableName is AgentExecutionRecord", () => {
    const report = evaluateAgentExecutionRecordSchemaPrReadiness();
    expect(report.sourceProposedTableName).toBe("AgentExecutionRecord");
  });

  it("requiresSeparatePr is true", () => {
    expect(evaluateAgentExecutionRecordSchemaPrReadiness().requiresSeparatePr).toBe(true);
  });

  it("modifiesSchemaInThisStep is false", () => {
    expect(evaluateAgentExecutionRecordSchemaPrReadiness().modifiesSchemaInThisStep).toBe(false);
  });

  it("createsMigrationInThisStep is false", () => {
    expect(evaluateAgentExecutionRecordSchemaPrReadiness().createsMigrationInThisStep).toBe(false);
  });

  it("writesDataInThisStep is false", () => {
    expect(evaluateAgentExecutionRecordSchemaPrReadiness().writesDataInThisStep).toBe(false);
  });

  it("modelCandidates is non-empty for agent_execution_record", () => {
    const report = evaluateAgentExecutionRecordSchemaPrReadiness();
    expect(report.modelCandidates.length).toBeGreaterThan(0);
  });

  it("modelDraft includes model AgentExecutionRecord", () => {
    const report = evaluateAgentExecutionRecordSchemaPrReadiness();
    expect(report.modelCandidates[0]?.modelDraft).toContain("model AgentExecutionRecord");
  });

  it("modelDraft does not include forbidden fields", () => {
    const report = evaluateAgentExecutionRecordSchemaPrReadiness();
    const draft = report.modelCandidates[0]?.modelDraft ?? "";
    for (const field of FORBIDDEN_IN_DRAFT) {
      expect(draft).not.toContain(field);
    }
  });

  it("migrationChecklist is non-empty", () => {
    const report = evaluateAgentExecutionRecordSchemaPrReadiness();
    expect(report.migrationChecklist.length).toBeGreaterThan(0);
  });

  it("rollbackChecklist is non-empty", () => {
    const report = evaluateAgentExecutionRecordSchemaPrReadiness();
    expect(report.rollbackChecklist.length).toBeGreaterThan(0);
  });

  it("retentionAccessChecklist is non-empty", () => {
    const report = evaluateAgentExecutionRecordSchemaPrReadiness();
    expect(report.retentionAccessChecklist.length).toBeGreaterThan(0);
  });

  it("forbiddenFieldChecklist includes required fields as satisfied", () => {
    const report = evaluateAgentExecutionRecordSchemaPrReadiness();
    const byField = new Map(report.forbiddenFieldChecklist.map((f) => [f.item, f]));
    for (const field of FORBIDDEN_IN_DRAFT) {
      expect(byField.get(field)?.satisfied).toBe(true);
    }
  });

  it("timeline_event_link returns defer", () => {
    const report = evaluateAgentExecutionRecordSchemaPrReadiness({ target: "timeline_event_link" });
    expect(report.decision).toBe("defer");
    expect(report.modelCandidates).toEqual([]);
  });

  it("audit_trail_link returns defer", () => {
    const report = evaluateAgentExecutionRecordSchemaPrReadiness({ target: "audit_trail_link" });
    expect(report.decision).toBe("defer");
  });

  it("unknown target returns blocked", () => {
    const report = evaluateAgentExecutionRecordSchemaPrReadiness({ target: "invalid" });
    expect(report.decision).toBe("blocked");
    expect(report.modelCandidates).toEqual([]);
  });

  it("uses schema decision only without Prisma migration or DB write", () => {
    const schemaSpy = vi.spyOn(schemaDecisionModule, "evaluateAgentExecutionRecordSchemaDecision");
    evaluateAgentExecutionRecordSchemaPrReadiness();
    expect(schemaSpy).toHaveBeenCalledTimes(1);
  });

  it("report includes sourceFieldProposalCount", () => {
    const report = evaluateAgentExecutionRecordSchemaPrReadiness();
    expect(report.sourceFieldProposalCount).toBeGreaterThan(0);
  });

  it("report includes sourceExcludedFieldCount", () => {
    const report = evaluateAgentExecutionRecordSchemaPrReadiness();
    expect(report.sourceExcludedFieldCount).toBeGreaterThan(0);
  });

  it("report includes sourceForbiddenFieldNames", () => {
    const report = evaluateAgentExecutionRecordSchemaPrReadiness();
    expect(report.sourceForbiddenFieldNames.length).toBeGreaterThan(0);
  });

  it("all modelCandidates include caution", () => {
    const report = evaluateAgentExecutionRecordSchemaPrReadiness();
    for (const candidate of report.modelCandidates) {
      expect(candidate.caution.length).toBeGreaterThan(0);
    }
  });

  it("caution includes separate PR approval wording", () => {
    const report = evaluateAgentExecutionRecordSchemaPrReadiness();
    expect(report.modelCandidates[0]?.caution).toContain("separate PR approval");
  });

  it("modelDraftContainsForbiddenField helper detects forbidden fields", () => {
    expect(modelDraftContainsForbiddenField("  rawPrompt String")).toBe(true);
    expect(modelDraftContainsForbiddenField("  recordId String")).toBe(false);
  });

  it("forbidden field in modelDraft blocks readiness", () => {
    vi.spyOn(schemaDecisionModule, "evaluateAgentExecutionRecordSchemaDecision").mockReturnValue({
      mode: "read_only_agent_execution_record_schema_decision",
      decision: "ready_for_schema_proposal",
      target: "agent_execution_record",
      proposedTableName: "AgentExecutionRecord",
      requiresPrismaSchemaChange: true,
      requiresMigration: true,
      requiresRollbackPlan: true,
      requiresBackfillPlan: false,
      requiresRetentionPolicy: true,
      requiresAccessControlReview: true,
      fieldProposals: [
        {
          field: "rawPrompt",
          type: "String",
          nullable: true,
          indexed: false,
          reason: "test",
          sensitivity: "forbidden",
        },
      ],
      excludedFields: FORBIDDEN_IN_DRAFT.map((field) => ({
        field,
        type: "Forbidden",
        nullable: true,
        indexed: false,
        reason: "excluded",
        sensitivity: "forbidden" as const,
      })),
      rolloutPlan: [],
      rollbackPlan: [],
      findings: [],
    });
    const report = evaluateAgentExecutionRecordSchemaPrReadiness();
    expect(report.decision).toBe("blocked");
    expect(report.findings.some((f) => f.code === "model_candidate_contains_forbidden_field")).toBe(
      true,
    );
  });
});
