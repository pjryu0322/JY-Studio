import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateOperatorApprovalAuditSchemaPrApprovalPackage } from "@/lib/agents/evaluateOperatorApprovalAuditSchemaPrApprovalPackage";
import * as schemaPrReadinessModule from "@/lib/agents/evaluateOperatorApprovalAuditSchemaPrReadiness";

function checklistItem(
  report: ReturnType<typeof evaluateOperatorApprovalAuditSchemaPrApprovalPackage>,
  item: string,
) {
  return report.approvalChecklist.find((c) => c.item === item);
}

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

describe("multi-agent operator approval audit schema PR approval package stage 2-27", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("default target is operator_approval", () => {
    expect(evaluateOperatorApprovalAuditSchemaPrApprovalPackage().target).toBe("operator_approval");
  });

  it("mode is read_only_operator_approval_audit_schema_pr_approval_package", () => {
    expect(evaluateOperatorApprovalAuditSchemaPrApprovalPackage().mode).toBe(
      "read_only_operator_approval_audit_schema_pr_approval_package",
    );
  });

  it("explicitUserApproval=false returns defer", () => {
    expect(
      evaluateOperatorApprovalAuditSchemaPrApprovalPackage({ explicitUserApproval: false }).decision,
    ).toBe("defer");
  });

  it("explicitUserApproval=false sets explicitUserApprovalProvided false", () => {
    expect(
      evaluateOperatorApprovalAuditSchemaPrApprovalPackage({ explicitUserApproval: false })
        .explicitUserApprovalProvided,
    ).toBe(false);
  });

  it("explicitUserApproval=true returns ready_for_explicit_schema_pr_approval", () => {
    expect(
      evaluateOperatorApprovalAuditSchemaPrApprovalPackage({ explicitUserApproval: true }).decision,
    ).toBe("ready_for_explicit_schema_pr_approval");
  });

  it("explicitUserApproval=true sets explicitUserApprovalProvided true", () => {
    expect(
      evaluateOperatorApprovalAuditSchemaPrApprovalPackage({ explicitUserApproval: true })
        .explicitUserApprovalProvided,
    ).toBe(true);
  });

  it("requiresExplicitUserApproval is true", () => {
    expect(evaluateOperatorApprovalAuditSchemaPrApprovalPackage().requiresExplicitUserApproval).toBe(
      true,
    );
  });

  it("requiresSeparatePr is true", () => {
    expect(evaluateOperatorApprovalAuditSchemaPrApprovalPackage().requiresSeparatePr).toBe(true);
  });

  it("operator_approval modelName is OperatorApproval", () => {
    expect(
      evaluateOperatorApprovalAuditSchemaPrApprovalPackage({ explicitUserApproval: true }).modelName,
    ).toBe("OperatorApproval");
  });

  it("operator_approval modelDraft includes model OperatorApproval", () => {
    const draft = evaluateOperatorApprovalAuditSchemaPrApprovalPackage({
      explicitUserApproval: true,
    }).modelDraft;
    expect(draft).toContain("model OperatorApproval");
  });

  it("operator_approval modelDraft does not include forbidden fields", () => {
    const draft = evaluateOperatorApprovalAuditSchemaPrApprovalPackage({
      explicitUserApproval: true,
    }).modelDraft;
    for (const field of FORBIDDEN_IN_DRAFT) {
      expect(draft).not.toContain(field);
    }
  });

  it("approvalChecklist includes explicit user approval confirmed", () => {
    expect(
      checklistItem(
        evaluateOperatorApprovalAuditSchemaPrApprovalPackage({ explicitUserApproval: true }),
        "explicit user approval confirmed",
      ),
    ).toBeDefined();
  });

  it("permissionAccessChecklist is non-empty", () => {
    expect(
      evaluateOperatorApprovalAuditSchemaPrApprovalPackage().permissionAccessChecklist.length,
    ).toBeGreaterThan(0);
  });

  it("auditIntegrityChecklist is non-empty", () => {
    expect(
      evaluateOperatorApprovalAuditSchemaPrApprovalPackage().auditIntegrityChecklist.length,
    ).toBeGreaterThan(0);
  });

  it("forbiddenFieldChecklist items are all satisfied", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrApprovalPackage({
      explicitUserApproval: true,
    });
    expect(report.forbiddenFieldChecklist.every((item) => item.satisfied)).toBe(true);
  });

  it("audit_event with explicitUserApproval=true uses OperatorAuditEvent", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrApprovalPackage({
      target: "audit_event",
      explicitUserApproval: true,
    });
    expect(report.modelName).toBe("OperatorAuditEvent");
    expect(report.modelDraft).toContain("model OperatorAuditEvent");
  });

  it("operator_override returns defer with empty modelDraft", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrApprovalPackage({
      target: "operator_override",
      explicitUserApproval: true,
    });
    expect(report.decision).toBe("defer");
    expect(report.modelDraft).toBe("");
    expect(report.findings.some((f) => f.code === "model_draft_missing")).toBe(false);
  });

  it("rollback_approval returns defer with empty modelDraft", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrApprovalPackage({
      target: "rollback_approval",
      explicitUserApproval: true,
    });
    expect(report.decision).toBe("defer");
    expect(report.modelDraft).toBe("");
    expect(report.findings.some((f) => f.code === "model_draft_missing")).toBe(false);
  });

  it("unknown target returns blocked", () => {
    const report = evaluateOperatorApprovalAuditSchemaPrApprovalPackage({
      target: "invalid",
      explicitUserApproval: true,
    });
    expect(report.decision).toBe("blocked");
    expect(report.modelDraft).toBe("");
    expect(report.findings.some((f) => f.code === "model_draft_missing")).toBe(false);
  });

  it("forbidden model draft blocks without model_draft_missing finding", () => {
    vi.spyOn(schemaPrReadinessModule, "evaluateOperatorApprovalAuditSchemaPrReadiness").mockReturnValue({
      mode: "read_only_operator_approval_audit_schema_pr_readiness",
      decision: "ready_for_schema_pr_plan",
      target: "operator_approval",
      sourceSchemaDecision: "ready_for_schema_proposal",
      sourceProposedTableName: "OperatorApproval",
      sourceRequiresPrismaSchemaChange: true,
      sourceRequiresMigration: true,
      sourceFieldProposalCount: 1,
      sourceExcludedFieldCount: 1,
      sourceForbiddenFieldNames: ["rawPrompt"],
      modelCandidates: [
        {
          modelName: "OperatorApproval",
          modelDraft: "model OperatorApproval { rawPrompt String }",
          caution: "read-only",
        },
      ],
      migrationChecklist: [],
      rollbackChecklist: [],
      permissionAccessChecklist: [],
      auditIntegrityChecklist: [],
      forbiddenFieldChecklist: [],
      requiresSeparatePr: true,
      modifiesSchemaInThisStep: false,
      createsMigrationInThisStep: false,
      writesDataInThisStep: false,
      findings: [],
    });

    const report = evaluateOperatorApprovalAuditSchemaPrApprovalPackage({
      explicitUserApproval: true,
    });
    expect(report.decision).toBe("blocked");
    expect(report.findings.some((f) => f.code === "model_draft_missing")).toBe(false);
  });

  it("modifiesSchemaInThisStep is false", () => {
    expect(
      evaluateOperatorApprovalAuditSchemaPrApprovalPackage({ explicitUserApproval: true })
        .modifiesSchemaInThisStep,
    ).toBe(false);
  });

  it("createsMigrationInThisStep is false", () => {
    expect(
      evaluateOperatorApprovalAuditSchemaPrApprovalPackage({ explicitUserApproval: true })
        .createsMigrationInThisStep,
    ).toBe(false);
  });

  it("writesDataInThisStep is false", () => {
    expect(
      evaluateOperatorApprovalAuditSchemaPrApprovalPackage({ explicitUserApproval: true })
        .writesDataInThisStep,
    ).toBe(false);
  });

  it("uses schema PR readiness only without Prisma migration or DB write", () => {
    const readinessSpy = vi.spyOn(
      schemaPrReadinessModule,
      "evaluateOperatorApprovalAuditSchemaPrReadiness",
    );
    evaluateOperatorApprovalAuditSchemaPrApprovalPackage({ explicitUserApproval: true });
    expect(readinessSpy).toHaveBeenCalledTimes(1);
  });
});
