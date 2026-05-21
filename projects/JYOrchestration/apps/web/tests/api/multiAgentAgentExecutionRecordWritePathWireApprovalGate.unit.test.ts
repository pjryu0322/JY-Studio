import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateAgentExecutionRecordWritePathWireApprovalGate } from "@/lib/agents/evaluateAgentExecutionRecordWritePathWireApprovalGate";
import * as schemaApprovalModule from "@/lib/agents/evaluateAgentExecutionRecordSchemaPrApprovalPackage";
import * as writePathModule from "@/lib/agents/evaluateAgentExecutionRecordWritePathDesign";

function checklistItem(
  report: ReturnType<typeof evaluateAgentExecutionRecordWritePathWireApprovalGate>,
  list: "approvalChecklist" | "runtimeChecklist" | "rollbackChecklist",
  item: string,
) {
  return report[list].find((c) => c.item === item);
}

function mockWritePathReady(): ReturnType<typeof writePathModule.evaluateAgentExecutionRecordWritePathDesign> {
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
    rollbackPlan: ["feature flag off로 write path 비활성화", "write adapter no-op 전환"],
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

function mockSchemaApprovalReady(): ReturnType<
  typeof schemaApprovalModule.evaluateAgentExecutionRecordSchemaPrApprovalPackage
> {
  return {
    mode: "read_only_agent_execution_record_schema_pr_approval_package",
    decision: "ready_for_explicit_schema_pr_approval",
    target: "agent_execution_record",
    sourceReadinessDecision: "ready_for_schema_pr_plan",
    sourceSchemaDecision: "ready_for_schema_proposal",
    sourceProposedTableName: "AgentExecutionRecord",
    sourceRequiresPrismaSchemaChange: true,
    sourceRequiresMigration: true,
    sourceFieldProposalCount: 1,
    sourceExcludedFieldCount: 1,
    sourceForbiddenFieldNames: ["rawPrompt"],
    modelDraft: "model AgentExecutionRecord { id String @id }",
    modelName: "AgentExecutionRecord",
    approvalChecklist: [],
    migrationChecklist: [{ item: "migration", satisfied: true, reason: "ok" }],
    rollbackChecklist: [{ item: "rollback", satisfied: true, reason: "ok" }],
    retentionAccessChecklist: [{ item: "retention", satisfied: true, reason: "ok" }],
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
} as const;

describe("multi-agent agent execution record write path wire approval gate stage 2-29", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mode is read_only_agent_execution_record_write_path_wire_approval_gate", () => {
    expect(evaluateAgentExecutionRecordWritePathWireApprovalGate().mode).toBe(
      "read_only_agent_execution_record_write_path_wire_approval_gate",
    );
  });

  it("default decision is defer", () => {
    expect(evaluateAgentExecutionRecordWritePathWireApprovalGate().decision).toBe("defer");
  });

  it("explicitUserApproval=false returns defer", () => {
    expect(
      evaluateAgentExecutionRecordWritePathWireApprovalGate({
        schemaAppliedConfirmed: true,
        migrationAppliedConfirmed: true,
        featureFlagWireApproved: true,
        writeAdapterImplementedConfirmed: true,
        explicitUserApproval: false,
      }).decision,
    ).toBe("defer");
  });

  it("schemaAppliedConfirmed=false returns defer", () => {
    expect(
      evaluateAgentExecutionRecordWritePathWireApprovalGate({
        ...ALL_CONFIRMATIONS,
        schemaAppliedConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("migrationAppliedConfirmed=false returns defer", () => {
    expect(
      evaluateAgentExecutionRecordWritePathWireApprovalGate({
        ...ALL_CONFIRMATIONS,
        migrationAppliedConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("featureFlagWireApproved=false returns defer", () => {
    expect(
      evaluateAgentExecutionRecordWritePathWireApprovalGate({
        ...ALL_CONFIRMATIONS,
        featureFlagWireApproved: false,
      }).decision,
    ).toBe("defer");
  });

  it("writeAdapterImplementedConfirmed=false returns defer", () => {
    expect(
      evaluateAgentExecutionRecordWritePathWireApprovalGate({
        ...ALL_CONFIRMATIONS,
        writeAdapterImplementedConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("all confirmations true with upstream ready returns ready_for_write_path_wire_approval", () => {
    vi.spyOn(writePathModule, "evaluateAgentExecutionRecordWritePathDesign").mockReturnValue(
      mockWritePathReady(),
    );
    vi.spyOn(schemaApprovalModule, "evaluateAgentExecutionRecordSchemaPrApprovalPackage").mockReturnValue(
      mockSchemaApprovalReady(),
    );

    const report = evaluateAgentExecutionRecordWritePathWireApprovalGate(ALL_CONFIRMATIONS);
    expect(report.decision).toBe("ready_for_write_path_wire_approval");
  });

  it("requiresExplicitUserApproval is true", () => {
    expect(evaluateAgentExecutionRecordWritePathWireApprovalGate().requiresExplicitUserApproval).toBe(
      true,
    );
  });

  it("requiresSchemaApplied is true", () => {
    expect(evaluateAgentExecutionRecordWritePathWireApprovalGate().requiresSchemaApplied).toBe(true);
  });

  it("requiresMigrationApplied is true", () => {
    expect(evaluateAgentExecutionRecordWritePathWireApprovalGate().requiresMigrationApplied).toBe(true);
  });

  it("requiresFeatureFlagWireApproval is true", () => {
    expect(evaluateAgentExecutionRecordWritePathWireApprovalGate().requiresFeatureFlagWireApproval).toBe(
      true,
    );
  });

  it("requiresWriteAdapterImplemented is true", () => {
    expect(evaluateAgentExecutionRecordWritePathWireApprovalGate().requiresWriteAdapterImplemented).toBe(
      true,
    );
  });

  it("wiresWritePathInThisStep is false", () => {
    expect(evaluateAgentExecutionRecordWritePathWireApprovalGate().wiresWritePathInThisStep).toBe(false);
  });

  it("writesDataInThisStep is false", () => {
    expect(evaluateAgentExecutionRecordWritePathWireApprovalGate().writesDataInThisStep).toBe(false);
  });

  it("callsPrismaInThisStep is false", () => {
    expect(evaluateAgentExecutionRecordWritePathWireApprovalGate().callsPrismaInThisStep).toBe(false);
  });

  it("modifiesSchemaInThisStep is false", () => {
    expect(evaluateAgentExecutionRecordWritePathWireApprovalGate().modifiesSchemaInThisStep).toBe(false);
  });

  it("createsMigrationInThisStep is false", () => {
    expect(evaluateAgentExecutionRecordWritePathWireApprovalGate().createsMigrationInThisStep).toBe(false);
  });

  it("approvalChecklist includes no data write in this step satisfied", () => {
    expect(
      checklistItem(
        evaluateAgentExecutionRecordWritePathWireApprovalGate(),
        "approvalChecklist",
        "no data write in this step",
      )?.satisfied,
    ).toBe(true);
  });

  it("runtimeChecklist includes forbidden field policy available", () => {
    expect(
      checklistItem(
        evaluateAgentExecutionRecordWritePathWireApprovalGate(),
        "runtimeChecklist",
        "forbidden field policy available",
      ),
    ).toBeDefined();
  });

  it("rollbackChecklist includes feature flag rollback plan available", () => {
    expect(
      checklistItem(
        evaluateAgentExecutionRecordWritePathWireApprovalGate(),
        "rollbackChecklist",
        "feature flag rollback plan available",
      ),
    ).toBeDefined();
  });

  it("unknown target returns blocked", () => {
    expect(
      evaluateAgentExecutionRecordWritePathWireApprovalGate({ target: "unknown" }).decision,
    ).toBe("blocked");
  });

  it("report includes sourceSchemaApprovalTarget for agent_execution_record", () => {
    expect(
      evaluateAgentExecutionRecordWritePathWireApprovalGate({ target: "agent_execution_record" })
        .sourceSchemaApprovalTarget,
    ).toBe("agent_execution_record");
  });

  it("report includes schemaApprovalReferenceOnly for timeline_event_link", () => {
    const report = evaluateAgentExecutionRecordWritePathWireApprovalGate({
      target: "timeline_event_link",
    });
    expect(report.schemaApprovalReferenceOnly).toBe(true);
    expect(report.decision).toBe("defer");
  });

  it("report includes schemaApprovalReferenceOnly for audit_trail_link", () => {
    const report = evaluateAgentExecutionRecordWritePathWireApprovalGate({
      target: "audit_trail_link",
    });
    expect(report.schemaApprovalReferenceOnly).toBe(true);
    expect(report.decision).toBe("defer");
  });

  it("report includes sourceBlockingFindingCodes", () => {
    expect(
      evaluateAgentExecutionRecordWritePathWireApprovalGate().sourceBlockingFindingCodes,
    ).toBeDefined();
  });

  it("report includes sourceWritePathFeatureFlagName and sourceWritePathRollbackPlan", () => {
    const report = evaluateAgentExecutionRecordWritePathWireApprovalGate();
    expect(report.sourceWritePathFeatureFlagName.length).toBeGreaterThan(0);
    expect(report.sourceWritePathRollbackPlan.length).toBeGreaterThan(0);
  });

  it("target timeline_event_link is not ready with all confirmations", () => {
    vi.spyOn(writePathModule, "evaluateAgentExecutionRecordWritePathDesign").mockReturnValue(
      mockWritePathReady(),
    );
    vi.spyOn(schemaApprovalModule, "evaluateAgentExecutionRecordSchemaPrApprovalPackage").mockReturnValue(
      mockSchemaApprovalReady(),
    );

    expect(
      evaluateAgentExecutionRecordWritePathWireApprovalGate({
        target: "timeline_event_link",
        ...ALL_CONFIRMATIONS,
      }).decision,
    ).toBe("defer");
  });

  it("target audit_trail_link is not ready with all confirmations", () => {
    vi.spyOn(writePathModule, "evaluateAgentExecutionRecordWritePathDesign").mockReturnValue(
      mockWritePathReady(),
    );
    vi.spyOn(schemaApprovalModule, "evaluateAgentExecutionRecordSchemaPrApprovalPackage").mockReturnValue(
      mockSchemaApprovalReady(),
    );

    expect(
      evaluateAgentExecutionRecordWritePathWireApprovalGate({
        target: "audit_trail_link",
        ...ALL_CONFIRMATIONS,
      }).decision,
    ).toBe("defer");
  });

  it("ready state includes write_path_wire_approval_ready finding", () => {
    vi.spyOn(writePathModule, "evaluateAgentExecutionRecordWritePathDesign").mockReturnValue(
      mockWritePathReady(),
    );
    vi.spyOn(schemaApprovalModule, "evaluateAgentExecutionRecordSchemaPrApprovalPackage").mockReturnValue(
      mockSchemaApprovalReady(),
    );

    const report = evaluateAgentExecutionRecordWritePathWireApprovalGate(ALL_CONFIRMATIONS);
    expect(report.decision).toBe("ready_for_write_path_wire_approval");
    expect(report.findings.some((f) => f.code === "write_path_wire_approval_ready")).toBe(true);
  });

  it("unknown target has non-empty sourceBlockingFindingCodes", () => {
    const report = evaluateAgentExecutionRecordWritePathWireApprovalGate({ target: "unknown" });
    expect(report.decision).toBe("blocked");
    expect(report.sourceBlockingFindingCodes.length).toBeGreaterThan(0);
  });

  it("evaluator does not wire write path DB Prisma schema or migration", () => {
    const writeSpy = vi.spyOn(writePathModule, "evaluateAgentExecutionRecordWritePathDesign");
    const schemaSpy = vi.spyOn(
      schemaApprovalModule,
      "evaluateAgentExecutionRecordSchemaPrApprovalPackage",
    );

    const report = evaluateAgentExecutionRecordWritePathWireApprovalGate(ALL_CONFIRMATIONS);

    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(schemaSpy).toHaveBeenCalledTimes(1);
    expect(report.wiresWritePathInThisStep).toBe(false);
    expect(report.writesDataInThisStep).toBe(false);
    expect(report.callsPrismaInThisStep).toBe(false);
    expect(report.modifiesSchemaInThisStep).toBe(false);
    expect(report.createsMigrationInThisStep).toBe(false);
  });
});
