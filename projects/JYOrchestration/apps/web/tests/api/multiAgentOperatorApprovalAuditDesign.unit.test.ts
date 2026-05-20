import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateOperatorApprovalAuditDesign } from "@/lib/agents/evaluateOperatorApprovalAuditDesign";
import * as persistenceValidation from "@/lib/agents/agentRuntimePersistenceCandidateValidation";

describe("multi-agent operator approval audit design stage 2-15", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("default target is operator_approval", () => {
    const report = evaluateOperatorApprovalAuditDesign();
    expect(report.target).toBe("operator_approval");
  });

  it("operator_approval returns ready_for_schema_design", () => {
    const report = evaluateOperatorApprovalAuditDesign({ target: "operator_approval" });
    expect(report.decision).toBe("ready_for_schema_design");
  });

  it("operator_override returns defer", () => {
    const report = evaluateOperatorApprovalAuditDesign({ target: "operator_override" });
    expect(report.decision).toBe("defer");
  });

  it("audit_event returns ready_for_schema_design", () => {
    const report = evaluateOperatorApprovalAuditDesign({ target: "audit_event" });
    expect(report.decision).toBe("ready_for_schema_design");
  });

  it("rollback_approval returns defer", () => {
    const report = evaluateOperatorApprovalAuditDesign({ target: "rollback_approval" });
    expect(report.decision).toBe("defer");
  });

  it("unknown target returns blocked", () => {
    const report = evaluateOperatorApprovalAuditDesign({ target: "invalid_target" });
    expect(report.decision).toBe("blocked");
    expect(report.target).toBe("unknown");
  });

  it("report mode is read_only_operator_approval_audit_design", () => {
    const report = evaluateOperatorApprovalAuditDesign();
    expect(report.mode).toBe("read_only_operator_approval_audit_design");
  });

  it("active targets require actor identity, reason, and audit trail", () => {
    const report = evaluateOperatorApprovalAuditDesign({ target: "operator_approval" });
    expect(report.requiresActorIdentity).toBe(true);
    expect(report.requiresReason).toBe(true);
    expect(report.requiresAuditTrail).toBe(true);
  });

  it("persistFields includes actorId actionType decision reasonSummary relatedExecutionRecordId", () => {
    const report = evaluateOperatorApprovalAuditDesign();
    const fields = new Set(report.persistFields.map((f) => f.field));
    expect(fields.has("actorId")).toBe(true);
    expect(fields.has("actionType")).toBe(true);
    expect(fields.has("decision")).toBe(true);
    expect(fields.has("reasonSummary")).toBe(true);
    expect(fields.has("relatedExecutionRecordId")).toBe(true);
  });

  it("excludedFields marks rawReason rawPrompt fullInput fullOutput codeDiff token apiKey personalContact as forbidden", () => {
    const report = evaluateOperatorApprovalAuditDesign();
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
    ]) {
      expect(byField.get(field)?.sensitivity).toBe("forbidden");
      expect(byField.get(field)?.persist).toBe(false);
    }
  });

  it("does not invoke persistence validation or storage helpers", () => {
    const validateSpy = vi.spyOn(
      persistenceValidation,
      "validateAgentRuntimePersistenceCandidate",
    );
    evaluateOperatorApprovalAuditDesign();
    expect(validateSpy).not.toHaveBeenCalled();
  });
});
