import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateOperatorApprovalAuditWritePathWireApprovalGate } from "@/lib/agents/evaluateOperatorApprovalAuditWritePathWireApprovalGate";
import * as schemaApprovalModule from "@/lib/agents/evaluateOperatorApprovalAuditSchemaPrApprovalPackage";
import * as writePathModule from "@/lib/agents/evaluateOperatorApprovalAuditWritePathDesign";

function checklistItem(
  report: ReturnType<typeof evaluateOperatorApprovalAuditWritePathWireApprovalGate>,
  list:
    | "approvalChecklist"
    | "runtimeChecklist"
    | "rollbackChecklist"
    | "permissionChecklist"
    | "auditChecklist",
  item: string,
) {
  return report[list].find((c) => c.item === item);
}

function mockWritePathReady(
  target: "operator_approval" | "audit_event" = "operator_approval",
): ReturnType<typeof writePathModule.evaluateOperatorApprovalAuditWritePathDesign> {
  return {
    mode: "read_only_operator_approval_audit_write_path_design",
    decision: "ready_for_write_path_design",
    target,
    featureFlagName: "JYO_OPERATOR_APPROVAL_AUDIT_WRITE_PATH",
    featureFlagDefault: "off",
    proposedWriteEntrypoints: ["Operator approval decision submit boundary"],
    proposedPermissionGuards: ["requireOperatorRole"],
    proposedAuditIntegrityGuards: ["ensureAuditEventAppendOnly"],
    proposedSanitizers: ["sanitizeReasonSummary"],
    forbiddenFieldGuards: ["rejectRawReason"],
    validationChecklist: [],
    rollbackPlan: ["feature flag off로 approval/audit write path 비활성화", "write adapter no-op 전환"],
    requiresSchemaApplied: true,
    requiresMigrationApplied: true,
    requiresFeatureFlag: true,
    requiresPermissionGuard: true,
    requiresAuditIntegrityGuard: true,
    requiresForbiddenFieldGuard: true,
    requiresWritePathRollback: true,
    requiresOperatorApproval: true,
    sourceSchemaDecision: "ready_for_schema_proposal",
    sourceSchemaTarget: target,
    sourceProposedTableName: "OperatorApproval",
    sourceRequiresPrismaSchemaChange: true,
    sourceRequiresMigration: true,
    findings: [],
  };
}

function mockSchemaApprovalReady(
  target: "operator_approval" | "audit_event" = "operator_approval",
): ReturnType<typeof schemaApprovalModule.evaluateOperatorApprovalAuditSchemaPrApprovalPackage> {
  return {
    mode: "read_only_operator_approval_audit_schema_pr_approval_package",
    decision: "ready_for_explicit_schema_pr_approval",
    target,
    sourceReadinessDecision: "ready_for_schema_pr_plan",
    sourceSchemaDecision: "ready_for_schema_proposal",
    sourceProposedTableName: "OperatorApproval",
    sourceRequiresPrismaSchemaChange: true,
    sourceRequiresMigration: true,
    sourceFieldProposalCount: 1,
    sourceExcludedFieldCount: 1,
    sourceForbiddenFieldNames: ["rawReason"],
    modelDraft: "model OperatorApproval { id String @id }",
    modelName: "OperatorApproval",
    approvalChecklist: [],
    migrationChecklist: [{ item: "migration", satisfied: true, reason: "ok" }],
    rollbackChecklist: [{ item: "rollback", satisfied: true, reason: "ok" }],
    permissionAccessChecklist: [{ item: "permission", satisfied: true, reason: "ok" }],
    auditIntegrityChecklist: [{ item: "audit", satisfied: true, reason: "ok" }],
    forbiddenFieldChecklist: [{ item: "forbidden", satisfied: true, reason: "ok" }],
    requiresExplicitUserApproval: true,
    explicitUserApprovalProvided: true,
    requiresSeparatePr: true,
    modifiesSchemaInThisStep: false,
    createsMigrationInThisStep: false,
    writesDataInThisStep: false,
    findings: [],
  };
}

const ALL_CONFIRMATIONS = {
  explicitUserApproval: true,
  schemaAppliedConfirmed: true,
  migrationAppliedConfirmed: true,
  featureFlagWireApproved: true,
  writeAdapterImplementedConfirmed: true,
  permissionModelConfirmed: true,
  auditTrailConfirmed: true,
} as const;

describe("multi-agent operator approval audit write path wire approval gate stage 2-30", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mode is read_only_operator_approval_audit_write_path_wire_approval_gate", () => {
    expect(evaluateOperatorApprovalAuditWritePathWireApprovalGate().mode).toBe(
      "read_only_operator_approval_audit_write_path_wire_approval_gate",
    );
  });

  it("default decision is defer", () => {
    expect(evaluateOperatorApprovalAuditWritePathWireApprovalGate().decision).toBe("defer");
  });

  it("explicitUserApproval=false returns defer", () => {
    expect(
      evaluateOperatorApprovalAuditWritePathWireApprovalGate({
        ...ALL_CONFIRMATIONS,
        explicitUserApproval: false,
      }).decision,
    ).toBe("defer");
  });

  it("schemaAppliedConfirmed=false returns defer", () => {
    expect(
      evaluateOperatorApprovalAuditWritePathWireApprovalGate({
        ...ALL_CONFIRMATIONS,
        schemaAppliedConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("migrationAppliedConfirmed=false returns defer", () => {
    expect(
      evaluateOperatorApprovalAuditWritePathWireApprovalGate({
        ...ALL_CONFIRMATIONS,
        migrationAppliedConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("featureFlagWireApproved=false returns defer", () => {
    expect(
      evaluateOperatorApprovalAuditWritePathWireApprovalGate({
        ...ALL_CONFIRMATIONS,
        featureFlagWireApproved: false,
      }).decision,
    ).toBe("defer");
  });

  it("writeAdapterImplementedConfirmed=false returns defer", () => {
    expect(
      evaluateOperatorApprovalAuditWritePathWireApprovalGate({
        ...ALL_CONFIRMATIONS,
        writeAdapterImplementedConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("permissionModelConfirmed=false returns defer", () => {
    expect(
      evaluateOperatorApprovalAuditWritePathWireApprovalGate({
        ...ALL_CONFIRMATIONS,
        permissionModelConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("auditTrailConfirmed=false returns defer", () => {
    expect(
      evaluateOperatorApprovalAuditWritePathWireApprovalGate({
        ...ALL_CONFIRMATIONS,
        auditTrailConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("all confirmations true with upstream ready returns ready_for_write_path_wire_approval", () => {
    vi.spyOn(writePathModule, "evaluateOperatorApprovalAuditWritePathDesign").mockReturnValue(
      mockWritePathReady("operator_approval"),
    );
    vi.spyOn(schemaApprovalModule, "evaluateOperatorApprovalAuditSchemaPrApprovalPackage").mockReturnValue(
      mockSchemaApprovalReady("operator_approval"),
    );

    const report = evaluateOperatorApprovalAuditWritePathWireApprovalGate(ALL_CONFIRMATIONS);
    expect(report.decision).toBe("ready_for_write_path_wire_approval");
  });

  it("operator_approval target uses schemaApprovalTarget operator_approval", () => {
    const schemaSpy = vi.spyOn(
      schemaApprovalModule,
      "evaluateOperatorApprovalAuditSchemaPrApprovalPackage",
    );
    evaluateOperatorApprovalAuditWritePathWireApprovalGate({ target: "operator_approval" });
    expect(schemaSpy).toHaveBeenCalledWith(
      expect.objectContaining({ target: "operator_approval" }),
    );
  });

  it("audit_event target uses schemaApprovalTarget audit_event", () => {
    const schemaSpy = vi.spyOn(
      schemaApprovalModule,
      "evaluateOperatorApprovalAuditSchemaPrApprovalPackage",
    );
    evaluateOperatorApprovalAuditWritePathWireApprovalGate({ target: "audit_event" });
    expect(schemaSpy).toHaveBeenCalledWith(expect.objectContaining({ target: "audit_event" }));
  });

  it("operator_override target is defer not ready even with all confirmations", () => {
    vi.spyOn(writePathModule, "evaluateOperatorApprovalAuditWritePathDesign").mockReturnValue(
      mockWritePathReady("operator_approval"),
    );
    vi.spyOn(schemaApprovalModule, "evaluateOperatorApprovalAuditSchemaPrApprovalPackage").mockReturnValue(
      mockSchemaApprovalReady("operator_approval"),
    );

    const report = evaluateOperatorApprovalAuditWritePathWireApprovalGate({
      target: "operator_override",
      ...ALL_CONFIRMATIONS,
    });
    expect(report.schemaApprovalReferenceOnly).toBe(true);
    expect(report.sourceSchemaApprovalTarget).toBe("operator_override");
    expect(report.decision).toBe("defer");
  });

  it("rollback_approval target is defer not ready even with all confirmations", () => {
    vi.spyOn(writePathModule, "evaluateOperatorApprovalAuditWritePathDesign").mockReturnValue(
      mockWritePathReady("operator_approval"),
    );
    vi.spyOn(schemaApprovalModule, "evaluateOperatorApprovalAuditSchemaPrApprovalPackage").mockReturnValue(
      mockSchemaApprovalReady("operator_approval"),
    );

    const report = evaluateOperatorApprovalAuditWritePathWireApprovalGate({
      target: "rollback_approval",
      ...ALL_CONFIRMATIONS,
    });
    expect(report.schemaApprovalReferenceOnly).toBe(true);
    expect(report.sourceSchemaApprovalTarget).toBe("rollback_approval");
    expect(report.decision).toBe("defer");
  });

  it("defer state does not include operator_write_path_wire_approval_ready finding", () => {
    expect(
      evaluateOperatorApprovalAuditWritePathWireApprovalGate().findings.some(
        (f) => f.code === "operator_write_path_wire_approval_ready",
      ),
    ).toBe(false);
  });

  it("report includes source trace fields", () => {
    const report = evaluateOperatorApprovalAuditWritePathWireApprovalGate({ target: "operator_approval" });
    expect(report.sourceWritePathTarget).toBe("operator_approval");
    expect(report.sourceSchemaApprovalMode).toBe("primary");
    expect(report.sourcePermissionChecklistItemCount).toBeGreaterThanOrEqual(0);
    expect(report.sourceAuditChecklistItemCount).toBeGreaterThanOrEqual(0);
  });

  it("unknown target has blocking trace or unknown finding", () => {
    const report = evaluateOperatorApprovalAuditWritePathWireApprovalGate({ target: "unknown" });
    expect(report.decision).toBe("blocked");
    expect(
      report.sourceBlockingFindingCodes.length > 0 ||
        report.findings.some((f) => f.code === "unknown_operator_write_path_target"),
    ).toBe(true);
  });

  it("unknown target returns blocked", () => {
    expect(
      evaluateOperatorApprovalAuditWritePathWireApprovalGate({ target: "unknown" }).decision,
    ).toBe("blocked");
  });

  it("requiresExplicitUserApproval is true", () => {
    expect(evaluateOperatorApprovalAuditWritePathWireApprovalGate().requiresExplicitUserApproval).toBe(
      true,
    );
  });

  it("requiresSchemaApplied is true", () => {
    expect(evaluateOperatorApprovalAuditWritePathWireApprovalGate().requiresSchemaApplied).toBe(true);
  });

  it("requiresMigrationApplied is true", () => {
    expect(evaluateOperatorApprovalAuditWritePathWireApprovalGate().requiresMigrationApplied).toBe(true);
  });

  it("requiresFeatureFlagWireApproval is true", () => {
    expect(
      evaluateOperatorApprovalAuditWritePathWireApprovalGate().requiresFeatureFlagWireApproval,
    ).toBe(true);
  });

  it("requiresWriteAdapterImplemented is true", () => {
    expect(
      evaluateOperatorApprovalAuditWritePathWireApprovalGate().requiresWriteAdapterImplemented,
    ).toBe(true);
  });

  it("requiresPermissionModelConfirmed is true", () => {
    expect(
      evaluateOperatorApprovalAuditWritePathWireApprovalGate().requiresPermissionModelConfirmed,
    ).toBe(true);
  });

  it("requiresAuditTrailConfirmed is true", () => {
    expect(evaluateOperatorApprovalAuditWritePathWireApprovalGate().requiresAuditTrailConfirmed).toBe(
      true,
    );
  });

  it("wiresWritePathInThisStep is false", () => {
    expect(evaluateOperatorApprovalAuditWritePathWireApprovalGate().wiresWritePathInThisStep).toBe(false);
  });

  it("writesDataInThisStep is false", () => {
    expect(evaluateOperatorApprovalAuditWritePathWireApprovalGate().writesDataInThisStep).toBe(false);
  });

  it("callsPrismaInThisStep is false", () => {
    expect(evaluateOperatorApprovalAuditWritePathWireApprovalGate().callsPrismaInThisStep).toBe(false);
  });

  it("modifiesSchemaInThisStep is false", () => {
    expect(evaluateOperatorApprovalAuditWritePathWireApprovalGate().modifiesSchemaInThisStep).toBe(false);
  });

  it("createsMigrationInThisStep is false", () => {
    expect(evaluateOperatorApprovalAuditWritePathWireApprovalGate().createsMigrationInThisStep).toBe(false);
  });

  it("approvalChecklist includes no data write in this step satisfied", () => {
    expect(
      checklistItem(
        evaluateOperatorApprovalAuditWritePathWireApprovalGate(),
        "approvalChecklist",
        "no data write in this step",
      )?.satisfied,
    ).toBe(true);
  });

  it("permissionChecklist includes least privilege reviewed", () => {
    expect(
      checklistItem(
        evaluateOperatorApprovalAuditWritePathWireApprovalGate(),
        "permissionChecklist",
        "least privilege reviewed",
      ),
    ).toBeDefined();
  });

  it("auditChecklist includes audit integrity reviewed", () => {
    expect(
      checklistItem(
        evaluateOperatorApprovalAuditWritePathWireApprovalGate(),
        "auditChecklist",
        "audit integrity reviewed",
      ),
    ).toBeDefined();
  });

  it("rollbackChecklist includes audit trail rollback impact reviewed", () => {
    expect(
      checklistItem(
        evaluateOperatorApprovalAuditWritePathWireApprovalGate(),
        "rollbackChecklist",
        "audit trail rollback impact reviewed",
      ),
    ).toBeDefined();
  });

  it("ready state includes operator_write_path_wire_approval_ready finding", () => {
    vi.spyOn(writePathModule, "evaluateOperatorApprovalAuditWritePathDesign").mockReturnValue(
      mockWritePathReady("operator_approval"),
    );
    vi.spyOn(schemaApprovalModule, "evaluateOperatorApprovalAuditSchemaPrApprovalPackage").mockReturnValue(
      mockSchemaApprovalReady("operator_approval"),
    );

    const report = evaluateOperatorApprovalAuditWritePathWireApprovalGate(ALL_CONFIRMATIONS);
    expect(report.decision).toBe("ready_for_write_path_wire_approval");
    expect(report.findings.some((f) => f.code === "operator_write_path_wire_approval_ready")).toBe(
      true,
    );
  });

  it("evaluator does not wire write path DB Prisma schema or migration", () => {
    const writeSpy = vi.spyOn(writePathModule, "evaluateOperatorApprovalAuditWritePathDesign");
    const schemaSpy = vi.spyOn(
      schemaApprovalModule,
      "evaluateOperatorApprovalAuditSchemaPrApprovalPackage",
    );

    const report = evaluateOperatorApprovalAuditWritePathWireApprovalGate(ALL_CONFIRMATIONS);

    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(schemaSpy).toHaveBeenCalledTimes(1);
    expect(report.wiresWritePathInThisStep).toBe(false);
    expect(report.writesDataInThisStep).toBe(false);
    expect(report.callsPrismaInThisStep).toBe(false);
    expect(report.modifiesSchemaInThisStep).toBe(false);
    expect(report.createsMigrationInThisStep).toBe(false);
  });
});
