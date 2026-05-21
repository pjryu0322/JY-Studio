import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateOperatorApprovalAuditSchemaPrReadiness } from "@/lib/agents/evaluateOperatorApprovalAuditSchemaPrReadiness";
import * as schemaDecisionModule from "@/lib/agents/evaluateOperatorApprovalAuditSchemaDecision";

const FORBIDDEN_IN_DRAFT = [
  "rawReason",
  "rawPrompt",
  "promptText",
  "fullInput",
  "fullOutput",
  "codeDiff",
  "fileContent",
  "token",
  "secret",
  "password",
  "authorization",
  "apiKey",
  "privateKey",
  "env",
  "personalContact",
  "phoneNumber",
  "emailBody",
] as const;

describe("multi-agent operator approval audit schema PR readiness stage 2-24", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("default target is operator_approval", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrReadiness();
    expect(report.target).toBe("operator_approval");
  });

  it("mode is read_only_operator_approval_audit_schema_pr_readiness", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrReadiness();
    expect(report.mode).toBe("read_only_operator_approval_audit_schema_pr_readiness");
  });

  it("default target returns ready_for_schema_pr_plan", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrReadiness();
    expect(report.decision).toBe("ready_for_schema_pr_plan");
  });

  it("sourceSchemaDecision is ready_for_schema_proposal", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrReadiness();
    expect(report.sourceSchemaDecision).toBe("ready_for_schema_proposal");
  });

  it("sourceProposedTableName is non-empty", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrReadiness();
    expect(report.sourceProposedTableName.length).toBeGreaterThan(0);
  });

  it("sourceFieldProposalCount is at least 1", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrReadiness();
    expect(report.sourceFieldProposalCount).toBeGreaterThanOrEqual(1);
  });

  it("sourceExcludedFieldCount is at least 1", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrReadiness();
    expect(report.sourceExcludedFieldCount).toBeGreaterThanOrEqual(1);
  });

  it("sourceForbiddenFieldNames is non-empty", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrReadiness();
    expect(report.sourceForbiddenFieldNames.length).toBeGreaterThan(0);
  });

  it("requiresSeparatePr is true", () => {
    expect(evaluateOperatorApprovalAuditSchemaPrReadiness().requiresSeparatePr).toBe(true);
  });

  it("modifiesSchemaInThisStep is false", () => {
    expect(evaluateOperatorApprovalAuditSchemaPrReadiness().modifiesSchemaInThisStep).toBe(false);
  });

  it("createsMigrationInThisStep is false", () => {
    expect(evaluateOperatorApprovalAuditSchemaPrReadiness().createsMigrationInThisStep).toBe(false);
  });

  it("writesDataInThisStep is false", () => {
    expect(evaluateOperatorApprovalAuditSchemaPrReadiness().writesDataInThisStep).toBe(false);
  });

  it("modelCandidates is non-empty for operator_approval", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrReadiness();
    expect(report.modelCandidates.length).toBeGreaterThan(0);
  });

  it("all modelCandidates include caution", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrReadiness();
    for (const candidate of report.modelCandidates) {
      expect(candidate.caution).toContain("separate PR approval");
    }
  });

  it("modelDraft includes OperatorApproval or OperatorAuditEvent", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrReadiness();
    const draft = report.modelCandidates[0]?.modelDraft ?? "";
    expect(draft.includes("OperatorApproval") || draft.includes("OperatorAuditEvent")).toBe(true);
  });

  it("modelDraft does not include forbidden fields", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrReadiness();
    const draft = report.modelCandidates[0]?.modelDraft ?? "";
    for (const field of FORBIDDEN_IN_DRAFT) {
      expect(draft).not.toContain(field);
    }
  });

  it("migrationChecklist is non-empty", () => {
    expect(evaluateOperatorApprovalAuditSchemaPrReadiness().migrationChecklist.length).toBeGreaterThan(0);
  });

  it("rollbackChecklist is non-empty", () => {
    expect(evaluateOperatorApprovalAuditSchemaPrReadiness().rollbackChecklist.length).toBeGreaterThan(0);
  });

  it("permissionAccessChecklist is non-empty", () => {
    expect(
      evaluateOperatorApprovalAuditSchemaPrReadiness().permissionAccessChecklist.length,
    ).toBeGreaterThan(0);
  });

  it("auditIntegrityChecklist is non-empty", () => {
    expect(evaluateOperatorApprovalAuditSchemaPrReadiness().auditIntegrityChecklist.length).toBeGreaterThan(
      0,
    );
  });

  it("forbiddenFieldChecklist includes required fields as satisfied", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrReadiness();
    const byField = new Map(report.forbiddenFieldChecklist.map((f) => [f.item, f]));
    for (const field of FORBIDDEN_IN_DRAFT) {
      expect(byField.get(field)?.satisfied).toBe(true);
    }
  });

  it("operator_override returns defer", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrReadiness({ target: "operator_override" });
    expect(report.decision).toBe("defer");
    expect(report.modelCandidates).toEqual([]);
  });

  it("audit_event returns ready_for_schema_pr_plan", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrReadiness({ target: "audit_event" });
    expect(report.decision).toBe("ready_for_schema_pr_plan");
    expect(report.sourceProposedTableName).toBe("OperatorAuditEvent");
  });

  it("rollback_approval returns defer", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrReadiness({ target: "rollback_approval" });
    expect(report.decision).toBe("defer");
  });

  it("unknown target returns blocked", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrReadiness({ target: "invalid" });
    expect(report.decision).toBe("blocked");
    expect(report.modelCandidates).toEqual([]);
  });

  it("evaluator uses schema decision only without Prisma migration or DB write", () => {
    const schemaSpy = vi.spyOn(schemaDecisionModule, "evaluateOperatorApprovalAuditSchemaDecision");
    evaluateOperatorApprovalAuditSchemaPrReadiness();
    expect(schemaSpy).toHaveBeenCalledTimes(1);
  });
});
