/**
 * Evaluate runtime wire experiment review package (read-only; no runtime/routing/execution path/DB/git changes).
 */

import { checklistCounts } from "@/lib/agents/agentFieldDecisionUtils";
import { evaluateControlledExecutionPathCandidate } from "@/lib/agents/evaluateControlledExecutionPathCandidate";
import type {
  RuntimeWireExperimentReviewChecklistItem,
  RuntimeWireExperimentReviewFinding,
  RuntimeWireExperimentReviewPackageDecision,
  RuntimeWireExperimentReviewPackageReport,
} from "@/lib/agents/runtimeWireExperimentReviewPackageTypes";

const EXECUTION_PATH_READY = "ready_for_execution_path_review";
const REVIEW_PACKAGE_VERSION = "stage_4_e_v1" as const;
const REVIEW_PACKAGE_TITLE = "Runtime Wire Experiment Review Package (Read-Only)";

type RuntimeWireExperimentReviewPackageInput = Parameters<typeof evaluateControlledExecutionPathCandidate>[0] & {
  readonly runtimeWireReviewConfirmed?: boolean;
  readonly connectorGatewayReviewConfirmed?: boolean;
  readonly executionPathReviewConfirmedForPackage?: boolean;
  readonly featureFlagReviewConfirmedForPackage?: boolean;
  readonly rollbackReviewConfirmedForPackage?: boolean;
  readonly operatorFinalReviewConfirmed?: boolean;
};

type ChecklistEntry = {
  readonly item: string;
  readonly satisfied: boolean;
  readonly detail: string;
};

function resolveReviewPackageFlags(input?: RuntimeWireExperimentReviewPackageInput) {
  return {
    runtimeWireReviewConfirmed: input?.runtimeWireReviewConfirmed === true,
    connectorGatewayReviewConfirmed: input?.connectorGatewayReviewConfirmed === true,
    executionPathReviewConfirmedForPackage: input?.executionPathReviewConfirmedForPackage === true,
    featureFlagReviewConfirmedForPackage: input?.featureFlagReviewConfirmedForPackage === true,
    rollbackReviewConfirmedForPackage: input?.rollbackReviewConfirmedForPackage === true,
    operatorFinalReviewConfirmed: input?.operatorFinalReviewConfirmed === true,
  };
}

function finding(
  severity: RuntimeWireExperimentReviewFinding["severity"],
  code: string,
  message: string,
): RuntimeWireExperimentReviewFinding {
  return { severity, code, message };
}

function checklistReason(input: ChecklistEntry): string {
  return `${input.item}: ${input.satisfied ? "satisfied" : "not satisfied"} — ${input.detail}`;
}

function mapChecklistEntries(entries: readonly ChecklistEntry[]): RuntimeWireExperimentReviewChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    satisfied: entry.satisfied,
    reason: checklistReason(entry),
  }));
}

/** Deterministic review package fingerprint for Stage 4-E trace. */
export function buildRuntimeWireExperimentReviewFingerprint(input: {
  readonly sourceDecision: string;
  readonly sourceExecutionPathCandidateCount: number;
  readonly sourceExecutionPathCandidateSatisfiedCount: number;
  readonly sourceNoRunChecklistCount: number;
  readonly sourceNoRunChecklistSatisfiedCount: number;
  readonly runtimeWireReviewConfirmed: boolean;
  readonly connectorGatewayReviewConfirmed: boolean;
  readonly executionPathReviewConfirmedForPackage: boolean;
  readonly featureFlagReviewConfirmedForPackage: boolean;
  readonly rollbackReviewConfirmedForPackage: boolean;
  readonly operatorFinalReviewConfirmed: boolean;
}): string {
  return [
    "runtime-wire-review-v1",
    input.sourceDecision,
    `candidates-${input.sourceExecutionPathCandidateCount}-${input.sourceExecutionPathCandidateSatisfiedCount}`,
    `norun-${input.sourceNoRunChecklistCount}-${input.sourceNoRunChecklistSatisfiedCount}`,
    `runtime-${input.runtimeWireReviewConfirmed}`,
    `connector-${input.connectorGatewayReviewConfirmed}`,
    `path-${input.executionPathReviewConfirmedForPackage}`,
    `flag-${input.featureFlagReviewConfirmedForPackage}`,
    `rollback-${input.rollbackReviewConfirmedForPackage}`,
    `operator-${input.operatorFinalReviewConfirmed}`,
  ].join(":");
}

export type RuntimeWireExperimentReviewPackageDecisionInput = {
  readonly controlledExecutionPathDecision: string;
  readonly sourceNoRunChecklistCount: number;
  readonly sourceNoRunChecklistSatisfiedCount: number;
  readonly runtimeWireReviewConfirmed: boolean;
  readonly connectorGatewayReviewConfirmed: boolean;
  readonly executionPathReviewConfirmedForPackage: boolean;
  readonly featureFlagReviewConfirmedForPackage: boolean;
  readonly rollbackReviewConfirmedForPackage: boolean;
  readonly operatorFinalReviewConfirmed: boolean;
};

/** Pure decision helper for runtime wire experiment review package. */
export function resolveRuntimeWireExperimentReviewPackageDecision(
  input: RuntimeWireExperimentReviewPackageDecisionInput,
): RuntimeWireExperimentReviewPackageDecision {
  if (input.controlledExecutionPathDecision === "blocked") {
    return "blocked";
  }

  if (input.controlledExecutionPathDecision !== EXECUTION_PATH_READY) {
    return "defer";
  }

  if (input.sourceNoRunChecklistSatisfiedCount !== input.sourceNoRunChecklistCount) {
    return "blocked";
  }

  const packageReviewsSatisfied =
    input.runtimeWireReviewConfirmed &&
    input.connectorGatewayReviewConfirmed &&
    input.executionPathReviewConfirmedForPackage &&
    input.featureFlagReviewConfirmedForPackage &&
    input.rollbackReviewConfirmedForPackage &&
    input.operatorFinalReviewConfirmed;

  if (!packageReviewsSatisfied) {
    return "defer";
  }

  return "ready_for_stage4_closure_verdict";
}

function buildReviewPackageSummary(decision: RuntimeWireExperimentReviewPackageDecision): string {
  if (decision === "blocked") {
    return "Runtime wire experiment review package is blocked; source or no-run policy failed.";
  }

  if (decision === "defer") {
    return "Runtime wire experiment review package defers; required reviews are incomplete.";
  }

  return "Runtime wire experiment review package is ready for Stage 4-F integrated closure verdict. This is not runtime execution permission.";
}

function buildExperimentReadinessChecklist(input: {
  readonly controlledCandidate: ReturnType<typeof evaluateControlledExecutionPathCandidate>;
  readonly runtimeWireReviewConfirmed: boolean;
  readonly operatorFinalReviewConfirmed: boolean;
}): RuntimeWireExperimentReviewChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "source controlled execution path ready",
      satisfied: input.controlledCandidate.decision === EXECUTION_PATH_READY,
      detail: `sourceControlledExecutionPathDecision=${input.controlledCandidate.decision}`,
    },
    {
      item: "source execution path candidates satisfied",
      satisfied:
        input.controlledCandidate.executionPathCandidateSatisfiedCount ===
        input.controlledCandidate.executionPathCandidateCount,
      detail: `executionPathCandidateSatisfiedCount=${input.controlledCandidate.executionPathCandidateSatisfiedCount}`,
    },
    {
      item: "runtimeWireReviewConfirmed",
      satisfied: input.runtimeWireReviewConfirmed,
      detail: `runtimeWireReviewConfirmed=${input.runtimeWireReviewConfirmed}`,
    },
    {
      item: "operatorFinalReviewConfirmed",
      satisfied: input.operatorFinalReviewConfirmed,
      detail: `operatorFinalReviewConfirmed=${input.operatorFinalReviewConfirmed}`,
    },
  ]);
}

function buildConnectorGatewayChecklist(input: {
  readonly controlledCandidate: ReturnType<typeof evaluateControlledExecutionPathCandidate>;
  readonly connectorGatewayReviewConfirmed: boolean;
}): RuntimeWireExperimentReviewChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "source shadow routing ready",
      satisfied: input.controlledCandidate.sourceShadowRoutingDecision === "ready_for_shadow_routing_review",
      detail: `sourceShadowRoutingDecision=${input.controlledCandidate.sourceShadowRoutingDecision}`,
    },
    {
      item: "connectorGatewayReviewConfirmed",
      satisfied: input.connectorGatewayReviewConfirmed,
      detail: `connectorGatewayReviewConfirmed=${input.connectorGatewayReviewConfirmed}`,
    },
    {
      item: "source shadow routing route candidates satisfied",
      satisfied:
        input.controlledCandidate.sourceShadowRoutingRouteCandidateSatisfiedCount ===
        input.controlledCandidate.sourceShadowRoutingRouteCandidateCount,
      detail: `sourceShadowRoutingRouteCandidateSatisfiedCount=${input.controlledCandidate.sourceShadowRoutingRouteCandidateSatisfiedCount}`,
    },
  ]);
}

function buildExecutionPathChecklist(input: {
  readonly controlledCandidate: ReturnType<typeof evaluateControlledExecutionPathCandidate>;
  readonly executionPathReviewConfirmedForPackage: boolean;
}): RuntimeWireExperimentReviewChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "execution path candidate count",
      satisfied: input.controlledCandidate.executionPathCandidateCount >= 3,
      detail: `executionPathCandidateCount=${input.controlledCandidate.executionPathCandidateCount}`,
    },
    {
      item: "executionPathReviewConfirmedForPackage",
      satisfied: input.executionPathReviewConfirmedForPackage,
      detail: `executionPathReviewConfirmedForPackage=${input.executionPathReviewConfirmedForPackage}`,
    },
  ]);
}

function buildFeatureFlagChecklist(input: {
  readonly controlledCandidate: ReturnType<typeof evaluateControlledExecutionPathCandidate>;
  readonly featureFlagReviewConfirmedForPackage: boolean;
}): RuntimeWireExperimentReviewChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "source feature flag name present",
      satisfied: input.controlledCandidate.sourceFeatureFlagName.startsWith("JYO_"),
      detail: `sourceFeatureFlagName=${input.controlledCandidate.sourceFeatureFlagName}`,
    },
    {
      item: "source feature flag default off",
      satisfied: input.controlledCandidate.sourceFeatureFlagDefault === "off",
      detail: `sourceFeatureFlagDefault=${input.controlledCandidate.sourceFeatureFlagDefault}`,
    },
    {
      item: "featureFlagReviewConfirmedForPackage",
      satisfied: input.featureFlagReviewConfirmedForPackage,
      detail: `featureFlagReviewConfirmedForPackage=${input.featureFlagReviewConfirmedForPackage}`,
    },
  ]);
}

function buildRollbackChecklist(input: {
  readonly rollbackReviewConfirmedForPackage: boolean;
}): RuntimeWireExperimentReviewChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "rollbackReviewConfirmedForPackage",
      satisfied: input.rollbackReviewConfirmedForPackage,
      detail: `rollbackReviewConfirmedForPackage=${input.rollbackReviewConfirmedForPackage}`,
    },
    {
      item: "no execution path change in this step",
      satisfied: true,
      detail: "changesExecutionPathInThisStep=false",
    },
  ]);
}

function buildNoRunChecklist(): RuntimeWireExperimentReviewChecklistItem[] {
  return mapChecklistEntries([
    { item: "executesRuntimeInThisStep=false", satisfied: true, detail: "executesRuntimeInThisStep=false" },
    {
      item: "changesExecutionPathInThisStep=false",
      satisfied: true,
      detail: "changesExecutionPathInThisStep=false",
    },
    {
      item: "changesConnectorRoutingInThisStep=false",
      satisfied: true,
      detail: "changesConnectorRoutingInThisStep=false",
    },
    { item: "callsConnectorInThisStep=false", satisfied: true, detail: "callsConnectorInThisStep=false" },
    { item: "callsCursorInThisStep=false", satisfied: true, detail: "callsCursorInThisStep=false" },
    { item: "callsGitHubInThisStep=false", satisfied: true, detail: "callsGitHubInThisStep=false" },
    { item: "createsPullRequestInThisStep=false", satisfied: true, detail: "createsPullRequestInThisStep=false" },
    { item: "executesGitInThisStep=false", satisfied: true, detail: "executesGitInThisStep=false" },
    { item: "createsBranchInThisStep=false", satisfied: true, detail: "createsBranchInThisStep=false" },
    { item: "wiresWritePathInThisStep=false", satisfied: true, detail: "wiresWritePathInThisStep=false" },
    { item: "wiresFeatureFlagInThisStep=false", satisfied: true, detail: "wiresFeatureFlagInThisStep=false" },
    { item: "writesDataInThisStep=false", satisfied: true, detail: "writesDataInThisStep=false" },
    { item: "callsPrismaInThisStep=false", satisfied: true, detail: "callsPrismaInThisStep=false" },
    { item: "modifiesSchemaInThisStep=false", satisfied: true, detail: "modifiesSchemaInThisStep=false" },
    { item: "createsMigrationInThisStep=false", satisfied: true, detail: "createsMigrationInThisStep=false" },
  ]);
}

const RUNTIME_WIRE_REVIEW_PACKAGE_NO_RUN_REPORT = {
  executesRuntimeInThisStep: false,
  changesExecutionPathInThisStep: false,
  changesConnectorRoutingInThisStep: false,
  callsConnectorInThisStep: false,
  callsCursorInThisStep: false,
  callsGitHubInThisStep: false,
  createsPullRequestInThisStep: false,
  executesGitInThisStep: false,
  createsBranchInThisStep: false,
  wiresWritePathInThisStep: false,
  wiresFeatureFlagInThisStep: false,
  writesDataInThisStep: false,
  callsPrismaInThisStep: false,
  modifiesSchemaInThisStep: false,
  createsMigrationInThisStep: false,
} as const;

function appendReviewPackageFindings(input: {
  readonly findings: RuntimeWireExperimentReviewFinding[];
  readonly decision: RuntimeWireExperimentReviewPackageDecision;
  readonly controlledCandidate: ReturnType<typeof evaluateControlledExecutionPathCandidate>;
  readonly runtimeWireReviewConfirmed: boolean;
  readonly connectorGatewayReviewConfirmed: boolean;
  readonly executionPathReviewConfirmedForPackage: boolean;
  readonly featureFlagReviewConfirmedForPackage: boolean;
  readonly rollbackReviewConfirmedForPackage: boolean;
  readonly operatorFinalReviewConfirmed: boolean;
}): void {
  const { findings, decision, controlledCandidate } = input;

  findings.push(
    finding(
      "info",
      "runtime_wire_experiment_review_package_read_only",
      "Runtime wire experiment review package is read-only; no runtime change",
    ),
  );
  findings.push(finding("info", "runtime_wire_review_package_created", "Runtime wire review package created"));

  if (decision === "blocked") {
    if (controlledCandidate.decision === "blocked") {
      findings.push(
        finding("blocking", "source_controlled_execution_path_blocked", "Source controlled execution path is blocked"),
      );
    }
    if (controlledCandidate.noRunChecklistSatisfiedCount !== controlledCandidate.noRunChecklistCount) {
      findings.push(
        finding(
          "blocking",
          "source_controlled_execution_path_no_run_violation",
          "Source controlled execution path no-run checklist is not satisfied",
        ),
      );
    }
    findings.push(finding("blocking", "runtime_wire_experiment_review_package_blocked", "Review package is blocked"));
    return;
  }

  if (decision === "defer") {
    if (controlledCandidate.decision !== EXECUTION_PATH_READY) {
      findings.push(
        finding("warning", "source_controlled_execution_path_not_ready", "Source controlled execution path is not ready"),
      );
    }
    if (!input.runtimeWireReviewConfirmed) {
      findings.push(finding("warning", "runtime_wire_review_missing", "Runtime wire review is missing"));
    }
    if (!input.connectorGatewayReviewConfirmed) {
      findings.push(finding("warning", "connector_gateway_review_missing", "Connector gateway review is missing"));
    }
    if (!input.executionPathReviewConfirmedForPackage) {
      findings.push(
        finding("warning", "execution_path_review_for_package_missing", "Execution path review for package is missing"),
      );
    }
    if (!input.featureFlagReviewConfirmedForPackage) {
      findings.push(
        finding("warning", "feature_flag_review_for_package_missing", "Feature flag review for package is missing"),
      );
    }
    if (!input.rollbackReviewConfirmedForPackage) {
      findings.push(finding("warning", "rollback_review_for_package_missing", "Rollback review for package is missing"));
    }
    if (!input.operatorFinalReviewConfirmed) {
      findings.push(finding("warning", "operator_final_review_missing", "Operator final review is missing"));
    }
    findings.push(finding("warning", "runtime_wire_experiment_review_package_deferred", "Review package defers"));
    return;
  }

  findings.push(finding("info", "runtime_wire_experiment_review_package_ready", "Review package is ready"));
  findings.push(
    finding(
      "info",
      "ready_for_stage4_closure_verdict_not_runtime_permission",
      "Ready for Stage 4-F closure verdict; not runtime execution permission",
    ),
  );
}

/** Read-only runtime wire experiment review package — does not change runtime or routing. */
export function evaluateRuntimeWireExperimentReviewPackage(
  input?: RuntimeWireExperimentReviewPackageInput,
): RuntimeWireExperimentReviewPackageReport {
  const controlledCandidate = evaluateControlledExecutionPathCandidate(input);
  const flags = resolveReviewPackageFlags(input);

  const decision = resolveRuntimeWireExperimentReviewPackageDecision({
    controlledExecutionPathDecision: controlledCandidate.decision,
    sourceNoRunChecklistCount: controlledCandidate.noRunChecklistCount,
    sourceNoRunChecklistSatisfiedCount: controlledCandidate.noRunChecklistSatisfiedCount,
    ...flags,
  });

  const reviewFingerprint = buildRuntimeWireExperimentReviewFingerprint({
    sourceDecision: controlledCandidate.decision,
    sourceExecutionPathCandidateCount: controlledCandidate.executionPathCandidateCount,
    sourceExecutionPathCandidateSatisfiedCount: controlledCandidate.executionPathCandidateSatisfiedCount,
    sourceNoRunChecklistCount: controlledCandidate.noRunChecklistCount,
    sourceNoRunChecklistSatisfiedCount: controlledCandidate.noRunChecklistSatisfiedCount,
    ...flags,
  });

  const findings: RuntimeWireExperimentReviewFinding[] = [];
  appendReviewPackageFindings({
    findings,
    decision,
    controlledCandidate,
    ...flags,
  });

  const noRunChecklist = buildNoRunChecklist();
  const noRunCounts = checklistCounts(noRunChecklist);

  return {
    mode: "read_only_runtime_wire_experiment_review_package",
    stage: "stage_4_e",
    decision,
    sourceControlledExecutionPathDecision: controlledCandidate.decision,
    sourceExecutionPathCandidateCount: controlledCandidate.executionPathCandidateCount,
    sourceExecutionPathCandidateSatisfiedCount: controlledCandidate.executionPathCandidateSatisfiedCount,
    sourceNoRunChecklistCount: controlledCandidate.noRunChecklistCount,
    sourceNoRunChecklistSatisfiedCount: controlledCandidate.noRunChecklistSatisfiedCount,
    sourceFindingCodes: controlledCandidate.findings.map((f) => f.code),
    reviewPackageVersion: REVIEW_PACKAGE_VERSION,
    reviewPackageTitle: REVIEW_PACKAGE_TITLE,
    reviewPackageSummary: buildReviewPackageSummary(decision),
    reviewFingerprint,
    ...flags,
    experimentReadinessChecklist: buildExperimentReadinessChecklist({
      controlledCandidate,
      runtimeWireReviewConfirmed: flags.runtimeWireReviewConfirmed,
      operatorFinalReviewConfirmed: flags.operatorFinalReviewConfirmed,
    }),
    connectorGatewayChecklist: buildConnectorGatewayChecklist({
      controlledCandidate,
      connectorGatewayReviewConfirmed: flags.connectorGatewayReviewConfirmed,
    }),
    executionPathChecklist: buildExecutionPathChecklist({
      controlledCandidate,
      executionPathReviewConfirmedForPackage: flags.executionPathReviewConfirmedForPackage,
    }),
    featureFlagChecklist: buildFeatureFlagChecklist({
      controlledCandidate,
      featureFlagReviewConfirmedForPackage: flags.featureFlagReviewConfirmedForPackage,
    }),
    rollbackChecklist: buildRollbackChecklist({
      rollbackReviewConfirmedForPackage: flags.rollbackReviewConfirmedForPackage,
    }),
    noRunChecklist,
    noRunChecklistCount: noRunCounts.count,
    noRunChecklistSatisfiedCount: noRunCounts.satisfiedCount,
    ...RUNTIME_WIRE_REVIEW_PACKAGE_NO_RUN_REPORT,
    findings,
  };
}
