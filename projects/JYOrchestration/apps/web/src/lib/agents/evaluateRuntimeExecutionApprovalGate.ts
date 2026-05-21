/**
 * Evaluate runtime execution approval gate (read-only; no runtime/routing/write/DB/schema/git/Cursor/GitHub execution).
 */

import { evaluateRuntimeExecutionPlanPackage } from "@/lib/agents/evaluateRuntimeExecutionPlanPackage";
import type {
  RuntimeExecutionApprovalGateChecklistItem,
  RuntimeExecutionApprovalGateDecision,
  RuntimeExecutionApprovalGateFinding,
  RuntimeExecutionApprovalGateReport,
} from "@/lib/agents/runtimeExecutionApprovalGateTypes";

const PACKAGE_READY = "ready_for_runtime_execution_approval_gate";
const PLAN_READY = "ready_for_runtime_execution_plan_review";
const HANDOFF_READY = "ready_for_runtime_execution_handoff_design";

type RuntimeExecutionApprovalGateInput = Parameters<typeof evaluateRuntimeExecutionPlanPackage>[0] & {
  readonly operatorFinalApprovalConfirmed?: boolean;
  readonly riskAcknowledgementConfirmed?: boolean;
  readonly rollbackAcknowledgementConfirmed?: boolean;
  readonly executionWindowConfirmed?: boolean;
};

type ChecklistEntry = {
  readonly item: string;
  readonly satisfied: boolean;
  readonly detail: string;
};

function resolveConfirmationFlags(input?: RuntimeExecutionApprovalGateInput) {
  return {
    operatorFinalApprovalConfirmed: input?.operatorFinalApprovalConfirmed === true,
    riskAcknowledgementConfirmed: input?.riskAcknowledgementConfirmed === true,
    rollbackAcknowledgementConfirmed: input?.rollbackAcknowledgementConfirmed === true,
    executionWindowConfirmed: input?.executionWindowConfirmed === true,
  };
}

function finding(
  severity: RuntimeExecutionApprovalGateFinding["severity"],
  code: string,
  message: string,
): RuntimeExecutionApprovalGateFinding {
  return { severity, code, message };
}

function checklistReason(input: ChecklistEntry): string {
  return `${input.item}: ${input.satisfied ? "satisfied" : "not satisfied"} — ${input.detail}`;
}

function mapChecklistEntries(entries: readonly ChecklistEntry[]): RuntimeExecutionApprovalGateChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    satisfied: entry.satisfied,
    reason: checklistReason(entry),
  }));
}

function resolveApprovalGateDecision(input: {
  readonly packageDecision: string;
  readonly operatorFinalApprovalConfirmed: boolean;
  readonly riskAcknowledgementConfirmed: boolean;
  readonly rollbackAcknowledgementConfirmed: boolean;
  readonly executionWindowConfirmed: boolean;
}): RuntimeExecutionApprovalGateDecision {
  if (input.packageDecision === "blocked") {
    return "blocked";
  }

  if (input.packageDecision !== PACKAGE_READY) {
    return "defer";
  }

  if (!input.operatorFinalApprovalConfirmed) {
    return "defer";
  }

  if (!input.riskAcknowledgementConfirmed) {
    return "defer";
  }

  if (!input.rollbackAcknowledgementConfirmed) {
    return "defer";
  }

  if (!input.executionWindowConfirmed) {
    return "defer";
  }

  return "ready_for_controlled_runtime_wire_candidate";
}

function buildApprovalGateChecklist(input: {
  readonly planPackage: ReturnType<typeof evaluateRuntimeExecutionPlanPackage>;
  readonly operatorFinalApprovalConfirmed: boolean;
  readonly riskAcknowledgementConfirmed: boolean;
  readonly rollbackAcknowledgementConfirmed: boolean;
  readonly executionWindowConfirmed: boolean;
}): RuntimeExecutionApprovalGateChecklistItem[] {
  const readiness = input.planPackage.approvalReadiness;

  return mapChecklistEntries([
    {
      item: "source package ready",
      satisfied: input.planPackage.decision === PACKAGE_READY,
      detail: `sourcePackageDecision=${input.planPackage.decision}`,
    },
    {
      item: "source plan ready",
      satisfied: input.planPackage.sourcePlanDecision === PLAN_READY,
      detail: `sourcePlanDecision=${input.planPackage.sourcePlanDecision}`,
    },
    {
      item: "source handoff ready",
      satisfied: input.planPackage.sourceHandoffDecision === HANDOFF_READY,
      detail: `sourceHandoffDecision=${input.planPackage.sourceHandoffDecision}`,
    },
    {
      item: "source approval readiness complete",
      satisfied: readiness.readyCount === readiness.totalCount,
      detail: `readyCount=${readiness.readyCount}/${readiness.totalCount}`,
    },
    {
      item: "operatorFinalApprovalConfirmed",
      satisfied: input.operatorFinalApprovalConfirmed,
      detail: `operatorFinalApprovalConfirmed=${input.operatorFinalApprovalConfirmed}`,
    },
    {
      item: "riskAcknowledgementConfirmed",
      satisfied: input.riskAcknowledgementConfirmed,
      detail: `riskAcknowledgementConfirmed=${input.riskAcknowledgementConfirmed}`,
    },
    {
      item: "rollbackAcknowledgementConfirmed",
      satisfied: input.rollbackAcknowledgementConfirmed,
      detail: `rollbackAcknowledgementConfirmed=${input.rollbackAcknowledgementConfirmed}`,
    },
    {
      item: "executionWindowConfirmed",
      satisfied: input.executionWindowConfirmed,
      detail: `executionWindowConfirmed=${input.executionWindowConfirmed}`,
    },
  ]);
}

function buildRiskChecklist(): RuntimeExecutionApprovalGateChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "Stage1 regression reviewed before execution",
      satisfied: true,
      detail: "read-only gate; execution not performed in this step",
    },
    {
      item: "rollback path reviewed before execution",
      satisfied: true,
      detail: "read-only gate; execution not performed in this step",
    },
    {
      item: "schema/migration prerequisites separated",
      satisfied: true,
      detail: "schema/migration changes remain separate PR stages",
    },
    {
      item: "Connector Gateway routing not changed in this step",
      satisfied: true,
      detail: "changesConnectorRoutingInThisStep=false",
    },
    {
      item: "write path wire not changed in this step",
      satisfied: true,
      detail: "wiresWritePathInThisStep=false",
    },
    {
      item: "feature flag not wired in this step",
      satisfied: true,
      detail: "wiresFeatureFlagInThisStep=false",
    },
    {
      item: "controlled runtime wire candidate required next",
      satisfied: true,
      detail: "Stage 3-C required after approval gate ready",
    },
  ]);
}

function buildNoRunChecklist(): RuntimeExecutionApprovalGateChecklistItem[] {
  return mapChecklistEntries([
    { item: "no runtime execution in this step", satisfied: true, detail: "executesRuntimeInThisStep=false" },
    {
      item: "no connector routing change in this step",
      satisfied: true,
      detail: "changesConnectorRoutingInThisStep=false",
    },
    { item: "no write path wire in this step", satisfied: true, detail: "wiresWritePathInThisStep=false" },
    { item: "no feature flag wire in this step", satisfied: true, detail: "wiresFeatureFlagInThisStep=false" },
    { item: "no DB write in this step", satisfied: true, detail: "writesDataInThisStep=false" },
    { item: "no Prisma call in this step", satisfied: true, detail: "callsPrismaInThisStep=false" },
    { item: "no schema change in this step", satisfied: true, detail: "modifiesSchemaInThisStep=false" },
    { item: "no migration in this step", satisfied: true, detail: "createsMigrationInThisStep=false" },
    { item: "no PR creation in this step", satisfied: true, detail: "createsPullRequestInThisStep=false" },
    { item: "no git execution in this step", satisfied: true, detail: "executesGitInThisStep=false" },
    { item: "no Cursor call in this step", satisfied: true, detail: "callsCursorInThisStep=false" },
    { item: "no GitHub call in this step", satisfied: true, detail: "callsGitHubInThisStep=false" },
  ]);
}

function buildHandoffChecklist(input: {
  readonly planFingerprint: string;
}): RuntimeExecutionApprovalGateChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "source package fingerprint captured",
      satisfied: input.planFingerprint.length > 0,
      detail: `sourcePlanFingerprint=${input.planFingerprint}`,
    },
    {
      item: "approval gate is read-only",
      satisfied: true,
      detail: "evaluatesApprovalOnly=true",
    },
    {
      item: "Stage 3-C is required for controlled runtime wire candidate",
      satisfied: true,
      detail: "Stage 3-C follows approval gate ready",
    },
    {
      item: "actual execution remains blocked until explicit executor stage",
      satisfied: true,
      detail: "not actual runtime execution permission",
    },
  ]);
}

function appendApprovalGateFindings(input: {
  readonly findings: RuntimeExecutionApprovalGateFinding[];
  readonly decision: RuntimeExecutionApprovalGateDecision;
  readonly packageDecision: string;
  readonly operatorFinalApprovalConfirmed: boolean;
  readonly riskAcknowledgementConfirmed: boolean;
  readonly rollbackAcknowledgementConfirmed: boolean;
  readonly executionWindowConfirmed: boolean;
}): void {
  const { findings, decision, packageDecision } = input;

  findings.push(
    finding(
      "info",
      "runtime_execution_approval_gate_read_only",
      "Runtime execution approval gate is read-only; no runtime execution",
    ),
  );

  if (decision === "blocked") {
    if (packageDecision === "blocked") {
      findings.push(finding("blocking", "source_package_blocked", "Source plan package is blocked"));
    }
    findings.push(
      finding("blocking", "runtime_execution_approval_gate_blocked", "Runtime execution approval gate is blocked"),
    );
    return;
  }

  if (decision === "defer") {
    if (packageDecision !== PACKAGE_READY) {
      findings.push(finding("warning", "source_package_not_ready", "Source plan package is not ready for approval gate"));
    }
    if (!input.operatorFinalApprovalConfirmed) {
      findings.push(finding("warning", "operator_final_approval_missing", "Operator final approval is missing"));
    }
    if (!input.riskAcknowledgementConfirmed) {
      findings.push(finding("warning", "risk_acknowledgement_missing", "Risk acknowledgement is missing"));
    }
    if (!input.rollbackAcknowledgementConfirmed) {
      findings.push(finding("warning", "rollback_acknowledgement_missing", "Rollback acknowledgement is missing"));
    }
    if (!input.executionWindowConfirmed) {
      findings.push(finding("warning", "execution_window_missing", "Execution window confirmation is missing"));
    }
    findings.push(finding("warning", "approval_gate_deferred", "Runtime execution approval gate defers"));
    return;
  }

  findings.push(finding("info", "approval_gate_evaluated", "Approval gate evaluated"));
  findings.push(finding("info", "source_package_ready", "Source plan package is ready for approval gate"));
  findings.push(
    finding(
      "info",
      "controlled_runtime_wire_candidate_next",
      "Approval gate ready; not actual runtime execution; Stage 3-C controlled runtime wire candidate required",
    ),
  );
}

/** Read-only runtime execution approval gate — does not execute runtime, routing, write, or external integrations. */
export function evaluateRuntimeExecutionApprovalGate(
  input?: RuntimeExecutionApprovalGateInput,
): RuntimeExecutionApprovalGateReport {
  const planPackage = evaluateRuntimeExecutionPlanPackage(input);
  const {
    operatorFinalApprovalConfirmed,
    riskAcknowledgementConfirmed,
    rollbackAcknowledgementConfirmed,
    executionWindowConfirmed,
  } = resolveConfirmationFlags(input);

  const decision = resolveApprovalGateDecision({
    packageDecision: planPackage.decision,
    operatorFinalApprovalConfirmed,
    riskAcknowledgementConfirmed,
    rollbackAcknowledgementConfirmed,
    executionWindowConfirmed,
  });

  const findings: RuntimeExecutionApprovalGateFinding[] = [];
  appendApprovalGateFindings({
    findings,
    decision,
    packageDecision: planPackage.decision,
    operatorFinalApprovalConfirmed,
    riskAcknowledgementConfirmed,
    rollbackAcknowledgementConfirmed,
    executionWindowConfirmed,
  });

  return {
    mode: "read_only_runtime_execution_approval_gate",
    stage: "stage_3_b",
    decision,
    sourcePackageDecision: planPackage.decision,
    sourcePlanDecision: planPackage.sourcePlanDecision,
    sourceHandoffDecision: planPackage.sourceHandoffDecision,
    sourceStage2Decision: planPackage.sourceStage2Decision,
    sourcePlanFingerprint: planPackage.sourcePlanFingerprint,
    sourceApprovalReadinessReadyCount: planPackage.approvalReadiness.readyCount,
    sourceApprovalReadinessTotalCount: planPackage.approvalReadiness.totalCount,
    sourceApprovalReadinessMissing: planPackage.approvalReadiness.missing,
    operatorFinalApprovalConfirmed,
    riskAcknowledgementConfirmed,
    rollbackAcknowledgementConfirmed,
    executionWindowConfirmed,
    approvalGateChecklist: buildApprovalGateChecklist({
      planPackage,
      operatorFinalApprovalConfirmed,
      riskAcknowledgementConfirmed,
      rollbackAcknowledgementConfirmed,
      executionWindowConfirmed,
    }),
    riskChecklist: buildRiskChecklist(),
    noRunChecklist: buildNoRunChecklist(),
    handoffChecklist: buildHandoffChecklist({ planFingerprint: planPackage.sourcePlanFingerprint }),
    evaluatesApprovalOnly: true,
    executesRuntimeInThisStep: false,
    changesConnectorRoutingInThisStep: false,
    wiresWritePathInThisStep: false,
    wiresFeatureFlagInThisStep: false,
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
