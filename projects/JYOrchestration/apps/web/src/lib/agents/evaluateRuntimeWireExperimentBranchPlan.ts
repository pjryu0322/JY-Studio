/**
 * Evaluate runtime wire experiment branch plan (read-only; no branch/git/PR/routing/write/DB execution).
 */

import { evaluateControlledRuntimeWireCandidate } from "@/lib/agents/evaluateControlledRuntimeWireCandidate";
import type {
  RuntimeWireExperimentBranchManualCommand,
  RuntimeWireExperimentBranchPlanChecklistItem,
  RuntimeWireExperimentBranchPlanDecision,
  RuntimeWireExperimentBranchPlanFinding,
  RuntimeWireExperimentBranchPlanReport,
  RuntimeWireExperimentBranchPlanSourceNoRunFlags,
} from "@/lib/agents/runtimeWireExperimentBranchPlanTypes";

const WIRE_CANDIDATE_READY = "ready_for_runtime_wire_experiment_branch";
const PLAN_TITLE = "Runtime Wire Experiment Branch Plan (Read-Only)";
export const RUNTIME_WIRE_MANUAL_COMMAND_CAUTION =
  "Manual execution only after explicit user approval. This report does not execute git.";

const MANUAL_GIT_COMMAND_STEPS = [
  "git fetch origin",
  "git checkout main",
  "git pull --ff-only origin main",
] as const;

const REGRESSION_SUITES: readonly string[] = [
  "tests/api/multiAgentControlledRuntimeWireCandidate.unit.test.ts",
  "tests/api/multiAgentRuntimeExecutionApprovalGate.unit.test.ts",
  "tests/api/multiAgentRuntimeExecutionPlanPackage.unit.test.ts",
  "tests/api/multiAgent",
  "tests/api/requirementsOrchestrationPhase4Product.unit.test.ts",
];

const SOURCE_NO_RUN_FLAGS: RuntimeWireExperimentBranchPlanSourceNoRunFlags = {
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
};

type RuntimeWireExperimentBranchPlanInput = Parameters<typeof evaluateControlledRuntimeWireCandidate>[0] & {
  readonly manualBranchPlanReviewConfirmed?: boolean;
  readonly branchNamingPolicyConfirmed?: boolean;
  readonly rollbackPlanConfirmed?: boolean;
};

type ChecklistEntry = {
  readonly item: string;
  readonly satisfied: boolean;
  readonly detail: string;
};

/** Recommended experiment branch name (not created in this step). */
export function buildRuntimeWireExperimentBranchName(): string {
  return "experiment/runtime-wire-controlled-candidate";
}

/** Recommended feature flag name (not wired in this step). */
export function buildRuntimeWireFeatureFlagName(): string {
  return "JYO_RUNTIME_WIRE_EXPERIMENT";
}

export function buildRuntimeWireExperimentBranchPlanFingerprint(input: {
  readonly sourceWireCandidateDecision: string;
  readonly sourceCandidateFingerprint: string;
  readonly recommendedBranchName: string;
  readonly recommendedFeatureFlagName: string;
  readonly manualBranchPlanReviewConfirmed: boolean;
  readonly branchNamingPolicyConfirmed: boolean;
  readonly rollbackPlanConfirmed: boolean;
}): string {
  return [
    "runtime-wire-branch-plan-v1",
    input.sourceWireCandidateDecision,
    input.sourceCandidateFingerprint,
    input.recommendedBranchName,
    input.recommendedFeatureFlagName,
    `review-${input.manualBranchPlanReviewConfirmed}`,
    `naming-${input.branchNamingPolicyConfirmed}`,
    `rollback-${input.rollbackPlanConfirmed}`,
  ].join(":");
}

/** Build manual git command candidates (does not execute git). */
export function buildRuntimeWireExperimentBranchManualCommands(
  branchName: string,
  caution: string = RUNTIME_WIRE_MANUAL_COMMAND_CAUTION,
): RuntimeWireExperimentBranchManualCommand[] {
  const commands = [...MANUAL_GIT_COMMAND_STEPS, `git checkout -b ${branchName}`];

  return commands.map((command, index) => ({
    sequence: index + 1,
    command,
    caution,
    executesInThisStep: false as const,
  }));
}

export function runtimeWireManualCommandCautionsValid(
  commands: readonly Pick<RuntimeWireExperimentBranchManualCommand, "caution">[],
): boolean {
  return commands.every(
    (entry) =>
      entry.caution.trim().length > 0 &&
      entry.caution.includes("Manual execution only after explicit user approval") &&
      entry.caution.includes("does not execute git"),
  );
}

function isBranchNameSafe(branchName: string): boolean {
  if (!branchName || branchName.trim().length === 0) {
    return false;
  }
  if (/\s/.test(branchName)) {
    return false;
  }
  const forbidden = new Set(["main", "master"]);
  const leaf = branchName.split("/").pop() ?? branchName;
  return !forbidden.has(leaf) && !forbidden.has(branchName);
}

function isFeatureFlagNameSafe(flagName: string): boolean {
  return flagName.length > 0 && flagName.startsWith("JYO_");
}

function resolvePlanFlags(input?: RuntimeWireExperimentBranchPlanInput) {
  return {
    manualBranchPlanReviewConfirmed: input?.manualBranchPlanReviewConfirmed === true,
    branchNamingPolicyConfirmed: input?.branchNamingPolicyConfirmed === true,
    rollbackPlanConfirmed: input?.rollbackPlanConfirmed === true,
  };
}

function buildSourceTrace(wireCandidates: ReturnType<typeof evaluateControlledRuntimeWireCandidate>["wireCandidates"]) {
  const satisfiedCount = wireCandidates.filter((c) => c.satisfied).length;
  return {
    sourceCandidateKinds: wireCandidates.map((c) => c.kind),
    sourceWireCandidateCount: wireCandidates.length,
    sourceWireCandidateSatisfiedCount: satisfiedCount,
    sourceWireCandidateUnsatisfiedCount: wireCandidates.length - satisfiedCount,
  };
}

function finding(
  severity: RuntimeWireExperimentBranchPlanFinding["severity"],
  code: string,
  message: string,
): RuntimeWireExperimentBranchPlanFinding {
  return { severity, code, message };
}

function checklistReason(input: ChecklistEntry): string {
  return `${input.item}: ${input.satisfied ? "satisfied" : "not satisfied"} — ${input.detail}`;
}

function mapChecklistEntries(entries: readonly ChecklistEntry[]): RuntimeWireExperimentBranchPlanChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    satisfied: entry.satisfied,
    reason: checklistReason(entry),
  }));
}

/** Pure branch plan decision from upstream state (no side effects). */
export function resolveRuntimeWireExperimentBranchPlanDecision(input: {
  readonly wireCandidateDecision: string;
  readonly manualBranchPlanReviewConfirmed: boolean;
  readonly branchNamingPolicyConfirmed: boolean;
  readonly rollbackPlanConfirmed: boolean;
  readonly manualCommandCautionsValid: boolean;
}): RuntimeWireExperimentBranchPlanDecision {
  if (!input.manualCommandCautionsValid) {
    return "blocked";
  }

  if (input.wireCandidateDecision === "blocked") {
    return "blocked";
  }

  if (input.wireCandidateDecision !== WIRE_CANDIDATE_READY) {
    return "defer";
  }

  if (!input.manualBranchPlanReviewConfirmed) {
    return "defer";
  }

  if (!input.branchNamingPolicyConfirmed) {
    return "defer";
  }

  if (!input.rollbackPlanConfirmed) {
    return "defer";
  }

  return "ready_for_manual_branch_creation_approval";
}

function buildPlanSummary(input: {
  readonly decision: RuntimeWireExperimentBranchPlanDecision;
  readonly branchName: string;
  readonly manualCommandCautionsValid: boolean;
}): string {
  if (!input.manualCommandCautionsValid) {
    return "Runtime wire experiment branch plan is blocked because manual command cautions are missing or invalid.";
  }

  if (input.decision === "ready_for_manual_branch_creation_approval") {
    return (
      `Runtime wire experiment branch plan is ready for manual branch creation approval (${input.branchName}). ` +
      "This report does not create branches, execute git, or open PRs."
    );
  }

  if (input.decision === "blocked") {
    return "Runtime wire experiment branch plan is blocked because the source wire candidate is blocked.";
  }

  return (
    "Runtime wire experiment branch plan defers. Complete source wire candidate readiness, " +
    "manual branch plan review, branch naming policy confirmation, and rollback plan confirmation."
  );
}

function buildBranchSafetyChecklist(input: {
  readonly branchName: string;
  readonly featureFlagName: string;
  readonly branchNamingPolicyConfirmed: boolean;
}): RuntimeWireExperimentBranchPlanChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "branch name is non-empty",
      satisfied: input.branchName.length > 0,
      detail: `recommendedBranchName=${input.branchName}`,
    },
    {
      item: "branch name has no spaces",
      satisfied: !/\s/.test(input.branchName),
      detail: "whitespace forbidden in branch name",
    },
    {
      item: "branch name is not main or master",
      satisfied: isBranchNameSafe(input.branchName),
      detail: "main/master leaf names forbidden",
    },
    {
      item: "feature flag is non-empty",
      satisfied: input.featureFlagName.length > 0,
      detail: `recommendedFeatureFlagName=${input.featureFlagName}`,
    },
    {
      item: "feature flag uses JYO_ prefix",
      satisfied: input.featureFlagName.startsWith("JYO_"),
      detail: "JYO_ prefix recommended for experiment flags",
    },
    {
      item: "branch naming policy confirmed",
      satisfied: input.branchNamingPolicyConfirmed,
      detail: `branchNamingPolicyConfirmed=${input.branchNamingPolicyConfirmed}`,
    },
  ]);
}

function buildRollbackChecklist(input: {
  readonly rollbackPlanConfirmed: boolean;
}): RuntimeWireExperimentBranchPlanChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "rollback plan confirmed",
      satisfied: input.rollbackPlanConfirmed,
      detail: `rollbackPlanConfirmed=${input.rollbackPlanConfirmed}`,
    },
    {
      item: "feature flag default off before experiment",
      satisfied: true,
      detail: "read-only plan; flag wire not performed in this step",
    },
    {
      item: "experiment branch isolated from main execution path",
      satisfied: true,
      detail: "manual branch creation only on experiment branch",
    },
    {
      item: "multiAgent regression required before merge",
      satisfied: true,
      detail: `regressionSuites includes ${REGRESSION_SUITES[3]}`,
    },
  ]);
}

function buildHandoffChecklist(): RuntimeWireExperimentBranchPlanChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "manual branch creation only after explicit approval",
      satisfied: true,
      detail: "createsBranchInThisStep=false; manual execution required",
    },
    {
      item: "Stage 4-B manual branch creation verification required next",
      satisfied: true,
      detail: "Stage 4-B follows branch plan ready",
    },
    {
      item: "actual branch creation is not performed in this step",
      satisfied: true,
      detail: "createsBranchInThisStep=false",
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

function appendPlanFindings(input: {
  readonly findings: RuntimeWireExperimentBranchPlanFinding[];
  readonly decision: RuntimeWireExperimentBranchPlanDecision;
  readonly wireCandidateDecision: string;
  readonly manualCommandCautionsValid: boolean;
  readonly branchNameSafe: boolean;
  readonly featureFlagSafe: boolean;
  readonly manualBranchPlanReviewConfirmed: boolean;
  readonly branchNamingPolicyConfirmed: boolean;
  readonly rollbackPlanConfirmed: boolean;
}): void {
  const { findings, decision, wireCandidateDecision } = input;

  findings.push(
    finding(
      "info",
      "runtime_wire_experiment_branch_plan_read_only",
      "Runtime wire experiment branch plan is read-only; no git branch creation",
    ),
  );

  if (input.branchNameSafe) {
    findings.push(finding("info", "branch_name_safety_checked", "Branch name safety checks passed"));
  }

  if (input.featureFlagSafe) {
    findings.push(finding("info", "feature_flag_name_safety_checked", "Feature flag name safety checks passed"));
  }

  findings.push(
    finding("info", "manual_command_candidates_generated", "Manual git command candidates generated (not executed)"),
  );

  findings.push(
    finding(
      "info",
      "manual_command_candidates_require_explicit_approval",
      "Manual execution only after explicit user approval. This report does not execute git.",
    ),
  );

  if (!input.manualCommandCautionsValid) {
    findings.push(
      finding("blocking", "manual_command_caution_invalid", "Manual command caution is missing or invalid"),
    );
    findings.push(
      finding("blocking", "runtime_wire_experiment_branch_plan_blocked", "Runtime wire experiment branch plan is blocked"),
    );
    return;
  }

  if (decision === "blocked") {
    if (wireCandidateDecision === "blocked") {
      findings.push(finding("blocking", "source_wire_candidate_blocked", "Source wire candidate is blocked"));
    }
    findings.push(
      finding("blocking", "runtime_wire_experiment_branch_plan_blocked", "Runtime wire experiment branch plan is blocked"),
    );
    return;
  }

  if (decision === "defer") {
    if (wireCandidateDecision !== WIRE_CANDIDATE_READY) {
      findings.push(finding("warning", "source_wire_candidate_not_ready", "Source wire candidate is not ready"));
    }
    if (!input.manualBranchPlanReviewConfirmed) {
      findings.push(finding("warning", "manual_branch_plan_review_missing", "Manual branch plan review is missing"));
    }
    if (!input.branchNamingPolicyConfirmed) {
      findings.push(finding("warning", "branch_naming_policy_missing", "Branch naming policy confirmation is missing"));
    }
    if (!input.rollbackPlanConfirmed) {
      findings.push(finding("warning", "rollback_plan_missing", "Rollback plan confirmation is missing"));
    }
    findings.push(
      finding("warning", "runtime_wire_experiment_branch_plan_deferred", "Runtime wire experiment branch plan defers"),
    );
    findings.push(finding("info", "manual_branch_creation_required", "Manual branch creation required after explicit approval"));
    return;
  }

  findings.push(
    finding("info", "branch_plan_ready_for_manual_approval", "Branch plan ready for manual creation approval; not actual branch creation"),
  );
  findings.push(
    finding("info", "manual_branch_creation_required", "Manual branch creation required; this report does not execute git"),
  );
}

/** Read-only runtime wire experiment branch plan — does not create branches, execute git, or open PRs. */
export function evaluateRuntimeWireExperimentBranchPlan(
  input?: RuntimeWireExperimentBranchPlanInput,
): RuntimeWireExperimentBranchPlanReport {
  const wireCandidate = evaluateControlledRuntimeWireCandidate(input);
  const {
    manualBranchPlanReviewConfirmed,
    branchNamingPolicyConfirmed,
    rollbackPlanConfirmed,
  } = resolvePlanFlags(input);

  const recommendedBranchName = buildRuntimeWireExperimentBranchName();
  const recommendedFeatureFlagName = buildRuntimeWireFeatureFlagName();
  const manualCommandCandidates = buildRuntimeWireExperimentBranchManualCommands(recommendedBranchName);
  const manualCommandCautionsValid = runtimeWireManualCommandCautionsValid(manualCommandCandidates);

  const decision = resolveRuntimeWireExperimentBranchPlanDecision({
    wireCandidateDecision: wireCandidate.decision,
    manualBranchPlanReviewConfirmed,
    branchNamingPolicyConfirmed,
    rollbackPlanConfirmed,
    manualCommandCautionsValid,
  });

  const planFingerprint = buildRuntimeWireExperimentBranchPlanFingerprint({
    sourceWireCandidateDecision: wireCandidate.decision,
    sourceCandidateFingerprint: wireCandidate.candidateFingerprint,
    recommendedBranchName,
    recommendedFeatureFlagName,
    manualBranchPlanReviewConfirmed,
    branchNamingPolicyConfirmed,
    rollbackPlanConfirmed,
  });

  const sourceTrace = buildSourceTrace(wireCandidate.wireCandidates);
  const branchNameSafe = isBranchNameSafe(recommendedBranchName);
  const featureFlagSafe = isFeatureFlagNameSafe(recommendedFeatureFlagName);

  const planSummary = buildPlanSummary({
    decision,
    branchName: recommendedBranchName,
    manualCommandCautionsValid,
  });

  const findings: RuntimeWireExperimentBranchPlanFinding[] = [];
  appendPlanFindings({
    findings,
    decision,
    wireCandidateDecision: wireCandidate.decision,
    manualCommandCautionsValid,
    branchNameSafe,
    featureFlagSafe,
    manualBranchPlanReviewConfirmed,
    branchNamingPolicyConfirmed,
    rollbackPlanConfirmed,
  });

  return {
    mode: "read_only_runtime_wire_experiment_branch_plan",
    stage: "stage_4_a",
    decision,
    sourceWireCandidateDecision: wireCandidate.decision,
    sourceApprovalGateDecision: wireCandidate.sourceApprovalGateDecision,
    sourceApprovalGateFingerprint: wireCandidate.sourceApprovalGateFingerprint,
    sourceCandidateFingerprint: wireCandidate.candidateFingerprint,
    sourceCandidateKinds: sourceTrace.sourceCandidateKinds,
    sourceWireCandidateCount: sourceTrace.sourceWireCandidateCount,
    sourceWireCandidateSatisfiedCount: sourceTrace.sourceWireCandidateSatisfiedCount,
    sourceWireCandidateUnsatisfiedCount: sourceTrace.sourceWireCandidateUnsatisfiedCount,
    sourceNoRunFlags: SOURCE_NO_RUN_FLAGS,
    planVersion: 1,
    planTitle: PLAN_TITLE,
    planSummary,
    planFingerprint,
    recommendedBranchName,
    recommendedFeatureFlagName,
    manualCommandCandidates,
    regressionSuites: [...REGRESSION_SUITES],
    branchSafetyChecklist: buildBranchSafetyChecklist({
      branchName: recommendedBranchName,
      featureFlagName: recommendedFeatureFlagName,
      branchNamingPolicyConfirmed,
    }),
    rollbackChecklist: buildRollbackChecklist({ rollbackPlanConfirmed }),
    handoffChecklist: buildHandoffChecklist(),
    createsBranchInThisStep: false,
    executesGitInThisStep: false,
    createsPullRequestInThisStep: false,
    changesConnectorRoutingInThisStep: false,
    executesRuntimeInThisStep: false,
    wiresWritePathInThisStep: false,
    wiresFeatureFlagInThisStep: false,
    writesDataInThisStep: false,
    callsPrismaInThisStep: false,
    modifiesSchemaInThisStep: false,
    createsMigrationInThisStep: false,
    callsCursorInThisStep: false,
    callsGitHubInThisStep: false,
    findings,
  };
}
