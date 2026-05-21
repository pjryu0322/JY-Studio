/**
 * Evaluate runtime execution handoff candidate (read-only; no runtime/routing/write/DB/schema/git/Cursor/GitHub execution).
 */

import { evaluateStage2IntegratedClosureVerdict } from "@/lib/agents/evaluateStage2IntegratedClosureVerdict";
import type {
  RuntimeExecutionHandoffCandidateChecklistItem,
  RuntimeExecutionHandoffCandidateDecision,
  RuntimeExecutionHandoffCandidateFinding,
  RuntimeExecutionHandoffCandidateReport,
} from "@/lib/agents/runtimeExecutionHandoffCandidateTypes";

type ChecklistEntry = {
  readonly item: string;
  readonly satisfied: boolean;
  readonly detail: string;
};

type RuntimeExecutionHandoffCandidateInput = {
  readonly finalRuntimeApprovalConfirmed?: boolean;
  readonly routingShadowReviewConfirmed?: boolean;
  readonly wireCandidateReviewConfirmed?: boolean;
  readonly stage1RegressionReviewConfirmed?: boolean;
  readonly rollbackPlanReviewConfirmed?: boolean;
  readonly operatorAuditReviewConfirmed?: boolean;
  readonly explicitShadowApproval?: boolean;
  readonly agentTarget?: string;
  readonly operatorTarget?: string;
  readonly routingTarget?: string;
  readonly routingBoundaryIds?: readonly string[];
  readonly routingConnectorIds?: readonly string[];
  readonly agentExplicitUserApproval?: boolean;
  readonly operatorExplicitUserApproval?: boolean;
  readonly agentSchemaAppliedConfirmed?: boolean;
  readonly operatorSchemaAppliedConfirmed?: boolean;
  readonly agentMigrationAppliedConfirmed?: boolean;
  readonly operatorMigrationAppliedConfirmed?: boolean;
  readonly agentFeatureFlagWireApproved?: boolean;
  readonly operatorFeatureFlagWireApproved?: boolean;
  readonly agentWriteAdapterImplementedConfirmed?: boolean;
  readonly operatorWriteAdapterImplementedConfirmed?: boolean;
  readonly operatorPermissionModelConfirmed?: boolean;
  readonly operatorAuditTrailConfirmed?: boolean;
  readonly schemaMigrationReadinessConfirmed?: boolean;
  readonly schemaPrApproved?: boolean;
  readonly operatorAuditSchemaPrApproved?: boolean;
  readonly connectorExperimentBranchVerified?: boolean;
  readonly runtimeExecutionWireDesignApproved?: boolean;
  readonly featureFlagWireDesignApproved?: boolean;
};

function finding(
  severity: RuntimeExecutionHandoffCandidateFinding["severity"],
  code: string,
  message: string,
): RuntimeExecutionHandoffCandidateFinding {
  return { severity, code, message };
}

function checklistReason(input: ChecklistEntry): string {
  return `${input.item}: ${input.satisfied ? "satisfied" : "not satisfied"} — ${input.detail}`;
}

function mapChecklistEntries(
  entries: readonly ChecklistEntry[],
): RuntimeExecutionHandoffCandidateChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    satisfied: entry.satisfied,
    reason: checklistReason(entry),
  }));
}

function resolveSourceStage2NoRunBlocking(stage2: ReturnType<typeof evaluateStage2IntegratedClosureVerdict>): boolean {
  return (
    !stage2.stage2NoRunPolicySatisfied ||
    stage2.findings.some((f) => f.code === "stage2_no_run_policy_violated")
  );
}

function resolveSourceStage2PrerequisiteDeferred(stage2: ReturnType<typeof evaluateStage2IntegratedClosureVerdict>): boolean {
  return stage2.decision === "defer" && stage2.stage2NoRunPolicySatisfied === true;
}

function resolveHandoffDecision(input: {
  readonly stage2Decision: string;
  readonly stage2NoRunPolicySatisfied: boolean;
  readonly stage2ExitCriteriaSatisfied: boolean;
  readonly stage2HandoffReady: boolean;
  readonly schemaPrApproved: boolean;
  readonly operatorAuditSchemaPrApproved: boolean;
  readonly connectorExperimentBranchVerified: boolean;
  readonly runtimeExecutionWireDesignApproved: boolean;
  readonly featureFlagWireDesignApproved: boolean;
}): RuntimeExecutionHandoffCandidateDecision {
  if (input.stage2Decision === "blocked") {
    return "blocked";
  }

  if (!input.stage2NoRunPolicySatisfied) {
    return "blocked";
  }

  if (input.stage2Decision !== "stage2_closure_ready") {
    return "defer";
  }

  if (!input.stage2ExitCriteriaSatisfied) {
    return "defer";
  }

  if (!input.stage2HandoffReady) {
    return "defer";
  }

  if (!input.schemaPrApproved) {
    return "defer";
  }

  if (!input.operatorAuditSchemaPrApproved) {
    return "defer";
  }

  if (!input.connectorExperimentBranchVerified) {
    return "defer";
  }

  if (!input.runtimeExecutionWireDesignApproved) {
    return "defer";
  }

  if (!input.featureFlagWireDesignApproved) {
    return "defer";
  }

  return "ready_for_runtime_execution_handoff_design";
}

function buildRuntimeHandoffChecklist(input: {
  readonly stage2Decision: string;
  readonly stage2NoRunPolicySatisfied: boolean;
  readonly stage2ExitCriteriaSatisfied: boolean;
  readonly stage2HandoffReady: boolean;
  readonly schemaPrApproved: boolean;
  readonly operatorAuditSchemaPrApproved: boolean;
  readonly connectorExperimentBranchVerified: boolean;
  readonly runtimeExecutionWireDesignApproved: boolean;
  readonly featureFlagWireDesignApproved: boolean;
}): RuntimeExecutionHandoffCandidateChecklistItem[] {
  const entries: ChecklistEntry[] = [
    {
      item: "Stage 2 closure ready",
      satisfied: input.stage2Decision === "stage2_closure_ready",
      detail: `sourceStage2Decision=${input.stage2Decision}`,
    },
    {
      item: "Stage 2 no-run policy satisfied",
      satisfied: input.stage2NoRunPolicySatisfied,
      detail: `sourceStage2NoRunPolicySatisfied=${input.stage2NoRunPolicySatisfied}`,
    },
    {
      item: "Stage 2 exit criteria satisfied",
      satisfied: input.stage2ExitCriteriaSatisfied,
      detail: `sourceStage2ExitCriteriaSatisfied=${input.stage2ExitCriteriaSatisfied}`,
    },
    {
      item: "Stage 2 handoff ready",
      satisfied: input.stage2HandoffReady,
      detail: `sourceStage2HandoffReady=${input.stage2HandoffReady}`,
    },
    {
      item: "schema PR approved",
      satisfied: input.schemaPrApproved,
      detail: `schemaPrApproved=${input.schemaPrApproved}`,
    },
    {
      item: "operator audit schema PR approved",
      satisfied: input.operatorAuditSchemaPrApproved,
      detail: `operatorAuditSchemaPrApproved=${input.operatorAuditSchemaPrApproved}`,
    },
    {
      item: "connector experiment branch verified",
      satisfied: input.connectorExperimentBranchVerified,
      detail: `connectorExperimentBranchVerified=${input.connectorExperimentBranchVerified}`,
    },
    {
      item: "runtime execution wire design approved",
      satisfied: input.runtimeExecutionWireDesignApproved,
      detail: `runtimeExecutionWireDesignApproved=${input.runtimeExecutionWireDesignApproved}`,
    },
    {
      item: "feature flag wire design approved",
      satisfied: input.featureFlagWireDesignApproved,
      detail: `featureFlagWireDesignApproved=${input.featureFlagWireDesignApproved}`,
    },
  ];

  return mapChecklistEntries(entries);
}

function buildPreExecutionSafetyChecklist(): RuntimeExecutionHandoffCandidateChecklistItem[] {
  const entries: ChecklistEntry[] = [
    {
      item: "no runtime execution in this step",
      satisfied: true,
      detail: "executesRuntimeInThisStep=false; handoff evaluation only",
    },
    {
      item: "no connector routing change in this step",
      satisfied: true,
      detail: "changesConnectorRoutingInThisStep=false",
    },
    {
      item: "no write path wire in this step",
      satisfied: true,
      detail: "wiresWritePathInThisStep=false",
    },
    {
      item: "no DB write in this step",
      satisfied: true,
      detail: "writesDataInThisStep=false",
    },
    {
      item: "no Prisma call in this step",
      satisfied: true,
      detail: "callsPrismaInThisStep=false",
    },
    {
      item: "no schema change in this step",
      satisfied: true,
      detail: "modifiesSchemaInThisStep=false",
    },
    {
      item: "no migration in this step",
      satisfied: true,
      detail: "createsMigrationInThisStep=false",
    },
    {
      item: "no PR creation in this step",
      satisfied: true,
      detail: "createsPullRequestInThisStep=false",
    },
    {
      item: "no git execution in this step",
      satisfied: true,
      detail: "executesGitInThisStep=false",
    },
    {
      item: "no Cursor call in this step",
      satisfied: true,
      detail: "callsCursorInThisStep=false",
    },
    {
      item: "no GitHub call in this step",
      satisfied: true,
      detail: "callsGitHubInThisStep=false",
    },
  ];

  return mapChecklistEntries(entries);
}

function buildPrerequisitePolicyChecklist(): RuntimeExecutionHandoffCandidateChecklistItem[] {
  const entries: ChecklistEntry[] = [
    {
      item: "schema/migration PR required before runtime",
      satisfied: true,
      detail: "policy documented; requires separate schema/migration PR before actual runtime execution",
    },
    {
      item: "operator audit schema PR required before runtime",
      satisfied: true,
      detail: "policy documented; requires separate operator audit schema PR before actual runtime execution",
    },
    {
      item: "connector experiment branch required before runtime",
      satisfied: true,
      detail: "policy documented; requires connector gateway experiment branch verification before runtime switch",
    },
    {
      item: "runtime execution wire design required before runtime",
      satisfied: true,
      detail: "policy documented; requires runtime execution wire design approval before actual wire",
    },
    {
      item: "feature flag wire required before runtime",
      satisfied: true,
      detail: "policy documented; requires feature flag wire design approval before runtime execution",
    },
    {
      item: "operator approval remains required before actual execution",
      satisfied: true,
      detail: "policy documented; operator approval required in a later execution stage",
    },
    {
      item: "rollback plan remains required before actual execution",
      satisfied: true,
      detail: "policy documented; rollback plan required before actual route switch or runtime execution",
    },
    {
      item: "Stage1/ENV_TEST regression remains required before actual route switch",
      satisfied: true,
      detail: "policy documented; Stage1/ENV_TEST regression verification required before connector route switch",
    },
  ];

  return mapChecklistEntries(entries);
}

function buildPrerequisiteApprovalChecklist(input: {
  readonly schemaPrApproved: boolean;
  readonly operatorAuditSchemaPrApproved: boolean;
  readonly connectorExperimentBranchVerified: boolean;
  readonly runtimeExecutionWireDesignApproved: boolean;
  readonly featureFlagWireDesignApproved: boolean;
}): RuntimeExecutionHandoffCandidateChecklistItem[] {
  const entries: ChecklistEntry[] = [
    {
      item: "schemaPrApproved",
      satisfied: input.schemaPrApproved,
      detail: `schemaPrApproved=${input.schemaPrApproved}`,
    },
    {
      item: "operatorAuditSchemaPrApproved",
      satisfied: input.operatorAuditSchemaPrApproved,
      detail: `operatorAuditSchemaPrApproved=${input.operatorAuditSchemaPrApproved}`,
    },
    {
      item: "connectorExperimentBranchVerified",
      satisfied: input.connectorExperimentBranchVerified,
      detail: `connectorExperimentBranchVerified=${input.connectorExperimentBranchVerified}`,
    },
    {
      item: "runtimeExecutionWireDesignApproved",
      satisfied: input.runtimeExecutionWireDesignApproved,
      detail: `runtimeExecutionWireDesignApproved=${input.runtimeExecutionWireDesignApproved}`,
    },
    {
      item: "featureFlagWireDesignApproved",
      satisfied: input.featureFlagWireDesignApproved,
      detail: `featureFlagWireDesignApproved=${input.featureFlagWireDesignApproved}`,
    },
  ];

  return mapChecklistEntries(entries);
}

function appendHandoffFindings(input: {
  readonly findings: RuntimeExecutionHandoffCandidateFinding[];
  readonly decision: RuntimeExecutionHandoffCandidateDecision;
  readonly stage2Decision: string;
  readonly stage2NoRunPolicySatisfied: boolean;
  readonly schemaPrApproved: boolean;
  readonly operatorAuditSchemaPrApproved: boolean;
  readonly connectorExperimentBranchVerified: boolean;
  readonly runtimeExecutionWireDesignApproved: boolean;
  readonly featureFlagWireDesignApproved: boolean;
}): void {
  const { findings, decision, stage2Decision, stage2NoRunPolicySatisfied } = input;

  findings.push(
    finding(
      "info",
      "runtime_execution_handoff_candidate_read_only",
      "Runtime execution handoff candidate evaluation is read-only; no runtime execution",
    ),
  );
  findings.push(
    finding("info", "no_runtime_execution_in_this_step", "This step does not execute runtime changes"),
  );

  if (decision === "blocked") {
    if (stage2Decision === "blocked") {
      findings.push(finding("blocking", "stage2_closure_blocked", "Stage 2 integrated closure is blocked"));
    }
    if (!stage2NoRunPolicySatisfied) {
      findings.push(
        finding("blocking", "stage2_no_run_policy_violation", "Stage 2 no-run policy was not satisfied"),
      );
    }
    findings.push(
      finding("blocking", "runtime_handoff_candidate_blocked", "Runtime execution handoff candidate is blocked"),
    );
    return;
  }

  if (decision === "defer") {
    if (stage2Decision !== "stage2_closure_ready") {
      findings.push(finding("warning", "stage2_closure_not_ready", "Stage 2 closure is not ready"));
    }
    const missingPrerequisites: readonly {
      readonly satisfied: boolean;
      readonly code: string;
      readonly message: string;
    }[] = [
      {
        satisfied: input.schemaPrApproved,
        code: "schema_pr_approval_missing",
        message: "Schema PR approval is missing",
      },
      {
        satisfied: input.operatorAuditSchemaPrApproved,
        code: "operator_audit_schema_pr_approval_missing",
        message: "Operator audit schema PR approval is missing",
      },
      {
        satisfied: input.connectorExperimentBranchVerified,
        code: "connector_experiment_branch_verification_missing",
        message: "Connector experiment branch verification is missing",
      },
      {
        satisfied: input.runtimeExecutionWireDesignApproved,
        code: "runtime_execution_wire_design_approval_missing",
        message: "Runtime execution wire design approval is missing",
      },
      {
        satisfied: input.featureFlagWireDesignApproved,
        code: "feature_flag_wire_design_approval_missing",
        message: "Feature flag wire design approval is missing",
      },
    ];
    for (const prerequisite of missingPrerequisites) {
      if (!prerequisite.satisfied) {
        findings.push(finding("warning", prerequisite.code, prerequisite.message));
      }
    }
    findings.push(
      finding("warning", "runtime_handoff_candidate_deferred", "Runtime execution handoff candidate defers"),
    );
    return;
  }

  findings.push(finding("info", "stage2_closure_ready_source", "Stage 2 closure ready is the handoff source"));
  findings.push(
    finding(
      "info",
      "runtime_execution_handoff_design_ready",
      "Runtime execution handoff design candidate is ready; design candidate only, not actual execution permission",
    ),
  );
  findings.push(
    finding(
      "info",
      "actual_execution_requires_later_stage",
      "Actual runtime execution requires a later stage with operator approval and regression checks; no actual execution permission in this gate",
    ),
  );
}

/** Read-only runtime execution handoff candidate — does not execute runtime, routing, write, or external integrations. */
export function evaluateRuntimeExecutionHandoffCandidate(
  input?: RuntimeExecutionHandoffCandidateInput,
): RuntimeExecutionHandoffCandidateReport {
  const stage2 = evaluateStage2IntegratedClosureVerdict(input);

  const schemaPrApproved = input?.schemaPrApproved === true;
  const operatorAuditSchemaPrApproved = input?.operatorAuditSchemaPrApproved === true;
  const connectorExperimentBranchVerified = input?.connectorExperimentBranchVerified === true;
  const runtimeExecutionWireDesignApproved = input?.runtimeExecutionWireDesignApproved === true;
  const featureFlagWireDesignApproved = input?.featureFlagWireDesignApproved === true;

  const sourceStage2NoRunBlocking = resolveSourceStage2NoRunBlocking(stage2);
  const sourceStage2PrerequisiteDeferred = resolveSourceStage2PrerequisiteDeferred(stage2);

  const decision = resolveHandoffDecision({
    stage2Decision: stage2.decision,
    stage2NoRunPolicySatisfied: stage2.stage2NoRunPolicySatisfied,
    stage2ExitCriteriaSatisfied: stage2.stage2ExitCriteriaSatisfied,
    stage2HandoffReady: stage2.stage2HandoffReady,
    schemaPrApproved,
    operatorAuditSchemaPrApproved,
    connectorExperimentBranchVerified,
    runtimeExecutionWireDesignApproved,
    featureFlagWireDesignApproved,
  });

  const runtimeHandoffChecklist = buildRuntimeHandoffChecklist({
    stage2Decision: stage2.decision,
    stage2NoRunPolicySatisfied: stage2.stage2NoRunPolicySatisfied,
    stage2ExitCriteriaSatisfied: stage2.stage2ExitCriteriaSatisfied,
    stage2HandoffReady: stage2.stage2HandoffReady,
    schemaPrApproved,
    operatorAuditSchemaPrApproved,
    connectorExperimentBranchVerified,
    runtimeExecutionWireDesignApproved,
    featureFlagWireDesignApproved,
  });

  const prerequisiteApprovalChecklist = buildPrerequisiteApprovalChecklist({
    schemaPrApproved,
    operatorAuditSchemaPrApproved,
    connectorExperimentBranchVerified,
    runtimeExecutionWireDesignApproved,
    featureFlagWireDesignApproved,
  });

  const findings: RuntimeExecutionHandoffCandidateFinding[] = [];
  appendHandoffFindings({
    findings,
    decision,
    stage2Decision: stage2.decision,
    stage2NoRunPolicySatisfied: stage2.stage2NoRunPolicySatisfied,
    schemaPrApproved,
    operatorAuditSchemaPrApproved,
    connectorExperimentBranchVerified,
    runtimeExecutionWireDesignApproved,
    featureFlagWireDesignApproved,
  });

  return {
    mode: "read_only_runtime_execution_handoff_candidate",
    decision,
    sourceStage2Decision: stage2.decision,
    sourceStage2Scope: stage2.stage2Scope,
    sourceStage2ClosureSummary: stage2.stage2ClosureSummary,
    sourceStage2NoRunPolicySatisfied: stage2.stage2NoRunPolicySatisfied,
    sourceStage2ExitCriteriaSatisfied: stage2.stage2ExitCriteriaSatisfied,
    sourceStage2HandoffReady: stage2.stage2HandoffReady,
    sourceStage2RecommendedNextPhases: [...stage2.recommendedNextPhases],
    sourceStage2AggregatedBlockingFindingCodes: [...stage2.sourceAggregatedBlockingFindingCodes],
    sourceStage2NoRunBlocking,
    sourceStage2PrerequisiteDeferred,
    requiresSchemaPrBeforeRuntime: stage2.requiresSeparateSchemaPr,
    requiresOperatorAuditSchemaPrBeforeRuntime: stage2.requiresSeparateOperatorAuditSchemaPr,
    requiresConnectorExperimentBranchBeforeRuntime: stage2.requiresSeparateConnectorExperimentBranch,
    requiresRuntimeExecutionWireDesignBeforeRuntime: stage2.requiresSeparateRuntimeExecutionWireDesign,
    requiresFeatureFlagWireBeforeRuntime: stage2.requiresSeparateFeatureFlagWire,
    runtimeHandoffChecklist,
    preExecutionSafetyChecklist: buildPreExecutionSafetyChecklist(),
    prerequisitePolicyChecklist: buildPrerequisitePolicyChecklist(),
    prerequisiteApprovalChecklist,
    prerequisiteChecklist: prerequisiteApprovalChecklist,
    evaluatesHandoffOnly: true,
    executesRuntimeInThisStep: false,
    changesConnectorRoutingInThisStep: false,
    wiresWritePathInThisStep: false,
    writesDataInThisStep: false,
    callsPrismaInThisStep: false,
    modifiesSchemaInThisStep: false,
    createsMigrationInThisStep: false,
    createsPullRequestInThisStep: false,
    executesGitInThisStep: false,
    callsCursorInThisStep: false,
    callsGitHubInThisStep: false,
    findings,
  };
}
