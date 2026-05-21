import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateWritePathWireCandidateVerification } from "@/lib/agents/evaluateWritePathWireCandidateVerification";
import * as agentWireGateModule from "@/lib/agents/evaluateAgentExecutionRecordWritePathWireApprovalGate";
import * as operatorWireGateModule from "@/lib/agents/evaluateOperatorApprovalAuditWritePathWireApprovalGate";
import * as schemaMigrationModule from "@/lib/agents/evaluateSchemaMigrationPrReadinessIntegration";

function checklistItem(
  report: ReturnType<typeof evaluateWritePathWireCandidateVerification>,
  list: "candidateChecklist" | "safetyChecklist" | "rollbackChecklist",
  item: string,
) {
  return report[list].find((c) => c.item === item);
}

function mockAgentWireGateReady(): ReturnType<
  typeof agentWireGateModule.evaluateAgentExecutionRecordWritePathWireApprovalGate
> {
  return {
    mode: "read_only_agent_execution_record_write_path_wire_approval_gate",
    decision: "ready_for_write_path_wire_approval",
    sourceWritePathDecision: "ready_for_write_path_design",
    sourceSchemaApprovalDecision: "ready_for_explicit_schema_pr_approval",
    sourceSchemaApprovalTarget: "agent_execution_record",
    schemaApprovalReferenceOnly: false,
    sourceWritePathTarget: "agent_execution_record",
    sourceSchemaApprovalMode: "read_only_agent_execution_record_schema_pr_approval_package",
    target: "agent_execution_record",
    explicitUserApprovalProvided: true,
    schemaAppliedConfirmed: true,
    migrationAppliedConfirmed: true,
    featureFlagWireApproved: true,
    writeAdapterImplementedConfirmed: true,
    sourceWritePathFeatureFlagName: "JYO_AGENT_EXECUTION_RECORD_WRITE_PATH",
    sourceWritePathRollbackPlan: ["rollback"],
    sourceSchemaApprovalRollbackItemCount: 1,
    sourceSchemaApprovalMigrationItemCount: 1,
    sourceBlockingFindingCodes: [],
    approvalChecklist: [],
    runtimeChecklist: [],
    rollbackChecklist: [],
    requiresExplicitUserApproval: true,
    requiresSchemaApplied: true,
    requiresMigrationApplied: true,
    requiresFeatureFlagWireApproval: true,
    requiresWriteAdapterImplemented: true,
    wiresWritePathInThisStep: false,
    writesDataInThisStep: false,
    callsPrismaInThisStep: false,
    modifiesSchemaInThisStep: false,
    createsMigrationInThisStep: false,
    findings: [],
  };
}

function mockOperatorWireGateReady(): ReturnType<
  typeof operatorWireGateModule.evaluateOperatorApprovalAuditWritePathWireApprovalGate
> {
  return {
    mode: "read_only_operator_approval_audit_write_path_wire_approval_gate",
    decision: "ready_for_write_path_wire_approval",
    sourceWritePathDecision: "ready_for_write_path_design",
    sourceSchemaApprovalDecision: "ready_for_explicit_schema_pr_approval",
    sourceSchemaApprovalTarget: "operator_approval",
    schemaApprovalReferenceOnly: false,
    sourceWritePathTarget: "operator_approval",
    sourceSchemaApprovalMode: "read_only_operator_approval_audit_schema_pr_approval_package",
    sourcePermissionChecklistItemCount: 1,
    sourceAuditChecklistItemCount: 1,
    target: "operator_approval",
    explicitUserApprovalProvided: true,
    schemaAppliedConfirmed: true,
    migrationAppliedConfirmed: true,
    featureFlagWireApproved: true,
    writeAdapterImplementedConfirmed: true,
    permissionModelConfirmed: true,
    auditTrailConfirmed: true,
    sourceWritePathFeatureFlagName: "JYO_OPERATOR_APPROVAL_AUDIT_WRITE_PATH",
    sourceWritePathRollbackPlan: ["rollback"],
    sourceSchemaApprovalRollbackItemCount: 1,
    sourceSchemaApprovalMigrationItemCount: 1,
    sourceBlockingFindingCodes: [],
    approvalChecklist: [],
    runtimeChecklist: [],
    rollbackChecklist: [],
    permissionChecklist: [{ item: "permission", satisfied: true, reason: "ok" }],
    auditChecklist: [{ item: "audit", satisfied: true, reason: "ok" }],
    requiresExplicitUserApproval: true,
    requiresSchemaApplied: true,
    requiresMigrationApplied: true,
    requiresFeatureFlagWireApproval: true,
    requiresWriteAdapterImplemented: true,
    requiresPermissionModelConfirmed: true,
    requiresAuditTrailConfirmed: true,
    wiresWritePathInThisStep: false,
    writesDataInThisStep: false,
    callsPrismaInThisStep: false,
    modifiesSchemaInThisStep: false,
    createsMigrationInThisStep: false,
    findings: [],
  };
}

function mockSchemaMigrationReady(): ReturnType<
  typeof schemaMigrationModule.evaluateSchemaMigrationPrReadinessIntegration
> {
  return {
    mode: "read_only_schema_migration_pr_readiness_integration",
    decision: "ready_for_schema_migration_pr_readiness",
    requestedAgentTarget: "agent_execution_record",
    requestedOperatorTarget: "operator_approval",
    normalizedAgentTarget: "agent_execution_record",
    normalizedOperatorTarget: "operator_approval",
    sourceAgentSchemaPrReadinessDecision: "ready_for_schema_pr_plan",
    sourceOperatorSchemaPrReadinessDecision: "ready_for_schema_pr_plan",
    sourceWriteAdapterIntegrationDecision: "ready_for_adapter_design",
    sourceAgentSchemaTarget: "agent_execution_record",
    sourceOperatorSchemaTarget: "operator_approval",
    sourceAgentRequiresSchemaChange: true,
    sourceOperatorRequiresSchemaChange: true,
    sourceAgentRequiresMigration: true,
    sourceOperatorRequiresMigration: true,
    sourceAgentRequiresSeparatePr: true,
    sourceOperatorRequiresSeparatePr: true,
    sourceWriteAdapterRequestedAgentTarget: "agent_execution_record",
    sourceWriteAdapterRequestedOperatorTarget: "operator_approval",
    sourceWriteAdapterNormalizedAgentTarget: "agent_execution_record",
    sourceWriteAdapterNormalizedOperatorTarget: "operator_approval",
    sourceWriteAdapterAgentWireGateDecision: "ready_for_write_path_wire_approval",
    sourceWriteAdapterOperatorWireGateDecision: "ready_for_write_path_wire_approval",
    sourceWriteAdapterAgentWritePathDecision: "ready_for_write_path_design",
    sourceWriteAdapterOperatorWritePathDecision: "ready_for_write_path_design",
    sourceWriteAdapterAgentBlockingFindingCodes: [],
    sourceWriteAdapterOperatorBlockingFindingCodes: [],
    agentProposedTableName: "AgentExecutionRecord",
    operatorProposedTableNames: ["OperatorApproval"],
    agentModelCandidateCount: 1,
    operatorModelCandidateCount: 1,
    agentRequiredFieldCount: 1,
    operatorRequiredFieldCount: 1,
    agentForbiddenFieldChecklistCount: 1,
    operatorForbiddenFieldChecklistCount: 1,
    agentMigrationChecklistCount: 1,
    operatorMigrationChecklistCount: 1,
    agentRollbackChecklistCount: 1,
    operatorRollbackChecklistCount: 1,
    agentRetentionChecklistCount: 1,
    operatorRetentionChecklistCount: 0,
    operatorPermissionChecklistCount: 1,
    operatorAuditIntegrityChecklistCount: 1,
    schemaChecklist: [],
    migrationChecklist: [],
    rollbackChecklist: [],
    safetyChecklist: [],
    plansSchemaPrOnly: true,
    modifiesSchemaInThisStep: false,
    createsMigrationInThisStep: false,
    writesDataInThisStep: false,
    callsPrismaInThisStep: false,
    createsPullRequestInThisStep: false,
    wiresAdapterInThisStep: false,
    findings: [],
  };
}

const ALL_CONFIRMATIONS = {
  agentExplicitUserApproval: true,
  operatorExplicitUserApproval: true,
  agentSchemaAppliedConfirmed: true,
  operatorSchemaAppliedConfirmed: true,
  agentMigrationAppliedConfirmed: true,
  operatorMigrationAppliedConfirmed: true,
  agentFeatureFlagWireApproved: true,
  operatorFeatureFlagWireApproved: true,
  agentWriteAdapterImplementedConfirmed: true,
  operatorWriteAdapterImplementedConfirmed: true,
  operatorPermissionModelConfirmed: true,
  operatorAuditTrailConfirmed: true,
  schemaMigrationReadinessConfirmed: true,
} as const;

describe("multi-agent write path wire candidate verification stage 2-D", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mode is read_only_write_path_wire_candidate_verification", () => {
    expect(evaluateWritePathWireCandidateVerification().mode).toBe(
      "read_only_write_path_wire_candidate_verification",
    );
  });

  it("default decision is defer", () => {
    expect(evaluateWritePathWireCandidateVerification().decision).toBe("defer");
  });

  it("verifiesCandidateOnly is true", () => {
    expect(evaluateWritePathWireCandidateVerification().verifiesCandidateOnly).toBe(true);
  });

  it("wiresWritePathInThisStep is false", () => {
    expect(evaluateWritePathWireCandidateVerification().wiresWritePathInThisStep).toBe(false);
  });

  it("wiresAdapterInThisStep is false", () => {
    expect(evaluateWritePathWireCandidateVerification().wiresAdapterInThisStep).toBe(false);
  });

  it("writesDataInThisStep is false", () => {
    expect(evaluateWritePathWireCandidateVerification().writesDataInThisStep).toBe(false);
  });

  it("callsPrismaInThisStep is false", () => {
    expect(evaluateWritePathWireCandidateVerification().callsPrismaInThisStep).toBe(false);
  });

  it("modifiesSchemaInThisStep is false", () => {
    expect(evaluateWritePathWireCandidateVerification().modifiesSchemaInThisStep).toBe(false);
  });

  it("createsMigrationInThisStep is false", () => {
    expect(evaluateWritePathWireCandidateVerification().createsMigrationInThisStep).toBe(false);
  });

  it("wiresFeatureFlagInThisStep is false", () => {
    expect(evaluateWritePathWireCandidateVerification().wiresFeatureFlagInThisStep).toBe(false);
  });

  it("changesRuntimeRouteInThisStep is false", () => {
    expect(evaluateWritePathWireCandidateVerification().changesRuntimeRouteInThisStep).toBe(false);
  });

  it("agent wire gate blocked returns blocked", () => {
    vi.spyOn(agentWireGateModule, "evaluateAgentExecutionRecordWritePathWireApprovalGate").mockReturnValue({
      ...mockAgentWireGateReady(),
      decision: "blocked",
    });
    vi.spyOn(operatorWireGateModule, "evaluateOperatorApprovalAuditWritePathWireApprovalGate").mockReturnValue(
      mockOperatorWireGateReady(),
    );
    vi.spyOn(schemaMigrationModule, "evaluateSchemaMigrationPrReadinessIntegration").mockReturnValue(
      mockSchemaMigrationReady(),
    );

    expect(evaluateWritePathWireCandidateVerification(ALL_CONFIRMATIONS).decision).toBe("blocked");
  });

  it("operator wire gate blocked returns blocked", () => {
    vi.spyOn(agentWireGateModule, "evaluateAgentExecutionRecordWritePathWireApprovalGate").mockReturnValue(
      mockAgentWireGateReady(),
    );
    vi.spyOn(operatorWireGateModule, "evaluateOperatorApprovalAuditWritePathWireApprovalGate").mockReturnValue({
      ...mockOperatorWireGateReady(),
      decision: "blocked",
    });
    vi.spyOn(schemaMigrationModule, "evaluateSchemaMigrationPrReadinessIntegration").mockReturnValue(
      mockSchemaMigrationReady(),
    );

    expect(evaluateWritePathWireCandidateVerification(ALL_CONFIRMATIONS).decision).toBe("blocked");
  });

  it("schema migration readiness blocked returns blocked", () => {
    vi.spyOn(agentWireGateModule, "evaluateAgentExecutionRecordWritePathWireApprovalGate").mockReturnValue(
      mockAgentWireGateReady(),
    );
    vi.spyOn(operatorWireGateModule, "evaluateOperatorApprovalAuditWritePathWireApprovalGate").mockReturnValue(
      mockOperatorWireGateReady(),
    );
    vi.spyOn(schemaMigrationModule, "evaluateSchemaMigrationPrReadinessIntegration").mockReturnValue({
      ...mockSchemaMigrationReady(),
      decision: "blocked",
    });

    expect(evaluateWritePathWireCandidateVerification(ALL_CONFIRMATIONS).decision).toBe("blocked");
  });

  it("schemaMigrationReadinessConfirmed false returns defer", () => {
    vi.spyOn(agentWireGateModule, "evaluateAgentExecutionRecordWritePathWireApprovalGate").mockReturnValue(
      mockAgentWireGateReady(),
    );
    vi.spyOn(operatorWireGateModule, "evaluateOperatorApprovalAuditWritePathWireApprovalGate").mockReturnValue(
      mockOperatorWireGateReady(),
    );
    vi.spyOn(schemaMigrationModule, "evaluateSchemaMigrationPrReadinessIntegration").mockReturnValue(
      mockSchemaMigrationReady(),
    );

    expect(
      evaluateWritePathWireCandidateVerification({
        ...ALL_CONFIRMATIONS,
        schemaMigrationReadinessConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("agent wire gate defer returns defer", () => {
    vi.spyOn(agentWireGateModule, "evaluateAgentExecutionRecordWritePathWireApprovalGate").mockReturnValue({
      ...mockAgentWireGateReady(),
      decision: "defer",
    });
    vi.spyOn(operatorWireGateModule, "evaluateOperatorApprovalAuditWritePathWireApprovalGate").mockReturnValue(
      mockOperatorWireGateReady(),
    );
    vi.spyOn(schemaMigrationModule, "evaluateSchemaMigrationPrReadinessIntegration").mockReturnValue(
      mockSchemaMigrationReady(),
    );

    expect(evaluateWritePathWireCandidateVerification(ALL_CONFIRMATIONS).decision).toBe("defer");
  });

  it("operator wire gate defer returns defer", () => {
    vi.spyOn(agentWireGateModule, "evaluateAgentExecutionRecordWritePathWireApprovalGate").mockReturnValue(
      mockAgentWireGateReady(),
    );
    vi.spyOn(operatorWireGateModule, "evaluateOperatorApprovalAuditWritePathWireApprovalGate").mockReturnValue({
      ...mockOperatorWireGateReady(),
      decision: "defer",
    });
    vi.spyOn(schemaMigrationModule, "evaluateSchemaMigrationPrReadinessIntegration").mockReturnValue(
      mockSchemaMigrationReady(),
    );

    expect(evaluateWritePathWireCandidateVerification(ALL_CONFIRMATIONS).decision).toBe("defer");
  });

  it("schema migration readiness defer returns defer", () => {
    vi.spyOn(agentWireGateModule, "evaluateAgentExecutionRecordWritePathWireApprovalGate").mockReturnValue(
      mockAgentWireGateReady(),
    );
    vi.spyOn(operatorWireGateModule, "evaluateOperatorApprovalAuditWritePathWireApprovalGate").mockReturnValue(
      mockOperatorWireGateReady(),
    );
    vi.spyOn(schemaMigrationModule, "evaluateSchemaMigrationPrReadinessIntegration").mockReturnValue({
      ...mockSchemaMigrationReady(),
      decision: "defer",
    });

    expect(evaluateWritePathWireCandidateVerification(ALL_CONFIRMATIONS).decision).toBe("defer");
  });

  it("all conditions satisfied returns ready_for_wire_candidate_verification", () => {
    vi.spyOn(agentWireGateModule, "evaluateAgentExecutionRecordWritePathWireApprovalGate").mockReturnValue(
      mockAgentWireGateReady(),
    );
    vi.spyOn(operatorWireGateModule, "evaluateOperatorApprovalAuditWritePathWireApprovalGate").mockReturnValue(
      mockOperatorWireGateReady(),
    );
    vi.spyOn(schemaMigrationModule, "evaluateSchemaMigrationPrReadinessIntegration").mockReturnValue(
      mockSchemaMigrationReady(),
    );

    const report = evaluateWritePathWireCandidateVerification(ALL_CONFIRMATIONS);
    expect(report.decision).toBe("ready_for_wire_candidate_verification");
    expect(report.findings.some((f) => f.code === "wire_candidate_verification_ready")).toBe(true);
    expect(report.findings.some((f) => f.code === "wire_candidate_requires_final_runtime_approval")).toBe(
      true,
    );
    expect(report.findings.some((f) => f.code === "schema_not_applied_in_runtime")).toBe(true);
    expect(report.findings.some((f) => f.code === "migration_not_applied_in_runtime")).toBe(true);
  });

  it("candidateChecklist includes agent wire gate ready", () => {
    expect(
      checklistItem(evaluateWritePathWireCandidateVerification(), "candidateChecklist", "agent wire gate ready"),
    ).toBeDefined();
  });

  it("candidateChecklist includes operator wire gate ready", () => {
    expect(
      checklistItem(
        evaluateWritePathWireCandidateVerification(),
        "candidateChecklist",
        "operator wire gate ready",
      ),
    ).toBeDefined();
  });

  it("candidateChecklist includes schema migration readiness confirmed", () => {
    expect(
      checklistItem(
        evaluateWritePathWireCandidateVerification(),
        "candidateChecklist",
        "schema migration readiness confirmed",
      ),
    ).toBeDefined();
  });

  it("safetyChecklist includes no write path wire in this step satisfied", () => {
    expect(
      checklistItem(
        evaluateWritePathWireCandidateVerification(),
        "safetyChecklist",
        "no write path wire in this step",
      )?.satisfied,
    ).toBe(true);
  });

  it("safetyChecklist includes no DB write in this step satisfied", () => {
    expect(
      checklistItem(evaluateWritePathWireCandidateVerification(), "safetyChecklist", "no DB write in this step")
        ?.satisfied,
    ).toBe(true);
  });

  it("rollbackChecklist includes operator approval required before actual wire", () => {
    expect(
      checklistItem(
        evaluateWritePathWireCandidateVerification(),
        "rollbackChecklist",
        "operator approval required before actual wire",
      ),
    ).toBeDefined();
  });

  it("defer state does not include wire_candidate_verification_ready finding", () => {
    expect(
      evaluateWritePathWireCandidateVerification().findings.some(
        (f) => f.code === "wire_candidate_verification_ready",
      ),
    ).toBe(false);
  });

  it("blocked state includes write_path_wire_candidate_verification_blocked finding", () => {
    vi.spyOn(agentWireGateModule, "evaluateAgentExecutionRecordWritePathWireApprovalGate").mockReturnValue({
      ...mockAgentWireGateReady(),
      decision: "blocked",
    });
    vi.spyOn(operatorWireGateModule, "evaluateOperatorApprovalAuditWritePathWireApprovalGate").mockReturnValue(
      mockOperatorWireGateReady(),
    );
    vi.spyOn(schemaMigrationModule, "evaluateSchemaMigrationPrReadinessIntegration").mockReturnValue(
      mockSchemaMigrationReady(),
    );

    const report = evaluateWritePathWireCandidateVerification(ALL_CONFIRMATIONS);
    expect(report.decision).toBe("blocked");
    expect(report.findings.some((f) => f.code === "write_path_wire_candidate_verification_blocked")).toBe(
      true,
    );
  });

  it("report includes requested and normalized targets", () => {
    const report = evaluateWritePathWireCandidateVerification();
    expect(report.requestedAgentTarget).toBe("agent_execution_record");
    expect(report.requestedOperatorTarget).toBe("operator_approval");
    expect(report.normalizedAgentTarget).toBe("agent_execution_record");
    expect(report.normalizedOperatorTarget).toBe("operator_approval");
  });

  it("report includes schema migration source trace fields", () => {
    vi.spyOn(agentWireGateModule, "evaluateAgentExecutionRecordWritePathWireApprovalGate").mockReturnValue(
      mockAgentWireGateReady(),
    );
    vi.spyOn(operatorWireGateModule, "evaluateOperatorApprovalAuditWritePathWireApprovalGate").mockReturnValue(
      mockOperatorWireGateReady(),
    );
    vi.spyOn(schemaMigrationModule, "evaluateSchemaMigrationPrReadinessIntegration").mockReturnValue(
      mockSchemaMigrationReady(),
    );

    const report = evaluateWritePathWireCandidateVerification(ALL_CONFIRMATIONS);
    expect(report.sourceSchemaMigrationAgentSchemaDecision).toBe("ready_for_schema_pr_plan");
    expect(report.sourceSchemaMigrationOperatorSchemaDecision).toBe("ready_for_schema_pr_plan");
    expect(report.sourceSchemaMigrationWriteAdapterDecision).toBe("ready_for_adapter_design");
    expect(typeof report.sourceSchemaMigrationAgentRequiresSchemaChange).toBe("boolean");
    expect(typeof report.sourceSchemaMigrationOperatorRequiresMigration).toBe("boolean");
    expect(Array.isArray(report.sourceAgentWireGateBlockingFindingCodes)).toBe(true);
    expect(Array.isArray(report.sourceOperatorWireGateBlockingFindingCodes)).toBe(true);
    expect(report.sourceOperatorWireGatePermissionChecklistCount).toBe(1);
    expect(report.sourceOperatorWireGateAuditChecklistCount).toBe(1);
  });

  it("schemaMigrationReadinessReviewConfirmed true keeps schemaAppliedInRuntime false", () => {
    vi.spyOn(agentWireGateModule, "evaluateAgentExecutionRecordWritePathWireApprovalGate").mockReturnValue(
      mockAgentWireGateReady(),
    );
    vi.spyOn(operatorWireGateModule, "evaluateOperatorApprovalAuditWritePathWireApprovalGate").mockReturnValue(
      mockOperatorWireGateReady(),
    );
    vi.spyOn(schemaMigrationModule, "evaluateSchemaMigrationPrReadinessIntegration").mockReturnValue(
      mockSchemaMigrationReady(),
    );

    const report = evaluateWritePathWireCandidateVerification(ALL_CONFIRMATIONS);
    expect(report.schemaMigrationReadinessReviewConfirmed).toBe(true);
    expect(report.schemaAppliedInRuntime).toBe(false);
    expect(report.migrationAppliedInRuntime).toBe(false);
  });

  it("agent wire gate ready reason includes source decision", () => {
    vi.spyOn(agentWireGateModule, "evaluateAgentExecutionRecordWritePathWireApprovalGate").mockReturnValue(
      mockAgentWireGateReady(),
    );
    vi.spyOn(operatorWireGateModule, "evaluateOperatorApprovalAuditWritePathWireApprovalGate").mockReturnValue(
      mockOperatorWireGateReady(),
    );
    vi.spyOn(schemaMigrationModule, "evaluateSchemaMigrationPrReadinessIntegration").mockReturnValue(
      mockSchemaMigrationReady(),
    );

    const reason = checklistItem(
      evaluateWritePathWireCandidateVerification(ALL_CONFIRMATIONS),
      "candidateChecklist",
      "agent wire gate ready",
    )?.reason;
    expect(reason).toContain("ready_for_write_path_wire_approval");
  });

  it("schema migration readiness confirmed reason includes confirmation value", () => {
    vi.spyOn(agentWireGateModule, "evaluateAgentExecutionRecordWritePathWireApprovalGate").mockReturnValue(
      mockAgentWireGateReady(),
    );
    vi.spyOn(operatorWireGateModule, "evaluateOperatorApprovalAuditWritePathWireApprovalGate").mockReturnValue(
      mockOperatorWireGateReady(),
    );
    vi.spyOn(schemaMigrationModule, "evaluateSchemaMigrationPrReadinessIntegration").mockReturnValue(
      mockSchemaMigrationReady(),
    );

    const reason = checklistItem(
      evaluateWritePathWireCandidateVerification(ALL_CONFIRMATIONS),
      "candidateChecklist",
      "schema migration readiness confirmed",
    )?.reason;
    expect(reason).toContain("true");
  });

  it("no write path wire in this step reason includes read-only phrase", () => {
    const reason = checklistItem(
      evaluateWritePathWireCandidateVerification(),
      "safetyChecklist",
      "no write path wire in this step",
    )?.reason;
    expect(reason?.toLowerCase()).toContain("read-only");
  });

  it("operator approval required before actual wire reason includes approval phrase", () => {
    const reason = checklistItem(
      evaluateWritePathWireCandidateVerification(),
      "rollbackChecklist",
      "operator approval required before actual wire",
    )?.reason;
    expect(reason?.toLowerCase()).toContain("approval");
  });

  it("evaluator does not wire write path DB Prisma schema migration feature flag or routing", () => {
    const agentSpy = vi.spyOn(agentWireGateModule, "evaluateAgentExecutionRecordWritePathWireApprovalGate");
    const operatorSpy = vi.spyOn(
      operatorWireGateModule,
      "evaluateOperatorApprovalAuditWritePathWireApprovalGate",
    );
    const schemaSpy = vi.spyOn(schemaMigrationModule, "evaluateSchemaMigrationPrReadinessIntegration");

    const report = evaluateWritePathWireCandidateVerification();

    expect(agentSpy).toHaveBeenCalled();
    expect(operatorSpy).toHaveBeenCalled();
    expect(schemaSpy).toHaveBeenCalled();
    expect(report.wiresWritePathInThisStep).toBe(false);
    expect(report.wiresAdapterInThisStep).toBe(false);
    expect(report.writesDataInThisStep).toBe(false);
    expect(report.callsPrismaInThisStep).toBe(false);
    expect(report.modifiesSchemaInThisStep).toBe(false);
    expect(report.createsMigrationInThisStep).toBe(false);
    expect(report.wiresFeatureFlagInThisStep).toBe(false);
    expect(report.changesRuntimeRouteInThisStep).toBe(false);
  });
});
