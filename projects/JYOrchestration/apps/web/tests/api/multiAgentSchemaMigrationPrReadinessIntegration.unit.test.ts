import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateSchemaMigrationPrReadinessIntegration } from "@/lib/agents/evaluateSchemaMigrationPrReadinessIntegration";
import * as agentSchemaReadinessModule from "@/lib/agents/evaluateAgentExecutionRecordSchemaPrReadiness";
import * as operatorSchemaReadinessModule from "@/lib/agents/evaluateOperatorApprovalAuditSchemaPrReadiness";
import * as writeAdapterIntegrationModule from "@/lib/agents/evaluateWriteAdapterDesignIntegration";

function checklistItem(
  report: ReturnType<typeof evaluateSchemaMigrationPrReadinessIntegration>,
  list: "schemaChecklist" | "migrationChecklist" | "safetyChecklist",
  item: string,
) {
  return report[list].find((c) => c.item === item);
}

function mockAgentSchemaReady(): ReturnType<
  typeof agentSchemaReadinessModule.evaluateAgentExecutionRecordSchemaPrReadiness
> {
  return {
    mode: "read_only_agent_execution_record_schema_pr_readiness",
    decision: "ready_for_schema_pr_plan",
    target: "agent_execution_record",
    sourceSchemaDecision: "ready_for_schema_proposal",
    sourceProposedTableName: "AgentExecutionRecord",
    sourceRequiresPrismaSchemaChange: true,
    sourceRequiresMigration: true,
    sourceFieldProposalCount: 3,
    sourceExcludedFieldCount: 2,
    sourceForbiddenFieldNames: ["rawPrompt"],
    modelCandidates: [{ modelName: "AgentExecutionRecord", modelDraft: "model {}", caution: "" }],
    migrationChecklist: [{ item: "migration", satisfied: true, reason: "ok" }],
    rollbackChecklist: [{ item: "rollback", satisfied: true, reason: "ok" }],
    retentionAccessChecklist: [{ item: "retention", satisfied: true, reason: "ok" }],
    forbiddenFieldChecklist: [{ item: "forbidden", satisfied: true, reason: "ok" }],
    requiresSeparatePr: true,
    modifiesSchemaInThisStep: false,
    createsMigrationInThisStep: false,
    writesDataInThisStep: false,
    findings: [],
  };
}

function mockOperatorSchemaReady(): ReturnType<
  typeof operatorSchemaReadinessModule.evaluateOperatorApprovalAuditSchemaPrReadiness
> {
  return {
    mode: "read_only_operator_approval_audit_schema_pr_readiness",
    decision: "ready_for_schema_pr_plan",
    target: "operator_approval",
    sourceSchemaDecision: "ready_for_schema_proposal",
    sourceProposedTableName: "OperatorApproval",
    sourceRequiresPrismaSchemaChange: true,
    sourceRequiresMigration: true,
    sourceFieldProposalCount: 2,
    sourceExcludedFieldCount: 1,
    sourceForbiddenFieldNames: ["rawReason"],
    modelCandidates: [
      { modelName: "OperatorApproval", modelDraft: "model {}", caution: "" },
      { modelName: "OperatorAuditEvent", modelDraft: "model {}", caution: "" },
    ],
    migrationChecklist: [{ item: "migration", satisfied: true, reason: "ok" }],
    rollbackChecklist: [{ item: "rollback", satisfied: true, reason: "ok" }],
    permissionAccessChecklist: [{ item: "permission", satisfied: true, reason: "ok" }],
    auditIntegrityChecklist: [{ item: "audit", satisfied: true, reason: "ok" }],
    forbiddenFieldChecklist: [{ item: "forbidden", satisfied: true, reason: "ok" }],
    requiresSeparatePr: true,
    modifiesSchemaInThisStep: false,
    createsMigrationInThisStep: false,
    writesDataInThisStep: false,
    findings: [],
  };
}

function mockWriteAdapterReady(): ReturnType<
  typeof writeAdapterIntegrationModule.evaluateWriteAdapterDesignIntegration
> {
  return {
    mode: "read_only_write_adapter_design_integration",
    decision: "ready_for_adapter_design",
    requestedAgentTarget: "agent_execution_record",
    requestedOperatorTarget: "operator_approval",
    normalizedAgentTarget: "agent_execution_record",
    normalizedOperatorTarget: "operator_approval",
    sourceAgentWireGateDecision: "ready_for_write_path_wire_approval",
    sourceOperatorWireGateDecision: "ready_for_write_path_wire_approval",
    sourceAgentWritePathDecision: "ready_for_write_path_design",
    sourceOperatorWritePathDecision: "ready_for_write_path_design",
    sourceAgentSchemaApprovalDecision: "ready_for_explicit_schema_pr_approval",
    sourceOperatorSchemaApprovalDecision: "ready_for_explicit_schema_pr_approval",
    sourceAgentSchemaApprovalTarget: "agent_execution_record",
    sourceOperatorSchemaApprovalTarget: "operator_approval",
    sourceAgentSchemaApprovalReferenceOnly: false,
    sourceOperatorSchemaApprovalReferenceOnly: false,
    sourceAgentBlockingFindingCodes: [],
    sourceOperatorBlockingFindingCodes: [],
    sourceAgentApprovalChecklistItemCount: 1,
    sourceOperatorApprovalChecklistItemCount: 1,
    sourceAgentRuntimeChecklistItemCount: 1,
    sourceOperatorRuntimeChecklistItemCount: 1,
    sourceOperatorPermissionChecklistItemCount: 1,
    sourceOperatorAuditChecklistItemCount: 1,
    agentAdapterTarget: "agent_execution_record",
    operatorAdapterTarget: "operator_approval",
    agentAdapterBoundaryName: "boundary",
    operatorAdapterBoundaryName: "boundary",
    agentFeatureFlagName: "flag",
    operatorFeatureFlagName: "flag",
    agentSanitizerCount: 1,
    operatorSanitizerCount: 1,
    agentForbiddenGuardCount: 1,
    operatorForbiddenGuardCount: 1,
    operatorPermissionGuardCount: 1,
    operatorAuditGuardCount: 1,
    adapterChecklist: [],
    safetyChecklist: [],
    rollbackChecklist: [],
    designsAdapterOnly: true,
    wiresAdapterInThisStep: false,
    writesDataInThisStep: false,
    callsPrismaInThisStep: false,
    modifiesSchemaInThisStep: false,
    createsMigrationInThisStep: false,
    wiresFeatureFlagInThisStep: false,
    findings: [],
  };
}

describe("multi-agent schema migration PR readiness integration stage 2-C", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mode is read_only_schema_migration_pr_readiness_integration", () => {
    expect(evaluateSchemaMigrationPrReadinessIntegration().mode).toBe(
      "read_only_schema_migration_pr_readiness_integration",
    );
  });

  it("default decision is defer", () => {
    expect(evaluateSchemaMigrationPrReadinessIntegration().decision).toBe("defer");
  });

  it("plansSchemaPrOnly is true", () => {
    expect(evaluateSchemaMigrationPrReadinessIntegration().plansSchemaPrOnly).toBe(true);
  });

  it("modifiesSchemaInThisStep is false", () => {
    expect(evaluateSchemaMigrationPrReadinessIntegration().modifiesSchemaInThisStep).toBe(false);
  });

  it("createsMigrationInThisStep is false", () => {
    expect(evaluateSchemaMigrationPrReadinessIntegration().createsMigrationInThisStep).toBe(false);
  });

  it("writesDataInThisStep is false", () => {
    expect(evaluateSchemaMigrationPrReadinessIntegration().writesDataInThisStep).toBe(false);
  });

  it("callsPrismaInThisStep is false", () => {
    expect(evaluateSchemaMigrationPrReadinessIntegration().callsPrismaInThisStep).toBe(false);
  });

  it("createsPullRequestInThisStep is false", () => {
    expect(evaluateSchemaMigrationPrReadinessIntegration().createsPullRequestInThisStep).toBe(false);
  });

  it("wiresAdapterInThisStep is false", () => {
    expect(evaluateSchemaMigrationPrReadinessIntegration().wiresAdapterInThisStep).toBe(false);
  });

  it("agent schema readiness blocked returns blocked", () => {
    vi.spyOn(agentSchemaReadinessModule, "evaluateAgentExecutionRecordSchemaPrReadiness").mockReturnValue({
      ...mockAgentSchemaReady(),
      decision: "blocked",
      findings: [{ severity: "blocking", code: "blocked", message: "blocked" }],
    });
    vi.spyOn(operatorSchemaReadinessModule, "evaluateOperatorApprovalAuditSchemaPrReadiness").mockReturnValue(
      mockOperatorSchemaReady(),
    );
    vi.spyOn(writeAdapterIntegrationModule, "evaluateWriteAdapterDesignIntegration").mockReturnValue(
      mockWriteAdapterReady(),
    );

    expect(evaluateSchemaMigrationPrReadinessIntegration().decision).toBe("blocked");
  });

  it("operator schema readiness blocked returns blocked", () => {
    vi.spyOn(agentSchemaReadinessModule, "evaluateAgentExecutionRecordSchemaPrReadiness").mockReturnValue(
      mockAgentSchemaReady(),
    );
    vi.spyOn(operatorSchemaReadinessModule, "evaluateOperatorApprovalAuditSchemaPrReadiness").mockReturnValue({
      ...mockOperatorSchemaReady(),
      decision: "blocked",
    });
    vi.spyOn(writeAdapterIntegrationModule, "evaluateWriteAdapterDesignIntegration").mockReturnValue(
      mockWriteAdapterReady(),
    );

    expect(evaluateSchemaMigrationPrReadinessIntegration().decision).toBe("blocked");
  });

  it("write adapter integration blocked returns blocked", () => {
    vi.spyOn(agentSchemaReadinessModule, "evaluateAgentExecutionRecordSchemaPrReadiness").mockReturnValue(
      mockAgentSchemaReady(),
    );
    vi.spyOn(operatorSchemaReadinessModule, "evaluateOperatorApprovalAuditSchemaPrReadiness").mockReturnValue(
      mockOperatorSchemaReady(),
    );
    vi.spyOn(writeAdapterIntegrationModule, "evaluateWriteAdapterDesignIntegration").mockReturnValue({
      ...mockWriteAdapterReady(),
      decision: "blocked",
    });

    expect(evaluateSchemaMigrationPrReadinessIntegration().decision).toBe("blocked");
  });

  it("writeAdapterIntegrationConfirmed=false returns defer", () => {
    const report = evaluateSchemaMigrationPrReadinessIntegration({
      writeAdapterIntegrationConfirmed: false,
    });
    expect(report.decision).toBe("defer");
    expect(report.findings.some((f) => f.code === "write_adapter_integration_not_confirmed")).toBe(true);
  });

  it("schema readiness ready and writeAdapterIntegrationConfirmed=true returns ready_for_schema_migration_pr_readiness", () => {
    vi.spyOn(agentSchemaReadinessModule, "evaluateAgentExecutionRecordSchemaPrReadiness").mockReturnValue(
      mockAgentSchemaReady(),
    );
    vi.spyOn(operatorSchemaReadinessModule, "evaluateOperatorApprovalAuditSchemaPrReadiness").mockReturnValue(
      mockOperatorSchemaReady(),
    );
    vi.spyOn(writeAdapterIntegrationModule, "evaluateWriteAdapterDesignIntegration").mockReturnValue(
      mockWriteAdapterReady(),
    );

    const report = evaluateSchemaMigrationPrReadinessIntegration({
      writeAdapterIntegrationConfirmed: true,
    });
    expect(report.decision).toBe("ready_for_schema_migration_pr_readiness");
    expect(report.findings.some((f) => f.code === "schema_migration_pr_readiness_ready")).toBe(true);
  });

  it("schemaChecklist includes agent model candidate available", () => {
    expect(
      checklistItem(
        evaluateSchemaMigrationPrReadinessIntegration(),
        "schemaChecklist",
        "agent model candidate available",
      ),
    ).toBeDefined();
  });

  it("schemaChecklist includes operator model candidate available", () => {
    expect(
      checklistItem(
        evaluateSchemaMigrationPrReadinessIntegration(),
        "schemaChecklist",
        "operator model candidate available",
      ),
    ).toBeDefined();
  });

  it("migrationChecklist includes no migration in this step satisfied", () => {
    expect(
      checklistItem(
        evaluateSchemaMigrationPrReadinessIntegration(),
        "migrationChecklist",
        "no migration in this step",
      )?.satisfied,
    ).toBe(true);
  });

  it("safetyChecklist includes no schema change in this step satisfied", () => {
    expect(
      checklistItem(
        evaluateSchemaMigrationPrReadinessIntegration(),
        "safetyChecklist",
        "no schema change in this step",
      )?.satisfied,
    ).toBe(true);
  });

  it("safetyChecklist includes no pull request creation in this step satisfied", () => {
    expect(
      checklistItem(
        evaluateSchemaMigrationPrReadinessIntegration(),
        "safetyChecklist",
        "no pull request creation in this step",
      )?.satisfied,
    ).toBe(true);
  });

  it("defer state does not include schema_migration_pr_readiness_ready finding", () => {
    expect(
      evaluateSchemaMigrationPrReadinessIntegration().findings.some(
        (f) => f.code === "schema_migration_pr_readiness_ready",
      ),
    ).toBe(false);
  });

  it("blocked state includes schema_migration_pr_readiness_blocked finding", () => {
    vi.spyOn(agentSchemaReadinessModule, "evaluateAgentExecutionRecordSchemaPrReadiness").mockReturnValue({
      ...mockAgentSchemaReady(),
      decision: "blocked",
    });
    vi.spyOn(operatorSchemaReadinessModule, "evaluateOperatorApprovalAuditSchemaPrReadiness").mockReturnValue(
      mockOperatorSchemaReady(),
    );
    vi.spyOn(writeAdapterIntegrationModule, "evaluateWriteAdapterDesignIntegration").mockReturnValue(
      mockWriteAdapterReady(),
    );

    const report = evaluateSchemaMigrationPrReadinessIntegration();
    expect(report.decision).toBe("blocked");
    expect(report.findings.some((f) => f.code === "schema_migration_pr_readiness_blocked")).toBe(true);
  });

  it("operatorPermissionChecklistCount matches permissionAccessChecklist length", () => {
    vi.spyOn(agentSchemaReadinessModule, "evaluateAgentExecutionRecordSchemaPrReadiness").mockReturnValue(
      mockAgentSchemaReady(),
    );
    vi.spyOn(operatorSchemaReadinessModule, "evaluateOperatorApprovalAuditSchemaPrReadiness").mockReturnValue(
      mockOperatorSchemaReady(),
    );
    vi.spyOn(writeAdapterIntegrationModule, "evaluateWriteAdapterDesignIntegration").mockReturnValue(
      mockWriteAdapterReady(),
    );

    const report = evaluateSchemaMigrationPrReadinessIntegration();
    expect(report.operatorPermissionChecklistCount).toBe(1);
    expect(report.operatorAuditIntegrityChecklistCount).toBe(1);
    expect(report.operatorRetentionChecklistCount).toBe(0);
  });

  it("report includes sourceAgentSchemaTarget and source trace fields", () => {
    vi.spyOn(agentSchemaReadinessModule, "evaluateAgentExecutionRecordSchemaPrReadiness").mockReturnValue(
      mockAgentSchemaReady(),
    );
    vi.spyOn(operatorSchemaReadinessModule, "evaluateOperatorApprovalAuditSchemaPrReadiness").mockReturnValue(
      mockOperatorSchemaReady(),
    );
    vi.spyOn(writeAdapterIntegrationModule, "evaluateWriteAdapterDesignIntegration").mockReturnValue(
      mockWriteAdapterReady(),
    );

    const report = evaluateSchemaMigrationPrReadinessIntegration();
    expect(report.sourceAgentSchemaTarget).toBe("agent_execution_record");
    expect(report.sourceOperatorSchemaTarget).toBe("operator_approval");
    expect(report.sourceAgentRequiresSchemaChange).toBe(true);
    expect(report.sourceOperatorRequiresMigration).toBe(true);
    expect(report.sourceWriteAdapterAgentWireGateDecision).toBe("ready_for_write_path_wire_approval");
    expect(report.sourceWriteAdapterOperatorWireGateDecision).toBe("ready_for_write_path_wire_approval");
    expect(Array.isArray(report.sourceWriteAdapterAgentBlockingFindingCodes)).toBe(true);
    expect(Array.isArray(report.sourceWriteAdapterOperatorBlockingFindingCodes)).toBe(true);
  });

  it("write adapter defer with confirmed true and schema ready returns ready", () => {
    vi.spyOn(agentSchemaReadinessModule, "evaluateAgentExecutionRecordSchemaPrReadiness").mockReturnValue(
      mockAgentSchemaReady(),
    );
    vi.spyOn(operatorSchemaReadinessModule, "evaluateOperatorApprovalAuditSchemaPrReadiness").mockReturnValue(
      mockOperatorSchemaReady(),
    );
    vi.spyOn(writeAdapterIntegrationModule, "evaluateWriteAdapterDesignIntegration").mockReturnValue({
      ...mockWriteAdapterReady(),
      decision: "defer",
    });

    const report = evaluateSchemaMigrationPrReadinessIntegration({
      writeAdapterIntegrationConfirmed: true,
    });
    expect(report.decision).toBe("ready_for_schema_migration_pr_readiness");
    expect(report.findings.some((f) => f.code === "write_adapter_integration_deferred_but_confirmed")).toBe(
      true,
    );
  });

  it("write adapter blocked with confirmed true returns blocked", () => {
    vi.spyOn(agentSchemaReadinessModule, "evaluateAgentExecutionRecordSchemaPrReadiness").mockReturnValue(
      mockAgentSchemaReady(),
    );
    vi.spyOn(operatorSchemaReadinessModule, "evaluateOperatorApprovalAuditSchemaPrReadiness").mockReturnValue(
      mockOperatorSchemaReady(),
    );
    vi.spyOn(writeAdapterIntegrationModule, "evaluateWriteAdapterDesignIntegration").mockReturnValue({
      ...mockWriteAdapterReady(),
      decision: "blocked",
    });

    expect(
      evaluateSchemaMigrationPrReadinessIntegration({ writeAdapterIntegrationConfirmed: true }).decision,
    ).toBe("blocked");
  });

  it("agentTarget unknown returns blocked without ready finding", () => {
    vi.spyOn(agentSchemaReadinessModule, "evaluateAgentExecutionRecordSchemaPrReadiness").mockReturnValue(
      mockAgentSchemaReady(),
    );
    vi.spyOn(operatorSchemaReadinessModule, "evaluateOperatorApprovalAuditSchemaPrReadiness").mockReturnValue(
      mockOperatorSchemaReady(),
    );
    vi.spyOn(writeAdapterIntegrationModule, "evaluateWriteAdapterDesignIntegration").mockReturnValue(
      mockWriteAdapterReady(),
    );

    const report = evaluateSchemaMigrationPrReadinessIntegration({
      agentTarget: "unknown",
      writeAdapterIntegrationConfirmed: true,
    });
    expect(report.normalizedAgentTarget).toBe("unknown");
    expect(report.decision).toBe("blocked");
    expect(report.findings.some((f) => f.code === "schema_migration_pr_readiness_ready")).toBe(false);
  });

  it("operatorTarget unknown returns blocked without ready finding", () => {
    vi.spyOn(agentSchemaReadinessModule, "evaluateAgentExecutionRecordSchemaPrReadiness").mockReturnValue(
      mockAgentSchemaReady(),
    );
    vi.spyOn(operatorSchemaReadinessModule, "evaluateOperatorApprovalAuditSchemaPrReadiness").mockReturnValue(
      mockOperatorSchemaReady(),
    );
    vi.spyOn(writeAdapterIntegrationModule, "evaluateWriteAdapterDesignIntegration").mockReturnValue(
      mockWriteAdapterReady(),
    );

    const report = evaluateSchemaMigrationPrReadinessIntegration({
      operatorTarget: "unknown",
      writeAdapterIntegrationConfirmed: true,
    });
    expect(report.normalizedOperatorTarget).toBe("unknown");
    expect(report.decision).toBe("blocked");
    expect(report.findings.some((f) => f.code === "schema_migration_pr_readiness_ready")).toBe(false);
  });

  it("evaluator does not modify schema migration DB Prisma PR or adapter wire", () => {
    const agentSpy = vi.spyOn(agentSchemaReadinessModule, "evaluateAgentExecutionRecordSchemaPrReadiness");
    const operatorSpy = vi.spyOn(operatorSchemaReadinessModule, "evaluateOperatorApprovalAuditSchemaPrReadiness");
    const adapterSpy = vi.spyOn(writeAdapterIntegrationModule, "evaluateWriteAdapterDesignIntegration");

    const report = evaluateSchemaMigrationPrReadinessIntegration();

    expect(agentSpy).toHaveBeenCalled();
    expect(operatorSpy).toHaveBeenCalled();
    expect(adapterSpy).toHaveBeenCalled();
    expect(report.modifiesSchemaInThisStep).toBe(false);
    expect(report.createsMigrationInThisStep).toBe(false);
    expect(report.writesDataInThisStep).toBe(false);
    expect(report.callsPrismaInThisStep).toBe(false);
    expect(report.createsPullRequestInThisStep).toBe(false);
    expect(report.wiresAdapterInThisStep).toBe(false);
  });
});
