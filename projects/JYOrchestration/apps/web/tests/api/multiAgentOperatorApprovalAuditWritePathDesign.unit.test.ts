import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateOperatorApprovalAuditWritePathDesign } from "@/lib/agents/evaluateOperatorApprovalAuditWritePathDesign";
import * as schemaDecisionModule from "@/lib/agents/evaluateOperatorApprovalAuditSchemaDecision";

function checklistItem(
  report: ReturnType<typeof evaluateOperatorApprovalAuditWritePathDesign>,
  item: string,
) {
  return report.validationChecklist.find((c) => c.item === item);
}

describe("multi-agent operator approval audit write path design stage 2-21", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("default target is operator_approval", () => {
    const report = evaluateOperatorApprovalAuditWritePathDesign();
    expect(report.target).toBe("operator_approval");
  });

  it("mode is read_only_operator_approval_audit_write_path_design", () => {
    const report = evaluateOperatorApprovalAuditWritePathDesign();
    expect(report.mode).toBe("read_only_operator_approval_audit_write_path_design");
  });

  it("default target returns defer decision", () => {
    const report = evaluateOperatorApprovalAuditWritePathDesign();
    expect(report.decision).toBe("defer");
  });

  it("defer includes schema/migration not applied findings", () => {
    const report = evaluateOperatorApprovalAuditWritePathDesign();
    expect(report.findings.some((f) => f.code === "schema_not_applied")).toBe(true);
    expect(report.findings.some((f) => f.code === "migration_not_applied")).toBe(true);
    expect(report.findings.some((f) => f.code === "write_path_deferred_until_schema_applied")).toBe(
      true,
    );
  });

  it("featureFlagName is JYO_OPERATOR_APPROVAL_AUDIT_WRITE_PATH for active target", () => {
    const report = evaluateOperatorApprovalAuditWritePathDesign();
    expect(report.featureFlagName).toBe("JYO_OPERATOR_APPROVAL_AUDIT_WRITE_PATH");
  });

  it("featureFlagDefault is off", () => {
    const report = evaluateOperatorApprovalAuditWritePathDesign();
    expect(report.featureFlagDefault).toBe("off");
  });

  it("proposedWriteEntrypoints is non-empty for active target", () => {
    const report = evaluateOperatorApprovalAuditWritePathDesign();
    expect(report.proposedWriteEntrypoints.length).toBeGreaterThan(0);
  });

  it("proposedPermissionGuards is non-empty", () => {
    const report = evaluateOperatorApprovalAuditWritePathDesign();
    expect(report.proposedPermissionGuards.length).toBeGreaterThan(0);
  });

  it("proposedAuditIntegrityGuards is non-empty", () => {
    const report = evaluateOperatorApprovalAuditWritePathDesign();
    expect(report.proposedAuditIntegrityGuards.length).toBeGreaterThan(0);
  });

  it("proposedSanitizers is non-empty", () => {
    const report = evaluateOperatorApprovalAuditWritePathDesign();
    expect(report.proposedSanitizers.length).toBeGreaterThan(0);
  });

  it("forbiddenFieldGuards include rejectRawReason rejectRawPrompt rejectFullInput rejectTokenSecrets rejectEmailBody", () => {
    const report = evaluateOperatorApprovalAuditWritePathDesign();
    const guards = new Set(report.forbiddenFieldGuards);
    expect(guards.has("rejectRawReason")).toBe(true);
    expect(guards.has("rejectRawPrompt")).toBe(true);
    expect(guards.has("rejectFullInput")).toBe(true);
    expect(guards.has("rejectTokenSecrets")).toBe(true);
    expect(guards.has("rejectEmailBody")).toBe(true);
  });

  it("validationChecklist has schema applied false", () => {
    const report = evaluateOperatorApprovalAuditWritePathDesign();
    expect(checklistItem(report, "schema applied")?.satisfied).toBe(false);
  });

  it("validationChecklist has migration applied false", () => {
    const report = evaluateOperatorApprovalAuditWritePathDesign();
    expect(checklistItem(report, "migration applied")?.satisfied).toBe(false);
  });

  it("validationChecklist has write adapter implemented false", () => {
    const report = evaluateOperatorApprovalAuditWritePathDesign();
    expect(checklistItem(report, "write adapter implemented")?.satisfied).toBe(false);
  });

  it("validationChecklist has DB write not implemented in this step true", () => {
    const report = evaluateOperatorApprovalAuditWritePathDesign();
    expect(checklistItem(report, "DB write not implemented in this step")?.satisfied).toBe(true);
  });

  it("requiresSchemaApplied is true for defer target", () => {
    expect(evaluateOperatorApprovalAuditWritePathDesign().requiresSchemaApplied).toBe(true);
  });

  it("requiresMigrationApplied is true for defer target", () => {
    expect(evaluateOperatorApprovalAuditWritePathDesign().requiresMigrationApplied).toBe(true);
  });

  it("requiresFeatureFlag is true for defer target", () => {
    expect(evaluateOperatorApprovalAuditWritePathDesign().requiresFeatureFlag).toBe(true);
  });

  it("requiresPermissionGuard is true for defer target", () => {
    expect(evaluateOperatorApprovalAuditWritePathDesign().requiresPermissionGuard).toBe(true);
  });

  it("requiresAuditIntegrityGuard is true for defer target", () => {
    expect(evaluateOperatorApprovalAuditWritePathDesign().requiresAuditIntegrityGuard).toBe(true);
  });

  it("requiresForbiddenFieldGuard is true for defer target", () => {
    expect(evaluateOperatorApprovalAuditWritePathDesign().requiresForbiddenFieldGuard).toBe(true);
  });

  it("requiresWritePathRollback is true for defer target", () => {
    expect(evaluateOperatorApprovalAuditWritePathDesign().requiresWritePathRollback).toBe(true);
  });

  it("requiresOperatorApproval is true for defer target", () => {
    expect(evaluateOperatorApprovalAuditWritePathDesign().requiresOperatorApproval).toBe(true);
  });

  it("report includes sourceSchemaDecision sourceSchemaTarget sourceProposedTableName", () => {
    const report = evaluateOperatorApprovalAuditWritePathDesign();
    expect(report.sourceSchemaDecision).toBe("ready_for_schema_proposal");
    expect(report.sourceSchemaTarget).toBe("operator_approval");
    expect(report.sourceProposedTableName).toBe("OperatorApproval");
  });

  it("operator_override returns defer", () => {
    const report = evaluateOperatorApprovalAuditWritePathDesign({ target: "operator_override" });
    expect(report.decision).toBe("defer");
    expect(report.findings.some((f) => f.code === "operator_override_write_deferred")).toBe(true);
  });

  it("audit_event returns defer", () => {
    const report = evaluateOperatorApprovalAuditWritePathDesign({ target: "audit_event" });
    expect(report.decision).toBe("defer");
  });

  it("rollback_approval returns defer", () => {
    const report = evaluateOperatorApprovalAuditWritePathDesign({ target: "rollback_approval" });
    expect(report.decision).toBe("defer");
    expect(report.findings.some((f) => f.code === "rollback_approval_write_deferred")).toBe(true);
  });

  it("unknown target returns blocked", () => {
    const report = evaluateOperatorApprovalAuditWritePathDesign({ target: "invalid" });
    expect(report.decision).toBe("blocked");
    expect(report.target).toBe("unknown");
    expect(report.findings.some((f) => f.code === "unknown_approval_audit_write_path_target")).toBe(
      true,
    );
  });

  it("unknown target has empty proposed arrays and rollbackPlan", () => {
    const report = evaluateOperatorApprovalAuditWritePathDesign({ target: "bad" });
    expect(report.proposedWriteEntrypoints).toEqual([]);
    expect(report.proposedPermissionGuards).toEqual([]);
    expect(report.proposedAuditIntegrityGuards).toEqual([]);
    expect(report.proposedSanitizers).toEqual([]);
    expect(report.forbiddenFieldGuards).toEqual([]);
    expect(report.rollbackPlan).toEqual([]);
  });

  it("uses schema decision only without Prisma DB or write path calls", () => {
    const schemaSpy = vi.spyOn(schemaDecisionModule, "evaluateOperatorApprovalAuditSchemaDecision");
    evaluateOperatorApprovalAuditWritePathDesign();
    expect(schemaSpy).toHaveBeenCalledTimes(1);
  });
});
