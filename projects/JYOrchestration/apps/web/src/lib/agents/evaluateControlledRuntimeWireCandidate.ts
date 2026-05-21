/**
 * Evaluate controlled runtime wire candidate (read-only; no runtime/routing/write/DB/schema/git/Cursor/GitHub execution).
 */

import { evaluateRuntimeExecutionApprovalGate } from "@/lib/agents/evaluateRuntimeExecutionApprovalGate";
import type {
  ControlledRuntimeWireCandidateChecklistItem,
  ControlledRuntimeWireCandidateDecision,
  ControlledRuntimeWireCandidateFinding,
  ControlledRuntimeWireCandidateItem,
  ControlledRuntimeWireCandidateKind,
  ControlledRuntimeWireCandidateReport,
} from "@/lib/agents/controlledRuntimeWireCandidateTypes";

const GATE_READY = "ready_for_controlled_runtime_wire_candidate";
const PACKAGE_READY = "ready_for_runtime_execution_approval_gate";
const PLAN_READY = "ready_for_runtime_execution_plan_review";
const CANDIDATE_TITLE = "Controlled Runtime Wire Candidate (Read-Only)";

type ControlledRuntimeWireCandidateInput = Parameters<typeof evaluateRuntimeExecutionApprovalGate>[0] & {
  readonly controlledWireCandidateReviewConfirmed?: boolean;
  readonly runtimeWireExperimentBranchRequired?: boolean;
  readonly featureFlagWirePlanConfirmed?: boolean;
};

type ChecklistEntry = {
  readonly item: string;
  readonly satisfied: boolean;
  readonly detail: string;
};

type WireCandidateSpec = {
  readonly sequence: number;
  readonly kind: ControlledRuntimeWireCandidateKind;
  readonly title: string;
  readonly target: string;
  readonly readinessKey: string;
};

const WIRE_CANDIDATE_SPECS: readonly WireCandidateSpec[] = [
  {
    sequence: 1,
    kind: "agent_execution_record_write_path",
    title: "Agent Execution Record Write Path",
    target: "agent_execution_record",
    readinessKey: "schemaPrerequisitesReady",
  },
  {
    sequence: 2,
    kind: "operator_approval_audit_write_path",
    title: "Operator Approval Audit Write Path",
    target: "operator_approval",
    readinessKey: "operatorApprovalReady",
  },
  {
    sequence: 3,
    kind: "connector_gateway_shadow_routing",
    title: "Connector Gateway Shadow Routing",
    target: "connector_gateway",
    readinessKey: "connectorExperimentReady",
  },
  {
    sequence: 4,
    kind: "feature_flag_wire",
    title: "Feature Flag Wire",
    target: "feature_flag",
    readinessKey: "featureFlagWireReady",
  },
  {
    sequence: 5,
    kind: "runtime_execution_boundary",
    title: "Runtime Execution Boundary",
    target: "runtime_execution_boundary",
    readinessKey: "runtimeWireDesignReady",
  },
];

function buildControlledRuntimeWireCandidateFingerprint(input: {
  readonly sourceApprovalGateDecision: string;
  readonly sourceApprovalGateFingerprint: string;
  readonly controlledWireCandidateReviewConfirmed: boolean;
  readonly runtimeWireExperimentBranchRequired: boolean;
  readonly featureFlagWirePlanConfirmed: boolean;
}): string {
  return [
    "controlled-wire-candidate-v1",
    input.sourceApprovalGateDecision,
    input.sourceApprovalGateFingerprint,
    `review-${input.controlledWireCandidateReviewConfirmed}`,
    `branch-${input.runtimeWireExperimentBranchRequired}`,
    `flag-${input.featureFlagWirePlanConfirmed}`,
  ].join(":");
}

function resolveReviewFlags(input?: ControlledRuntimeWireCandidateInput) {
  return {
    controlledWireCandidateReviewConfirmed: input?.controlledWireCandidateReviewConfirmed === true,
    runtimeWireExperimentBranchRequired: input?.runtimeWireExperimentBranchRequired === true,
    featureFlagWirePlanConfirmed: input?.featureFlagWirePlanConfirmed === true,
  };
}

function finding(
  severity: ControlledRuntimeWireCandidateFinding["severity"],
  code: string,
  message: string,
): ControlledRuntimeWireCandidateFinding {
  return { severity, code, message };
}

function checklistReason(input: ChecklistEntry): string {
  return `${input.item}: ${input.satisfied ? "satisfied" : "not satisfied"} — ${input.detail}`;
}

function mapChecklistEntries(entries: readonly ChecklistEntry[]): ControlledRuntimeWireCandidateChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    satisfied: entry.satisfied,
    reason: checklistReason(entry),
  }));
}

function readinessSatisfied(missing: readonly string[], readinessKey: string): boolean {
  return !missing.includes(readinessKey);
}

function buildWireCandidateReason(input: {
  readonly sourceApprovalGateDecision: string;
  readonly target: string;
  readonly satisfied: boolean;
}): string {
  return (
    `sourceApprovalGateDecision=${input.sourceApprovalGateDecision}; target=${input.target}; ` +
    `readinessSatisfied=${input.satisfied}; no actual wire; requires Stage 4 experiment/approval`
  );
}

function buildWireCandidates(input: {
  readonly approvalGate: ReturnType<typeof evaluateRuntimeExecutionApprovalGate>;
}): ControlledRuntimeWireCandidateItem[] {
  const missing = input.approvalGate.sourceApprovalReadinessMissing;

  return WIRE_CANDIDATE_SPECS.map((spec) => {
    const satisfied = readinessSatisfied(missing, spec.readinessKey);
    return {
      sequence: spec.sequence,
      kind: spec.kind,
      title: spec.title,
      target: spec.target,
      required: true,
      satisfied,
      reason: buildWireCandidateReason({
        sourceApprovalGateDecision: input.approvalGate.decision,
        target: spec.target,
        satisfied,
      }),
      wiresInThisStep: false as const,
      executesInThisStep: false as const,
    };
  });
}

function buildCandidateSummary(input: {
  readonly decision: ControlledRuntimeWireCandidateDecision;
  readonly approvalGateDecision: string;
}): string {
  if (input.decision === "ready_for_runtime_wire_experiment_branch") {
    return (
      "Controlled runtime wire candidate is ready for runtime wire experiment branch planning. " +
      "Not actual wire or branch creation; Stage 4-A experiment branch approval is required."
    );
  }

  if (input.decision === "blocked") {
    return "Controlled runtime wire candidate is blocked because the source approval gate is blocked.";
  }

  return (
    "Controlled runtime wire candidate defers. Complete source approval gate readiness, " +
    "controlled wire candidate review, runtime wire experiment branch requirement, and feature flag wire plan confirmation."
  );
}

function resolveCandidateDecision(input: {
  readonly approvalGateDecision: string;
  readonly controlledWireCandidateReviewConfirmed: boolean;
  readonly runtimeWireExperimentBranchRequired: boolean;
  readonly featureFlagWirePlanConfirmed: boolean;
}): ControlledRuntimeWireCandidateDecision {
  if (input.approvalGateDecision === "blocked") {
    return "blocked";
  }

  if (input.approvalGateDecision !== GATE_READY) {
    return "defer";
  }

  if (!input.controlledWireCandidateReviewConfirmed) {
    return "defer";
  }

  if (!input.runtimeWireExperimentBranchRequired) {
    return "defer";
  }

  if (!input.featureFlagWirePlanConfirmed) {
    return "defer";
  }

  return "ready_for_runtime_wire_experiment_branch";
}

function buildCandidateChecklist(input: {
  readonly approvalGate: ReturnType<typeof evaluateRuntimeExecutionApprovalGate>;
  readonly wireCandidates: readonly ControlledRuntimeWireCandidateItem[];
  readonly controlledWireCandidateReviewConfirmed: boolean;
  readonly runtimeWireExperimentBranchRequired: boolean;
  readonly featureFlagWirePlanConfirmed: boolean;
}): ControlledRuntimeWireCandidateChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "source approval gate ready",
      satisfied: input.approvalGate.decision === GATE_READY,
      detail: `sourceApprovalGateDecision=${input.approvalGate.decision}`,
    },
    {
      item: "source package ready",
      satisfied: input.approvalGate.sourcePackageDecision === PACKAGE_READY,
      detail: `sourcePackageDecision=${input.approvalGate.sourcePackageDecision}`,
    },
    {
      item: "source plan ready",
      satisfied: input.approvalGate.sourcePlanDecision === PLAN_READY,
      detail: `sourcePlanDecision=${input.approvalGate.sourcePlanDecision}`,
    },
    {
      item: "source approval gate fingerprint captured",
      satisfied: input.approvalGate.gateFingerprint.length > 0,
      detail: `sourceApprovalGateFingerprint=${input.approvalGate.gateFingerprint}`,
    },
    {
      item: "five wire candidates generated",
      satisfied: input.wireCandidates.length === 5,
      detail: `wireCandidates.length=${input.wireCandidates.length}`,
    },
    {
      item: "controlledWireCandidateReviewConfirmed",
      satisfied: input.controlledWireCandidateReviewConfirmed,
      detail: `controlledWireCandidateReviewConfirmed=${input.controlledWireCandidateReviewConfirmed}`,
    },
    {
      item: "runtimeWireExperimentBranchRequired",
      satisfied: input.runtimeWireExperimentBranchRequired,
      detail: `runtimeWireExperimentBranchRequired=${input.runtimeWireExperimentBranchRequired}`,
    },
    {
      item: "featureFlagWirePlanConfirmed",
      satisfied: input.featureFlagWirePlanConfirmed,
      detail: `featureFlagWirePlanConfirmed=${input.featureFlagWirePlanConfirmed}`,
    },
  ]);
}

function buildSafetyChecklist(): ControlledRuntimeWireCandidateChecklistItem[] {
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

function buildHandoffChecklist(): ControlledRuntimeWireCandidateChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "Stage 4-A runtime wire experiment branch required",
      satisfied: true,
      detail: "Stage 4-A follows controlled wire candidate ready",
    },
    {
      item: "actual branch creation is not performed in this step",
      satisfied: true,
      detail: "no git execution in this step",
    },
    {
      item: "actual routing change is not performed in this step",
      satisfied: true,
      detail: "changesConnectorRoutingInThisStep=false",
    },
    {
      item: "actual write path wire is not performed in this step",
      satisfied: true,
      detail: "wiresWritePathInThisStep=false",
    },
    {
      item: "actual feature flag wire is not performed in this step",
      satisfied: true,
      detail: "wiresFeatureFlagInThisStep=false",
    },
  ]);
}

function appendCandidateFindings(input: {
  readonly findings: ControlledRuntimeWireCandidateFinding[];
  readonly decision: ControlledRuntimeWireCandidateDecision;
  readonly approvalGateDecision: string;
  readonly controlledWireCandidateReviewConfirmed: boolean;
  readonly runtimeWireExperimentBranchRequired: boolean;
  readonly featureFlagWirePlanConfirmed: boolean;
}): void {
  const { findings, decision, approvalGateDecision } = input;

  findings.push(
    finding(
      "info",
      "controlled_runtime_wire_candidate_read_only",
      "Controlled runtime wire candidate is read-only; no actual wire",
    ),
  );

  if (decision === "blocked") {
    if (approvalGateDecision === "blocked") {
      findings.push(finding("blocking", "source_approval_gate_blocked", "Source approval gate is blocked"));
    }
    findings.push(
      finding("blocking", "controlled_runtime_wire_candidate_blocked", "Controlled runtime wire candidate is blocked"),
    );
    return;
  }

  if (decision === "defer") {
    if (approvalGateDecision !== GATE_READY) {
      findings.push(finding("warning", "source_approval_gate_not_ready", "Source approval gate is not ready"));
    }
    if (!input.controlledWireCandidateReviewConfirmed) {
      findings.push(
        finding("warning", "controlled_wire_candidate_review_missing", "Controlled wire candidate review is missing"),
      );
    }
    if (!input.runtimeWireExperimentBranchRequired) {
      findings.push(
        finding(
          "warning",
          "runtime_wire_experiment_branch_required_missing",
          "Runtime wire experiment branch requirement is missing",
        ),
      );
    }
    if (!input.featureFlagWirePlanConfirmed) {
      findings.push(finding("warning", "feature_flag_wire_plan_missing", "Feature flag wire plan confirmation is missing"));
    }
    findings.push(
      finding("warning", "controlled_runtime_wire_candidate_deferred", "Controlled runtime wire candidate defers"),
    );
    return;
  }

  findings.push(finding("info", "wire_candidates_generated", "Five controlled runtime wire candidates generated"));
  findings.push(
    finding(
      "info",
      "controlled_runtime_wire_candidate_ready_for_experiment_branch",
      "Wire candidate ready for experiment branch; not actual wire or branch creation",
    ),
  );
  findings.push(
    finding(
      "info",
      "actual_wire_requires_stage_4_or_later",
      "Actual wire, routing change, and branch creation require Stage 4-A or later",
    ),
  );
}

/** Read-only controlled runtime wire candidate — does not wire runtime, routing, write path, or external integrations. */
export function evaluateControlledRuntimeWireCandidate(
  input?: ControlledRuntimeWireCandidateInput,
): ControlledRuntimeWireCandidateReport {
  const approvalGate = evaluateRuntimeExecutionApprovalGate(input);
  const {
    controlledWireCandidateReviewConfirmed,
    runtimeWireExperimentBranchRequired,
    featureFlagWirePlanConfirmed,
  } = resolveReviewFlags(input);

  const decision = resolveCandidateDecision({
    approvalGateDecision: approvalGate.decision,
    controlledWireCandidateReviewConfirmed,
    runtimeWireExperimentBranchRequired,
    featureFlagWirePlanConfirmed,
  });

  const wireCandidates = buildWireCandidates({ approvalGate });

  const candidateFingerprint = buildControlledRuntimeWireCandidateFingerprint({
    sourceApprovalGateDecision: approvalGate.decision,
    sourceApprovalGateFingerprint: approvalGate.gateFingerprint,
    controlledWireCandidateReviewConfirmed,
    runtimeWireExperimentBranchRequired,
    featureFlagWirePlanConfirmed,
  });

  const candidateSummary = buildCandidateSummary({ decision, approvalGateDecision: approvalGate.decision });

  const findings: ControlledRuntimeWireCandidateFinding[] = [];
  appendCandidateFindings({
    findings,
    decision,
    approvalGateDecision: approvalGate.decision,
    controlledWireCandidateReviewConfirmed,
    runtimeWireExperimentBranchRequired,
    featureFlagWirePlanConfirmed,
  });

  return {
    mode: "read_only_controlled_runtime_wire_candidate",
    stage: "stage_3_c",
    decision,
    sourceApprovalGateDecision: approvalGate.decision,
    sourcePackageDecision: approvalGate.sourcePackageDecision,
    sourcePlanDecision: approvalGate.sourcePlanDecision,
    sourcePlanFingerprint: approvalGate.sourcePlanFingerprint,
    sourceApprovalGateFingerprint: approvalGate.gateFingerprint,
    candidateVersion: 1,
    candidateTitle: CANDIDATE_TITLE,
    candidateSummary,
    candidateFingerprint,
    wireCandidates,
    candidateChecklist: buildCandidateChecklist({
      approvalGate,
      wireCandidates,
      controlledWireCandidateReviewConfirmed,
      runtimeWireExperimentBranchRequired,
      featureFlagWirePlanConfirmed,
    }),
    safetyChecklist: buildSafetyChecklist(),
    handoffChecklist: buildHandoffChecklist(),
    buildsWireCandidateOnly: true,
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
