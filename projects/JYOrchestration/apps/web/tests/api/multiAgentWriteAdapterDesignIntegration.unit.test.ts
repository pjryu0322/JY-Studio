import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateWriteAdapterDesignIntegration } from "@/lib/agents/evaluateWriteAdapterDesignIntegration";
import * as agentWireGateModule from "@/lib/agents/evaluateAgentExecutionRecordWritePathWireApprovalGate";
import * as operatorWireGateModule from "@/lib/agents/evaluateOperatorApprovalAuditWritePathWireApprovalGate";
import * as agentWritePathModule from "@/lib/agents/evaluateAgentExecutionRecordWritePathDesign";
import * as operatorWritePathModule from "@/lib/agents/evaluateOperatorApprovalAuditWritePathDesign";

function checklistItem(
  report: ReturnType<typeof evaluateWriteAdapterDesignIntegration>,
  list: "adapterChecklist" | "safetyChecklist" | "rollbackChecklist",
  item: string,
) {
  return report[list].find((c) => c.item === item);
}

function mockAgentWritePathReady(): ReturnType<
  typeof agentWritePathModule.evaluateAgentExecutionRecordWritePathDesign
> {
  return {
    mode: "read_only_agent_execution_record_write_path_design",
    decision: "ready_for_write_path_design",
    target: "agent_execution_record",
    featureFlagName: "JYO_AGENT_EXECUTION_RECORD_WRITE_PATH",
    featureFlagDefault: "off",
    proposedWriteEntrypoints: ["Agent runtime completion handler"],
    proposedSanitizers: ["sanitizeAgentExecutionRecordInput"],
    forbiddenFieldGuards: ["rejectRawPrompt"],
    validationChecklist: [],
    rollbackPlan: ["feature flag off"],
    requiresSchemaApplied: true,
    requiresMigrationApplied: true,
    requiresFeatureFlag: true,
    requiresForbiddenFieldGuard: true,
    requiresWritePathRollback: true,
    requiresOperatorApproval: true,
    sourceSchemaDecision: "ready_for_schema_proposal",
    sourceSchemaTarget: "agent_execution_record",
    sourceProposedTableName: "AgentExecutionRecord",
    sourceRequiresPrismaSchemaChange: true,
    sourceRequiresMigration: true,
    findings: [],
  };
}

function mockOperatorWritePathReady(): ReturnType<
  typeof operatorWritePathModule.evaluateOperatorApprovalAuditWritePathDesign
> {
  return {
    mode: "read_only_operator_approval_audit_write_path_design",
    decision: "ready_for_write_path_design",
    target: "operator_approval",
    featureFlagName: "JYO_OPERATOR_APPROVAL_AUDIT_WRITE_PATH",
    featureFlagDefault: "off",
    proposedWriteEntrypoints: ["Operator approval decision submit boundary"],
    proposedPermissionGuards: ["requireOperatorRole"],
    proposedAuditIntegrityGuards: ["ensureAuditEventAppendOnly"],
    proposedSanitizers: ["sanitizeReasonSummary"],
    forbiddenFieldGuards: ["rejectRawReason"],
    validationChecklist: [],
    rollbackPlan: ["feature flag off"],
    requiresSchemaApplied: true,
    requiresMigrationApplied: true,
    requiresFeatureFlag: true,
    requiresPermissionGuard: true,
    requiresAuditIntegrityGuard: true,
    requiresForbiddenFieldGuard: true,
    requiresWritePathRollback: true,
    requiresOperatorApproval: true,
    sourceSchemaDecision: "ready_for_schema_proposal",
    sourceSchemaTarget: "operator_approval",
    sourceProposedTableName: "OperatorApproval",
    sourceRequiresPrismaSchemaChange: true,
    sourceRequiresMigration: true,
    findings: [],
  };
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
    sourceSchemaApprovalMode: "primary",
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
    sourceSchemaApprovalMode: "primary",
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
    permissionChecklist: [],
    auditChecklist: [],
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

const ALL_AGENT_CONFIRMATIONS = {
  agentExplicitUserApproval: true,
  agentSchemaAppliedConfirmed: true,
  agentMigrationAppliedConfirmed: true,
  agentFeatureFlagWireApproved: true,
  agentWriteAdapterImplementedConfirmed: true,
} as const;

const ALL_OPERATOR_CONFIRMATIONS = {
  operatorExplicitUserApproval: true,
  operatorSchemaAppliedConfirmed: true,
  operatorMigrationAppliedConfirmed: true,
  operatorFeatureFlagWireApproved: true,
  operatorWriteAdapterImplementedConfirmed: true,
  operatorPermissionModelConfirmed: true,
  operatorAuditTrailConfirmed: true,
} as const;

describe("multi-agent write adapter design integration stage 2-B", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mode is read_only_write_adapter_design_integration", () => {
    expect(evaluateWriteAdapterDesignIntegration().mode).toBe(
      "read_only_write_adapter_design_integration",
    );
  });

  it("default decision is defer", () => {
    expect(evaluateWriteAdapterDesignIntegration().decision).toBe("defer");
  });

  it("designsAdapterOnly is true", () => {
    expect(evaluateWriteAdapterDesignIntegration().designsAdapterOnly).toBe(true);
  });

  it("wiresAdapterInThisStep is false", () => {
    expect(evaluateWriteAdapterDesignIntegration().wiresAdapterInThisStep).toBe(false);
  });

  it("writesDataInThisStep is false", () => {
    expect(evaluateWriteAdapterDesignIntegration().writesDataInThisStep).toBe(false);
  });

  it("callsPrismaInThisStep is false", () => {
    expect(evaluateWriteAdapterDesignIntegration().callsPrismaInThisStep).toBe(false);
  });

  it("modifiesSchemaInThisStep is false", () => {
    expect(evaluateWriteAdapterDesignIntegration().modifiesSchemaInThisStep).toBe(false);
  });

  it("createsMigrationInThisStep is false", () => {
    expect(evaluateWriteAdapterDesignIntegration().createsMigrationInThisStep).toBe(false);
  });

  it("wiresFeatureFlagInThisStep is false", () => {
    expect(evaluateWriteAdapterDesignIntegration().wiresFeatureFlagInThisStep).toBe(false);
  });

  it("agent gate blocked returns blocked", () => {
    vi.spyOn(agentWireGateModule, "evaluateAgentExecutionRecordWritePathWireApprovalGate").mockReturnValue({
      ...mockAgentWireGateReady(),
      decision: "blocked",
      findings: [{ severity: "blocking", code: "blocked", message: "blocked" }],
    });
    vi.spyOn(operatorWireGateModule, "evaluateOperatorApprovalAuditWritePathWireApprovalGate").mockReturnValue(
      mockOperatorWireGateReady(),
    );
    vi.spyOn(agentWritePathModule, "evaluateAgentExecutionRecordWritePathDesign").mockReturnValue(
      mockAgentWritePathReady(),
    );
    vi.spyOn(operatorWritePathModule, "evaluateOperatorApprovalAuditWritePathDesign").mockReturnValue(
      mockOperatorWritePathReady(),
    );

    expect(evaluateWriteAdapterDesignIntegration(ALL_AGENT_CONFIRMATIONS).decision).toBe("blocked");
  });

  it("operator gate blocked returns blocked", () => {
    vi.spyOn(agentWireGateModule, "evaluateAgentExecutionRecordWritePathWireApprovalGate").mockReturnValue(
      mockAgentWireGateReady(),
    );
    vi.spyOn(operatorWireGateModule, "evaluateOperatorApprovalAuditWritePathWireApprovalGate").mockReturnValue({
      ...mockOperatorWireGateReady(),
      decision: "blocked",
      findings: [{ severity: "blocking", code: "blocked", message: "blocked" }],
    });
    vi.spyOn(agentWritePathModule, "evaluateAgentExecutionRecordWritePathDesign").mockReturnValue(
      mockAgentWritePathReady(),
    );
    vi.spyOn(operatorWritePathModule, "evaluateOperatorApprovalAuditWritePathDesign").mockReturnValue(
      mockOperatorWritePathReady(),
    );

    expect(evaluateWriteAdapterDesignIntegration(ALL_OPERATOR_CONFIRMATIONS).decision).toBe("blocked");
  });

  it("agent gate defer returns defer", () => {
    vi.spyOn(agentWireGateModule, "evaluateAgentExecutionRecordWritePathWireApprovalGate").mockReturnValue({
      ...mockAgentWireGateReady(),
      decision: "defer",
    });
    vi.spyOn(operatorWireGateModule, "evaluateOperatorApprovalAuditWritePathWireApprovalGate").mockReturnValue(
      mockOperatorWireGateReady(),
    );
    vi.spyOn(agentWritePathModule, "evaluateAgentExecutionRecordWritePathDesign").mockReturnValue(
      mockAgentWritePathReady(),
    );
    vi.spyOn(operatorWritePathModule, "evaluateOperatorApprovalAuditWritePathDesign").mockReturnValue(
      mockOperatorWritePathReady(),
    );

    expect(evaluateWriteAdapterDesignIntegration(ALL_AGENT_CONFIRMATIONS).decision).toBe("defer");
  });

  it("operator gate defer returns defer", () => {
    vi.spyOn(agentWireGateModule, "evaluateAgentExecutionRecordWritePathWireApprovalGate").mockReturnValue(
      mockAgentWireGateReady(),
    );
    vi.spyOn(operatorWireGateModule, "evaluateOperatorApprovalAuditWritePathWireApprovalGate").mockReturnValue({
      ...mockOperatorWireGateReady(),
      decision: "defer",
    });
    vi.spyOn(agentWritePathModule, "evaluateAgentExecutionRecordWritePathDesign").mockReturnValue(
      mockAgentWritePathReady(),
    );
    vi.spyOn(operatorWritePathModule, "evaluateOperatorApprovalAuditWritePathDesign").mockReturnValue(
      mockOperatorWritePathReady(),
    );

    expect(evaluateWriteAdapterDesignIntegration(ALL_OPERATOR_CONFIRMATIONS).decision).toBe("defer");
  });

  it("all upstream ready returns ready_for_adapter_design", () => {
    vi.spyOn(agentWireGateModule, "evaluateAgentExecutionRecordWritePathWireApprovalGate").mockReturnValue(
      mockAgentWireGateReady(),
    );
    vi.spyOn(operatorWireGateModule, "evaluateOperatorApprovalAuditWritePathWireApprovalGate").mockReturnValue(
      mockOperatorWireGateReady(),
    );
    vi.spyOn(agentWritePathModule, "evaluateAgentExecutionRecordWritePathDesign").mockReturnValue(
      mockAgentWritePathReady(),
    );
    vi.spyOn(operatorWritePathModule, "evaluateOperatorApprovalAuditWritePathDesign").mockReturnValue(
      mockOperatorWritePathReady(),
    );

    const report = evaluateWriteAdapterDesignIntegration({
      ...ALL_AGENT_CONFIRMATIONS,
      ...ALL_OPERATOR_CONFIRMATIONS,
    });
    expect(report.decision).toBe("ready_for_adapter_design");
    expect(report.findings.some((f) => f.code === "write_adapter_design_ready")).toBe(true);
  });

  it("adapterChecklist includes agent adapter boundary identified", () => {
    expect(
      checklistItem(
        evaluateWriteAdapterDesignIntegration(),
        "adapterChecklist",
        "agent adapter boundary identified",
      ),
    ).toBeDefined();
  });

  it("adapterChecklist includes operator adapter boundary identified", () => {
    expect(
      checklistItem(
        evaluateWriteAdapterDesignIntegration(),
        "adapterChecklist",
        "operator adapter boundary identified",
      ),
    ).toBeDefined();
  });

  it("safetyChecklist includes no DB write in this step satisfied", () => {
    expect(
      checklistItem(
        evaluateWriteAdapterDesignIntegration(),
        "safetyChecklist",
        "no DB write in this step",
      )?.satisfied,
    ).toBe(true);
  });

  it("safetyChecklist includes no Prisma call in this step satisfied", () => {
    expect(
      checklistItem(
        evaluateWriteAdapterDesignIntegration(),
        "safetyChecklist",
        "no Prisma call in this step",
      )?.satisfied,
    ).toBe(true);
  });

  it("rollbackChecklist includes agent rollback plan available", () => {
    expect(
      checklistItem(
        evaluateWriteAdapterDesignIntegration(),
        "rollbackChecklist",
        "agent rollback plan available",
      ),
    ).toBeDefined();
  });

  it("rollbackChecklist includes operator rollback plan available", () => {
    expect(
      checklistItem(
        evaluateWriteAdapterDesignIntegration(),
        "rollbackChecklist",
        "operator rollback plan available",
      ),
    ).toBeDefined();
  });

  it("defer state does not include write_adapter_design_ready finding", () => {
    expect(
      evaluateWriteAdapterDesignIntegration().findings.some((f) => f.code === "write_adapter_design_ready"),
    ).toBe(false);
  });

  it("blocked state includes write_adapter_design_blocked finding", () => {
    vi.spyOn(agentWireGateModule, "evaluateAgentExecutionRecordWritePathWireApprovalGate").mockReturnValue({
      ...mockAgentWireGateReady(),
      decision: "blocked",
    });
    vi.spyOn(operatorWireGateModule, "evaluateOperatorApprovalAuditWritePathWireApprovalGate").mockReturnValue(
      mockOperatorWireGateReady(),
    );
    vi.spyOn(agentWritePathModule, "evaluateAgentExecutionRecordWritePathDesign").mockReturnValue(
      mockAgentWritePathReady(),
    );
    vi.spyOn(operatorWritePathModule, "evaluateOperatorApprovalAuditWritePathDesign").mockReturnValue(
      mockOperatorWritePathReady(),
    );

    const report = evaluateWriteAdapterDesignIntegration();
    expect(report.decision).toBe("blocked");
    expect(report.findings.some((f) => f.code === "write_adapter_design_blocked")).toBe(true);
  });

  it("report includes sourceAgentSchemaApprovalDecision and sourceOperatorSchemaApprovalDecision", () => {
    const report = evaluateWriteAdapterDesignIntegration();
    expect(typeof report.sourceAgentSchemaApprovalDecision).toBe("string");
    expect(typeof report.sourceOperatorSchemaApprovalDecision).toBe("string");
  });

  it("report includes sourceAgentBlockingFindingCodes as array", () => {
    expect(Array.isArray(evaluateWriteAdapterDesignIntegration().sourceAgentBlockingFindingCodes)).toBe(
      true,
    );
  });

  it("report includes sourceOperatorBlockingFindingCodes as array", () => {
    expect(Array.isArray(evaluateWriteAdapterDesignIntegration().sourceOperatorBlockingFindingCodes)).toBe(
      true,
    );
  });

  it("report includes sourceOperatorPermissionChecklistItemCount as number", () => {
    expect(typeof evaluateWriteAdapterDesignIntegration().sourceOperatorPermissionChecklistItemCount).toBe(
      "number",
    );
  });

  it("report includes sourceOperatorAuditChecklistItemCount as number", () => {
    expect(typeof evaluateWriteAdapterDesignIntegration().sourceOperatorAuditChecklistItemCount).toBe(
      "number",
    );
  });

  it("default targets are agent_execution_record and operator_approval", () => {
    const report = evaluateWriteAdapterDesignIntegration();
    expect(report.requestedAgentTarget).toBe("agent_execution_record");
    expect(report.requestedOperatorTarget).toBe("operator_approval");
    expect(report.normalizedAgentTarget).toBe("agent_execution_record");
    expect(report.normalizedOperatorTarget).toBe("operator_approval");
  });

  it("unknown agent target does not become ready_for_adapter_design", () => {
    vi.spyOn(agentWireGateModule, "evaluateAgentExecutionRecordWritePathWireApprovalGate").mockReturnValue(
      mockAgentWireGateReady(),
    );
    vi.spyOn(operatorWireGateModule, "evaluateOperatorApprovalAuditWritePathWireApprovalGate").mockReturnValue(
      mockOperatorWireGateReady(),
    );
    vi.spyOn(agentWritePathModule, "evaluateAgentExecutionRecordWritePathDesign").mockReturnValue(
      mockAgentWritePathReady(),
    );
    vi.spyOn(operatorWritePathModule, "evaluateOperatorApprovalAuditWritePathDesign").mockReturnValue(
      mockOperatorWritePathReady(),
    );

    const report = evaluateWriteAdapterDesignIntegration({
      agentTarget: "unknown",
      operatorTarget: "operator_approval",
      ...ALL_AGENT_CONFIRMATIONS,
      ...ALL_OPERATOR_CONFIRMATIONS,
    });
    expect(report.normalizedAgentTarget).toBe("unknown");
    expect(report.decision).toBe("blocked");
    expect(report.findings.some((f) => f.code === "unknown_agent_write_adapter_target")).toBe(true);
  });

  it("all confirmations true without mock still defers because upstream write path is defer", () => {
    const report = evaluateWriteAdapterDesignIntegration({
      ...ALL_AGENT_CONFIRMATIONS,
      ...ALL_OPERATOR_CONFIRMATIONS,
    });
    expect(report.decision).toBe("defer");
    expect(report.findings.some((f) => f.code === "write_adapter_design_ready")).toBe(false);
  });

  it("evaluator does not wire adapter DB Prisma schema or migration", () => {
    const agentGateSpy = vi.spyOn(
      agentWireGateModule,
      "evaluateAgentExecutionRecordWritePathWireApprovalGate",
    );
    const operatorGateSpy = vi.spyOn(
      operatorWireGateModule,
      "evaluateOperatorApprovalAuditWritePathWireApprovalGate",
    );
    const agentPathSpy = vi.spyOn(agentWritePathModule, "evaluateAgentExecutionRecordWritePathDesign");
    const operatorPathSpy = vi.spyOn(
      operatorWritePathModule,
      "evaluateOperatorApprovalAuditWritePathDesign",
    );

    const report = evaluateWriteAdapterDesignIntegration();

    expect(agentGateSpy).toHaveBeenCalled();
    expect(operatorGateSpy).toHaveBeenCalled();
    expect(agentPathSpy).toHaveBeenCalled();
    expect(operatorPathSpy).toHaveBeenCalled();
    expect(report.wiresAdapterInThisStep).toBe(false);
    expect(report.writesDataInThisStep).toBe(false);
    expect(report.callsPrismaInThisStep).toBe(false);
    expect(report.modifiesSchemaInThisStep).toBe(false);
    expect(report.createsMigrationInThisStep).toBe(false);
    expect(report.wiresFeatureFlagInThisStep).toBe(false);
  });
});
