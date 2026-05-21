import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateRuntimeChangeFinalApprovalPackage } from "@/lib/agents/evaluateRuntimeChangeFinalApprovalPackage";
import * as routingShadowModule from "@/lib/agents/evaluateConnectorGatewayRoutingShadow";
import * as wireCandidateModule from "@/lib/agents/evaluateWritePathWireCandidateVerification";

const CURSOR_BOUNDARY = ["cursor.execution.before"] as const;

function checklistItem(
  report: ReturnType<typeof evaluateRuntimeChangeFinalApprovalPackage>,
  list: "finalApprovalChecklist" | "runtimeSafetyChecklist" | "rollbackChecklist" | "operatorChecklist",
  item: string,
) {
  return report[list].find((c) => c.item === item);
}

function mockRoutingShadowReady(): ReturnType<typeof routingShadowModule.evaluateConnectorGatewayRoutingShadow> {
  return {
    mode: "read_only_connector_gateway_routing_shadow",
    decision: "shadow_ready",
    routeMode: "shadow_compare",
    target: "cursor_only",
    boundaryIds: [...CURSOR_BOUNDARY],
    boundarySource: "explicit",
    connectorIds: ["cursor"],
    connectorSource: "explicit",
    sourceRoutingDecision: "ready_for_routing_experiment",
    sourceRoutingScope: "cursor_only",
    sourceRoutingRequiresStage1Regression: false,
    sourceBranchManualVerificationDecision: "defer",
    sourceBranchManualVerificationRollbackRequired: false,
    sourceManualVerificationUsesExternalResults: false,
    sourceManualVerificationActualBranchProvided: false,
    sourceManualVerificationRegressionResultsProvided: false,
    featureFlagEnabled: false,
    explicitShadowApproval: true,
    actualRuntimePath: "/api/requirements",
    shadowRuntimePath: "/api/requirements/shadow",
    routeChecklist: [],
    safetyChecklist: [],
    rollbackChecklist: [{ item: "rollback", satisfied: true, reason: "ok" }],
    observesOnly: true,
    changesRuntimeRouteInThisStep: false,
    callsConnectorInThisStep: false,
    invokesCursorInThisStep: false,
    invokesGithubInThisStep: false,
    wiresFeatureFlagInThisStep: false,
    writesDataInThisStep: false,
    findings: [],
  };
}

function mockRoutingShadowStage1Required(): ReturnType<
  typeof routingShadowModule.evaluateConnectorGatewayRoutingShadow
> {
  return {
    ...mockRoutingShadowReady(),
    decision: "defer",
    sourceRoutingRequiresStage1Regression: true,
    sourceRoutingScope: "github_only",
  };
}

function mockWireCandidateReady(): ReturnType<
  typeof wireCandidateModule.evaluateWritePathWireCandidateVerification
> {
  return {
    mode: "read_only_write_path_wire_candidate_verification",
    decision: "ready_for_wire_candidate_verification",
    requestedAgentTarget: "agent_execution_record",
    requestedOperatorTarget: "operator_approval",
    normalizedAgentTarget: "agent_execution_record",
    normalizedOperatorTarget: "operator_approval",
    sourceAgentWireGateDecision: "ready_for_write_path_wire_approval",
    sourceOperatorWireGateDecision: "ready_for_write_path_wire_approval",
    sourceSchemaMigrationReadinessDecision: "ready_for_schema_migration_pr_readiness",
    sourceSchemaMigrationRequestedAgentTarget: "agent_execution_record",
    sourceSchemaMigrationRequestedOperatorTarget: "operator_approval",
    sourceSchemaMigrationNormalizedAgentTarget: "agent_execution_record",
    sourceSchemaMigrationNormalizedOperatorTarget: "operator_approval",
    sourceSchemaMigrationAgentSchemaDecision: "ready_for_schema_pr_plan",
    sourceSchemaMigrationOperatorSchemaDecision: "ready_for_schema_pr_plan",
    sourceSchemaMigrationWriteAdapterDecision: "ready_for_adapter_design",
    sourceSchemaMigrationAgentRequiresSchemaChange: true,
    sourceSchemaMigrationOperatorRequiresSchemaChange: true,
    sourceSchemaMigrationAgentRequiresMigration: true,
    sourceSchemaMigrationOperatorRequiresMigration: true,
    sourceAgentWritePathTarget: "agent_execution_record",
    sourceOperatorWritePathTarget: "operator_approval",
    sourceAgentFeatureFlagName: "JYO_AGENT_FLAG",
    sourceOperatorFeatureFlagName: "JYO_OPERATOR_FLAG",
    sourceAgentSchemaApprovalDecision: "ready_for_explicit_schema_pr_approval",
    sourceOperatorSchemaApprovalDecision: "ready_for_explicit_schema_pr_approval",
    sourceAgentSchemaApprovalReferenceOnly: false,
    sourceOperatorSchemaApprovalReferenceOnly: false,
    sourceAgentBlockingFindingCodes: [],
    sourceOperatorBlockingFindingCodes: [],
    sourceAgentWireGateBlockingFindingCodes: [],
    sourceOperatorWireGateBlockingFindingCodes: [],
    sourceAgentWireGateApprovalChecklistCount: 1,
    sourceOperatorWireGateApprovalChecklistCount: 1,
    sourceAgentWireGateRuntimeChecklistCount: 1,
    sourceOperatorWireGateRuntimeChecklistCount: 1,
    sourceOperatorWireGatePermissionChecklistCount: 1,
    sourceOperatorWireGateAuditChecklistCount: 1,
    agentExplicitUserApprovalProvided: true,
    operatorExplicitUserApprovalProvided: true,
    schemaMigrationReadinessConfirmed: true,
    schemaMigrationReadinessReviewConfirmed: true,
    schemaAppliedInRuntime: false,
    migrationAppliedInRuntime: false,
    agentWriteAdapterImplementedConfirmed: true,
    operatorWriteAdapterImplementedConfirmed: true,
    operatorPermissionModelConfirmed: true,
    operatorAuditTrailConfirmed: true,
    candidateChecklist: [],
    safetyChecklist: [],
    rollbackChecklist: [{ item: "rollback", satisfied: true, reason: "ok" }],
    verifiesCandidateOnly: true,
    wiresWritePathInThisStep: false,
    wiresAdapterInThisStep: false,
    writesDataInThisStep: false,
    callsPrismaInThisStep: false,
    modifiesSchemaInThisStep: false,
    createsMigrationInThisStep: false,
    wiresFeatureFlagInThisStep: false,
    changesRuntimeRouteInThisStep: false,
    findings: [],
  };
}

const ALL_APPROVALS = {
  explicitShadowApproval: true,
  finalRuntimeApprovalConfirmed: true,
  routingShadowReviewConfirmed: true,
  wireCandidateReviewConfirmed: true,
  stage1RegressionReviewConfirmed: true,
  rollbackPlanReviewConfirmed: true,
  operatorAuditReviewConfirmed: true,
  schemaMigrationReadinessConfirmed: true,
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
} as const;

describe("multi-agent runtime change final approval package stage 2-E", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mode is read_only_runtime_change_final_approval_package", () => {
    expect(evaluateRuntimeChangeFinalApprovalPackage().mode).toBe(
      "read_only_runtime_change_final_approval_package",
    );
  });

  it("default decision is defer", () => {
    expect(evaluateRuntimeChangeFinalApprovalPackage().decision).toBe("defer");
  });

  it("packagesApprovalOnly is true", () => {
    expect(evaluateRuntimeChangeFinalApprovalPackage().packagesApprovalOnly).toBe(true);
  });

  it("changesRuntimeInThisStep is false", () => {
    expect(evaluateRuntimeChangeFinalApprovalPackage().changesRuntimeInThisStep).toBe(false);
  });

  it("changesConnectorRoutingInThisStep is false", () => {
    expect(evaluateRuntimeChangeFinalApprovalPackage().changesConnectorRoutingInThisStep).toBe(false);
  });

  it("wiresWritePathInThisStep is false", () => {
    expect(evaluateRuntimeChangeFinalApprovalPackage().wiresWritePathInThisStep).toBe(false);
  });

  it("wiresAdapterInThisStep is false", () => {
    expect(evaluateRuntimeChangeFinalApprovalPackage().wiresAdapterInThisStep).toBe(false);
  });

  it("wiresFeatureFlagInThisStep is false", () => {
    expect(evaluateRuntimeChangeFinalApprovalPackage().wiresFeatureFlagInThisStep).toBe(false);
  });

  it("writesDataInThisStep is false", () => {
    expect(evaluateRuntimeChangeFinalApprovalPackage().writesDataInThisStep).toBe(false);
  });

  it("callsPrismaInThisStep is false", () => {
    expect(evaluateRuntimeChangeFinalApprovalPackage().callsPrismaInThisStep).toBe(false);
  });

  it("modifiesSchemaInThisStep is false", () => {
    expect(evaluateRuntimeChangeFinalApprovalPackage().modifiesSchemaInThisStep).toBe(false);
  });

  it("createsMigrationInThisStep is false", () => {
    expect(evaluateRuntimeChangeFinalApprovalPackage().createsMigrationInThisStep).toBe(false);
  });

  it("executesGitInThisStep is false", () => {
    expect(evaluateRuntimeChangeFinalApprovalPackage().executesGitInThisStep).toBe(false);
  });

  it("callsCursorInThisStep is false", () => {
    expect(evaluateRuntimeChangeFinalApprovalPackage().callsCursorInThisStep).toBe(false);
  });

  it("callsGitHubInThisStep is false", () => {
    expect(evaluateRuntimeChangeFinalApprovalPackage().callsGitHubInThisStep).toBe(false);
  });

  it("routing shadow blocked returns blocked", () => {
    vi.spyOn(routingShadowModule, "evaluateConnectorGatewayRoutingShadow").mockReturnValue({
      ...mockRoutingShadowReady(),
      decision: "blocked",
    });
    vi.spyOn(wireCandidateModule, "evaluateWritePathWireCandidateVerification").mockReturnValue(
      mockWireCandidateReady(),
    );

    expect(evaluateRuntimeChangeFinalApprovalPackage(ALL_APPROVALS).decision).toBe("blocked");
  });

  it("wire candidate blocked returns blocked", () => {
    vi.spyOn(routingShadowModule, "evaluateConnectorGatewayRoutingShadow").mockReturnValue(
      mockRoutingShadowReady(),
    );
    vi.spyOn(wireCandidateModule, "evaluateWritePathWireCandidateVerification").mockReturnValue({
      ...mockWireCandidateReady(),
      decision: "blocked",
    });

    expect(evaluateRuntimeChangeFinalApprovalPackage(ALL_APPROVALS).decision).toBe("blocked");
  });

  it("routing shadow defer returns defer", () => {
    vi.spyOn(routingShadowModule, "evaluateConnectorGatewayRoutingShadow").mockReturnValue({
      ...mockRoutingShadowReady(),
      decision: "defer",
    });
    vi.spyOn(wireCandidateModule, "evaluateWritePathWireCandidateVerification").mockReturnValue(
      mockWireCandidateReady(),
    );

    expect(evaluateRuntimeChangeFinalApprovalPackage(ALL_APPROVALS).decision).toBe("defer");
  });

  it("wire candidate defer returns defer", () => {
    vi.spyOn(routingShadowModule, "evaluateConnectorGatewayRoutingShadow").mockReturnValue(
      mockRoutingShadowReady(),
    );
    vi.spyOn(wireCandidateModule, "evaluateWritePathWireCandidateVerification").mockReturnValue({
      ...mockWireCandidateReady(),
      decision: "defer",
    });

    expect(evaluateRuntimeChangeFinalApprovalPackage(ALL_APPROVALS).decision).toBe("defer");
  });

  it("finalRuntimeApprovalConfirmed false returns defer", () => {
    vi.spyOn(routingShadowModule, "evaluateConnectorGatewayRoutingShadow").mockReturnValue(
      mockRoutingShadowReady(),
    );
    vi.spyOn(wireCandidateModule, "evaluateWritePathWireCandidateVerification").mockReturnValue(
      mockWireCandidateReady(),
    );

    expect(
      evaluateRuntimeChangeFinalApprovalPackage({
        ...ALL_APPROVALS,
        finalRuntimeApprovalConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("routingShadowReviewConfirmed false returns defer", () => {
    vi.spyOn(routingShadowModule, "evaluateConnectorGatewayRoutingShadow").mockReturnValue(
      mockRoutingShadowReady(),
    );
    vi.spyOn(wireCandidateModule, "evaluateWritePathWireCandidateVerification").mockReturnValue(
      mockWireCandidateReady(),
    );

    expect(
      evaluateRuntimeChangeFinalApprovalPackage({
        ...ALL_APPROVALS,
        routingShadowReviewConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("wireCandidateReviewConfirmed false returns defer", () => {
    vi.spyOn(routingShadowModule, "evaluateConnectorGatewayRoutingShadow").mockReturnValue(
      mockRoutingShadowReady(),
    );
    vi.spyOn(wireCandidateModule, "evaluateWritePathWireCandidateVerification").mockReturnValue(
      mockWireCandidateReady(),
    );

    expect(
      evaluateRuntimeChangeFinalApprovalPackage({
        ...ALL_APPROVALS,
        wireCandidateReviewConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("stage1 regression required with review false returns defer", () => {
    vi.spyOn(routingShadowModule, "evaluateConnectorGatewayRoutingShadow").mockReturnValue(
      mockRoutingShadowStage1Required(),
    );
    vi.spyOn(wireCandidateModule, "evaluateWritePathWireCandidateVerification").mockReturnValue(
      mockWireCandidateReady(),
    );

    expect(
      evaluateRuntimeChangeFinalApprovalPackage({
        ...ALL_APPROVALS,
        stage1RegressionReviewConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("rollback required with review false returns defer", () => {
    vi.spyOn(routingShadowModule, "evaluateConnectorGatewayRoutingShadow").mockReturnValue({
      ...mockRoutingShadowReady(),
      sourceBranchManualVerificationRollbackRequired: true,
    });
    vi.spyOn(wireCandidateModule, "evaluateWritePathWireCandidateVerification").mockReturnValue(
      mockWireCandidateReady(),
    );

    expect(
      evaluateRuntimeChangeFinalApprovalPackage({
        ...ALL_APPROVALS,
        rollbackPlanReviewConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("operatorAuditReviewConfirmed false returns defer", () => {
    vi.spyOn(routingShadowModule, "evaluateConnectorGatewayRoutingShadow").mockReturnValue(
      mockRoutingShadowReady(),
    );
    vi.spyOn(wireCandidateModule, "evaluateWritePathWireCandidateVerification").mockReturnValue(
      mockWireCandidateReady(),
    );

    expect(
      evaluateRuntimeChangeFinalApprovalPackage({
        ...ALL_APPROVALS,
        operatorAuditReviewConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("all conditions satisfied returns ready_for_final_runtime_change_approval", () => {
    vi.spyOn(routingShadowModule, "evaluateConnectorGatewayRoutingShadow").mockReturnValue(
      mockRoutingShadowReady(),
    );
    vi.spyOn(wireCandidateModule, "evaluateWritePathWireCandidateVerification").mockReturnValue(
      mockWireCandidateReady(),
    );

    const report = evaluateRuntimeChangeFinalApprovalPackage({
      ...ALL_APPROVALS,
      routingTarget: "cursor_only",
      routingBoundaryIds: [...CURSOR_BOUNDARY],
    });
    expect(report.decision).toBe("ready_for_final_runtime_change_approval");
    expect(report.findings.some((f) => f.code === "final_runtime_change_approval_ready")).toBe(true);
  });

  it("finalApprovalChecklist includes routing shadow ready", () => {
    expect(
      checklistItem(
        evaluateRuntimeChangeFinalApprovalPackage(),
        "finalApprovalChecklist",
        "routing shadow ready",
      ),
    ).toBeDefined();
  });

  it("finalApprovalChecklist includes wire candidate verification ready", () => {
    expect(
      checklistItem(
        evaluateRuntimeChangeFinalApprovalPackage(),
        "finalApprovalChecklist",
        "wire candidate verification ready",
      ),
    ).toBeDefined();
  });

  it("runtimeSafetyChecklist includes no runtime change in this step satisfied", () => {
    expect(
      checklistItem(
        evaluateRuntimeChangeFinalApprovalPackage(),
        "runtimeSafetyChecklist",
        "no runtime change in this step",
      )?.satisfied,
    ).toBe(true);
  });

  it("runtimeSafetyChecklist includes no connector routing change in this step satisfied", () => {
    expect(
      checklistItem(
        evaluateRuntimeChangeFinalApprovalPackage(),
        "runtimeSafetyChecklist",
        "no connector routing change in this step",
      )?.satisfied,
    ).toBe(true);
  });

  it("runtimeSafetyChecklist includes no GitHub call in this step satisfied", () => {
    expect(
      checklistItem(
        evaluateRuntimeChangeFinalApprovalPackage(),
        "runtimeSafetyChecklist",
        "no GitHub call in this step",
      )?.satisfied,
    ).toBe(true);
  });

  it("rollbackChecklist includes manual recovery plan required before actual runtime change", () => {
    expect(
      checklistItem(
        evaluateRuntimeChangeFinalApprovalPackage(),
        "rollbackChecklist",
        "manual recovery plan required before actual runtime change",
      ),
    ).toBeDefined();
  });

  it("operatorChecklist includes operator approval required before actual runtime change", () => {
    expect(
      checklistItem(
        evaluateRuntimeChangeFinalApprovalPackage(),
        "operatorChecklist",
        "operator approval required before actual runtime change",
      ),
    ).toBeDefined();
  });

  it("defer state does not include final_runtime_change_approval_ready finding", () => {
    expect(
      evaluateRuntimeChangeFinalApprovalPackage().findings.some(
        (f) => f.code === "final_runtime_change_approval_ready",
      ),
    ).toBe(false);
  });

  it("blocked state includes runtime_change_final_approval_blocked finding", () => {
    vi.spyOn(routingShadowModule, "evaluateConnectorGatewayRoutingShadow").mockReturnValue({
      ...mockRoutingShadowReady(),
      decision: "blocked",
    });
    vi.spyOn(wireCandidateModule, "evaluateWritePathWireCandidateVerification").mockReturnValue(
      mockWireCandidateReady(),
    );

    const report = evaluateRuntimeChangeFinalApprovalPackage(ALL_APPROVALS);
    expect(report.decision).toBe("blocked");
    expect(report.findings.some((f) => f.code === "runtime_change_final_approval_blocked")).toBe(
      true,
    );
  });

  it("evaluator does not change runtime routing write feature flag DB schema migration git Cursor or GitHub", () => {
    const shadowSpy = vi.spyOn(routingShadowModule, "evaluateConnectorGatewayRoutingShadow");
    const wireSpy = vi.spyOn(wireCandidateModule, "evaluateWritePathWireCandidateVerification");

    const report = evaluateRuntimeChangeFinalApprovalPackage();

    expect(shadowSpy).toHaveBeenCalled();
    expect(wireSpy).toHaveBeenCalled();
    expect(report.changesRuntimeInThisStep).toBe(false);
    expect(report.changesConnectorRoutingInThisStep).toBe(false);
    expect(report.wiresWritePathInThisStep).toBe(false);
    expect(report.wiresFeatureFlagInThisStep).toBe(false);
    expect(report.writesDataInThisStep).toBe(false);
    expect(report.callsPrismaInThisStep).toBe(false);
    expect(report.modifiesSchemaInThisStep).toBe(false);
    expect(report.createsMigrationInThisStep).toBe(false);
    expect(report.executesGitInThisStep).toBe(false);
    expect(report.callsCursorInThisStep).toBe(false);
    expect(report.callsGitHubInThisStep).toBe(false);
  });
});
