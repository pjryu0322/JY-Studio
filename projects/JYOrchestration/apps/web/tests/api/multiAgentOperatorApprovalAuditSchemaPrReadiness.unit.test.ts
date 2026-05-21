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
    expect(evaluateOperatorApprovalAuditSchemaPrReadiness().target).toBe("operator_approval");
  });

  it("mode is read_only_operator_approval_audit_schema_pr_readiness", () => {
    expect(evaluateOperatorApprovalAuditSchemaPrReadiness().mode).toBe(
      "read_only_operator_approval_audit_schema_pr_readiness",
    );
  });

  it("default target returns ready_for_schema_pr_plan", () => {
    expect(evaluateOperatorApprovalAuditSchemaPrReadiness().decision).toBe("ready_for_schema_pr_plan");
  });

  it("operator_approval generates OperatorApproval model draft", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrReadiness();
    expect(report.modelCandidates[0]?.modelName).toBe("OperatorApproval");
    expect(report.modelCandidates[0]?.modelDraft).toContain("model OperatorApproval");
  });

  it("OperatorApproval modelDraft includes approval fields", () => {
    const draft = evaluateOperatorApprovalAuditSchemaPrReadiness().modelCandidates[0]?.modelDraft ?? "";
    for (const field of [
      "approvalId",
      "actionType",
      "actorId",
      "actorRole",
      "decision",
      "targetType",
      "targetId",
    ]) {
      expect(draft).toContain(field);
    }
  });

  it("OperatorApproval modelDraft does not require auditEventId", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrReadiness();
    expect(report.decision).toBe("ready_for_schema_pr_plan");
    expect(report.modelCandidates[0]?.modelDraft).not.toMatch(/\bauditEventId\b/);
  });

  it("audit_event generates OperatorAuditEvent model draft", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrReadiness({ target: "audit_event" });
    expect(report.modelCandidates[0]?.modelName).toBe("OperatorAuditEvent");
    expect(report.modelCandidates[0]?.modelDraft).toContain("model OperatorAuditEvent");
  });

  it("OperatorAuditEvent modelDraft includes audit fields", () => {
    const draft =
      evaluateOperatorApprovalAuditSchemaPrReadiness({ target: "audit_event" }).modelCandidates[0]
        ?.modelDraft ?? "";
    for (const field of [
      "auditEventId",
      "eventType",
      "actorId",
      "actorRole",
      "targetType",
      "targetId",
    ]) {
      expect(draft).toContain(field);
    }
  });

  it("OperatorAuditEvent modelDraft does not require approvalId or actionType", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrReadiness({ target: "audit_event" });
    expect(report.decision).toBe("ready_for_schema_pr_plan");
    const draft = report.modelCandidates[0]?.modelDraft ?? "";
    expect(draft).not.toMatch(/\bapprovalId\b/);
    expect(draft).not.toMatch(/\bactionType\b/);
  });

  it("all modelCandidates include separate PR approval caution", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrReadiness();
    for (const candidate of report.modelCandidates) {
      expect(candidate.caution).toContain("separate PR approval");
    }
  });

  it("modelDraft does not include forbidden fields", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrReadiness();
    const draft = report.modelCandidates[0]?.modelDraft ?? "";
    for (const field of FORBIDDEN_IN_DRAFT) {
      expect(draft).not.toContain(field);
    }
  });

  it("operator_override returns defer with empty modelCandidates", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrReadiness({ target: "operator_override" });
    expect(report.decision).toBe("defer");
    expect(report.modelCandidates).toEqual([]);
    expect(report.findings.some((f) => f.code === "operator_schema_target_deferred")).toBe(true);
  });

  it("rollback_approval returns defer with empty modelCandidates", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrReadiness({ target: "rollback_approval" });
    expect(report.decision).toBe("defer");
    expect(report.modelCandidates).toEqual([]);
  });

  it("unknown target returns blocked", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrReadiness({ target: "invalid" });
    expect(report.decision).toBe("blocked");
    expect(report.modelCandidates).toEqual([]);
  });

  it("read-only flags are false for schema migration and data write", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrReadiness();
    expect(report.modifiesSchemaInThisStep).toBe(false);
    expect(report.createsMigrationInThisStep).toBe(false);
    expect(report.writesDataInThisStep).toBe(false);
  });

  it("evaluator uses schema decision only without Prisma migration or DB write", () => {
    const schemaSpy = vi.spyOn(schemaDecisionModule, "evaluateOperatorApprovalAuditSchemaDecision");
    evaluateOperatorApprovalAuditSchemaPrReadiness();
    expect(schemaSpy).toHaveBeenCalledTimes(1);
  });
});
