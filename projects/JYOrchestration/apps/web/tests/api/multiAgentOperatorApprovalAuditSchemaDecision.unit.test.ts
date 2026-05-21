import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateOperatorApprovalAuditSchemaDecision } from "@/lib/agents/evaluateOperatorApprovalAuditSchemaDecision";
import * as operatorApprovalAuditDesign from "@/lib/agents/evaluateOperatorApprovalAuditDesign";

describe("multi-agent operator approval audit schema decision stage 2-18", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("default target is operator_approval", () => {
    const report = evaluateOperatorApprovalAuditSchemaDecision();
    expect(report.target).toBe("operator_approval");
  });

  it("operator_approval returns ready_for_schema_proposal", () => {
    const report = evaluateOperatorApprovalAuditSchemaDecision({ target: "operator_approval" });
    expect(report.decision).toBe("ready_for_schema_proposal");
  });

  it("operator_approval proposedTableName is OperatorApproval", () => {
    const report = evaluateOperatorApprovalAuditSchemaDecision();
    expect(report.proposedTableName).toBe("OperatorApproval");
  });

  it("audit_event returns ready_for_schema_proposal", () => {
    const report = evaluateOperatorApprovalAuditSchemaDecision({ target: "audit_event" });
    expect(report.decision).toBe("ready_for_schema_proposal");
  });

  it("audit_event proposedTableName is OperatorAuditEvent", () => {
    const report = evaluateOperatorApprovalAuditSchemaDecision({ target: "audit_event" });
    expect(report.proposedTableName).toBe("OperatorAuditEvent");
  });

  it("operator_override returns defer", () => {
    const report = evaluateOperatorApprovalAuditSchemaDecision({ target: "operator_override" });
    expect(report.decision).toBe("defer");
  });

  it("rollback_approval returns defer", () => {
    const report = evaluateOperatorApprovalAuditSchemaDecision({ target: "rollback_approval" });
    expect(report.decision).toBe("defer");
  });

  it("unknown target returns blocked", () => {
    const report = evaluateOperatorApprovalAuditSchemaDecision({ target: "invalid" });
    expect(report.decision).toBe("blocked");
    expect(report.target).toBe("unknown");
  });

  it("requiresPrismaSchemaChange is true for operator_approval", () => {
    expect(evaluateOperatorApprovalAuditSchemaDecision().requiresPrismaSchemaChange).toBe(true);
  });

  it("requiresMigration is true for operator_approval", () => {
    expect(evaluateOperatorApprovalAuditSchemaDecision().requiresMigration).toBe(true);
  });

  it("requiresRollbackPlan is true for operator_approval", () => {
    expect(evaluateOperatorApprovalAuditSchemaDecision().requiresRollbackPlan).toBe(true);
  });

  it("requiresRetentionPolicy is true for operator_approval", () => {
    expect(evaluateOperatorApprovalAuditSchemaDecision().requiresRetentionPolicy).toBe(true);
  });

  it("requiresAccessControlReview is true for operator_approval", () => {
    expect(evaluateOperatorApprovalAuditSchemaDecision().requiresAccessControlReview).toBe(true);
  });

  it("requiresPermissionModel is true for operator_approval", () => {
    expect(evaluateOperatorApprovalAuditSchemaDecision().requiresPermissionModel).toBe(true);
  });

  it("requiresAuditIntegrityPolicy is true for operator_approval", () => {
    expect(evaluateOperatorApprovalAuditSchemaDecision().requiresAuditIntegrityPolicy).toBe(true);
  });

  it("fieldProposals includes actorId actionType decision reasonSummary relatedExecutionRecordId", () => {
    const report = evaluateOperatorApprovalAuditSchemaDecision();
    const fields = new Set(report.fieldProposals.map((f) => f.field));
    expect(fields.has("actorId")).toBe(true);
    expect(fields.has("actionType")).toBe(true);
    expect(fields.has("decision")).toBe(true);
    expect(fields.has("reasonSummary")).toBe(true);
    expect(fields.has("relatedExecutionRecordId")).toBe(true);
  });

  it("indexes actorId actionType decision targetId createdAt", () => {
    const report = evaluateOperatorApprovalAuditSchemaDecision();
    const byField = new Map(report.fieldProposals.map((f) => [f.field, f]));
    for (const field of ["actorId", "actionType", "decision", "targetId", "createdAt"]) {
      expect(byField.get(field)?.indexed).toBe(true);
    }
  });

  it("excludedFields marks rawReason rawPrompt fullInput fullOutput codeDiff token apiKey personalContact phoneNumber emailBody as forbidden", () => {
    const report = evaluateOperatorApprovalAuditSchemaDecision();
    const byField = new Map(report.excludedFields.map((f) => [f.field, f]));
    for (const field of [
      "rawReason",
      "rawPrompt",
      "fullInput",
      "fullOutput",
      "codeDiff",
      "token",
      "apiKey",
      "personalContact",
      "phoneNumber",
      "emailBody",
    ]) {
      expect(byField.get(field)?.sensitivity).toBe("forbidden");
    }
  });

  it("excludedFields include promptText and fileContent as forbidden", () => {
    const report = evaluateOperatorApprovalAuditSchemaDecision();
    const byField = new Map(report.excludedFields.map((f) => [f.field, f]));
    expect(byField.get("promptText")?.sensitivity).toBe("forbidden");
    expect(byField.get("fileContent")?.sensitivity).toBe("forbidden");
  });

  it("excludedFields include secret password authorization privateKey env as forbidden", () => {
    const report = evaluateOperatorApprovalAuditSchemaDecision();
    const byField = new Map(report.excludedFields.map((f) => [f.field, f]));
    for (const field of ["secret", "password", "authorization", "privateKey", "env"]) {
      expect(byField.get(field)?.sensitivity).toBe("forbidden");
    }
  });

  it("excludedFields have no duplicate fields", () => {
    const report = evaluateOperatorApprovalAuditSchemaDecision();
    const keys = report.excludedFields.map((f) => f.field.trim().toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("actorRole is indexed", () => {
    const report = evaluateOperatorApprovalAuditSchemaDecision();
    const byField = new Map(report.fieldProposals.map((f) => [f.field, f]));
    expect(byField.get("actorRole")?.indexed).toBe(true);
  });

  it("relatedAgentId relatedCapabilityId relatedConnectorId are indexed", () => {
    const report = evaluateOperatorApprovalAuditSchemaDecision();
    const byField = new Map(report.fieldProposals.map((f) => [f.field, f]));
    for (const field of ["relatedAgentId", "relatedCapabilityId", "relatedConnectorId"]) {
      expect(byField.get(field)?.indexed).toBe(true);
    }
  });

  it("relatedGovernancePolicyId relatedTimelineEventId relatedExecutionRecordId auditEventId are indexed", () => {
    const report = evaluateOperatorApprovalAuditSchemaDecision();
    const byField = new Map(report.fieldProposals.map((f) => [f.field, f]));
    for (const field of [
      "relatedGovernancePolicyId",
      "relatedTimelineEventId",
      "relatedExecutionRecordId",
      "auditEventId",
    ]) {
      expect(byField.get(field)?.indexed).toBe(true);
    }
  });

  it("includes forbidden_field_policy_enforced when required forbidden fields are present", () => {
    const report = evaluateOperatorApprovalAuditSchemaDecision();
    expect(report.findings.some((f) => f.code === "forbidden_field_policy_enforced")).toBe(true);
  });

  it("unknown target has empty rolloutPlan and rollbackPlan", () => {
    const report = evaluateOperatorApprovalAuditSchemaDecision({ target: "invalid" });
    expect(report.rolloutPlan).toEqual([]);
    expect(report.rollbackPlan).toEqual([]);
  });

  it("unknown target includes operator_schema_target_unknown_no_rollout finding", () => {
    const report = evaluateOperatorApprovalAuditSchemaDecision({ target: "bad" });
    expect(report.findings.some((f) => f.code === "operator_schema_target_unknown_no_rollout")).toBe(
      true,
    );
  });

  it("excludedFields use Forbidden type and indexed false", () => {
    const report = evaluateOperatorApprovalAuditSchemaDecision();
    for (const field of report.excludedFields) {
      expect(field.type).toBe("Forbidden");
      expect(field.indexed).toBe(false);
    }
  });

  it("rolloutPlan and rollbackPlan are non-empty for active targets", () => {
    const report = evaluateOperatorApprovalAuditSchemaDecision();
    expect(report.rolloutPlan.length).toBeGreaterThan(0);
    expect(report.rollbackPlan.length).toBeGreaterThan(0);
  });

  it("report mode is read_only_operator_approval_audit_schema_decision", () => {
    const report = evaluateOperatorApprovalAuditSchemaDecision();
    expect(report.mode).toBe("read_only_operator_approval_audit_schema_decision");
  });

  it("uses operator approval audit design only without Prisma or migration calls", () => {
    const designSpy = vi.spyOn(operatorApprovalAuditDesign, "evaluateOperatorApprovalAuditDesign");
    evaluateOperatorApprovalAuditSchemaDecision();
    expect(designSpy).toHaveBeenCalledTimes(1);
  });
});
