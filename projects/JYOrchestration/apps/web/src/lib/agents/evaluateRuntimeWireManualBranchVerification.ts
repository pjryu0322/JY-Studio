/**
 * Evaluate runtime wire manual branch verification (read-only; no branch/git/test/GitHub/PR execution).
 */

import { evaluateRuntimeWireExperimentBranchPlan } from "@/lib/agents/evaluateRuntimeWireExperimentBranchPlan";
import type {
  RuntimeWireManualBranchVerificationChecklistItem,
  RuntimeWireManualBranchVerificationDecision,
  RuntimeWireManualBranchVerificationFinding,
  RuntimeWireManualBranchVerificationRegressionResult,
  RuntimeWireManualBranchVerificationReport,
} from "@/lib/agents/runtimeWireManualBranchVerificationTypes";

const BRANCH_PLAN_READY = "ready_for_manual_branch_creation_approval";

type RuntimeWireManualBranchVerificationInput = Parameters<typeof evaluateRuntimeWireExperimentBranchPlan>[0] & {
  readonly explicitManualExecutionConfirmed?: boolean;
  readonly actualBranchName?: string;
  readonly regressionResults?: readonly RuntimeWireManualBranchVerificationRegressionResult[];
};

type ChecklistEntry = {
  readonly item: string;
  readonly satisfied: boolean;
  readonly detail: string;
};

/** Sanitize external regression results without mutating the input array. */
export function sanitizeRuntimeWireRegressionResults(
  results?: readonly RuntimeWireManualBranchVerificationRegressionResult[],
): RuntimeWireManualBranchVerificationRegressionResult[] {
  if (!results || results.length === 0) {
    return [];
  }

  const bySuite = new Map<string, RuntimeWireManualBranchVerificationRegressionResult>();

  for (const entry of results) {
    const suite = entry.suite.trim() || "unknown";
    const summary = entry.summary.trim() || "no summary";
    const normalized: RuntimeWireManualBranchVerificationRegressionResult = {
      suite,
      passed: entry.passed,
      summary,
    };

    const existing = bySuite.get(suite);
    if (!existing) {
      bySuite.set(suite, normalized);
      continue;
    }

    if (!existing.passed || !normalized.passed) {
      bySuite.set(suite, {
        suite,
        passed: false,
        summary: !existing.passed ? existing.summary : normalized.summary,
      });
      continue;
    }

    bySuite.set(suite, normalized);
  }

  return [...bySuite.values()];
}

function parseManualBranchVerificationInput(input?: RuntimeWireManualBranchVerificationInput) {
  return {
    explicitManualExecutionConfirmed: input?.explicitManualExecutionConfirmed === true,
    actualBranchName: input?.actualBranchName?.trim() ?? "",
    sanitizedRegressionResults: sanitizeRuntimeWireRegressionResults(input?.regressionResults),
  };
}

function finding(
  severity: RuntimeWireManualBranchVerificationFinding["severity"],
  code: string,
  message: string,
): RuntimeWireManualBranchVerificationFinding {
  return { severity, code, message };
}

function checklistReason(input: ChecklistEntry): string {
  return `${input.item}: ${input.satisfied ? "satisfied" : "not satisfied"} — ${input.detail}`;
}

function mapChecklistEntries(entries: readonly ChecklistEntry[]): RuntimeWireManualBranchVerificationChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    satisfied: entry.satisfied,
    reason: checklistReason(entry),
  }));
}

function resolveVerificationDecision(input: {
  readonly branchPlanDecision: string;
  readonly explicitManualExecutionConfirmed: boolean;
  readonly actualBranchName: string;
  readonly expectedBranchName: string;
  readonly sanitizedRegressionResults: readonly RuntimeWireManualBranchVerificationRegressionResult[];
}): {
  readonly decision: RuntimeWireManualBranchVerificationDecision;
  readonly branchMatches: boolean;
  readonly regressionResultsProvided: boolean;
  readonly regressionPassed: boolean;
  readonly rollbackRequired: boolean;
} {
  const branchMatches =
    input.actualBranchName.length > 0 && input.actualBranchName === input.expectedBranchName;
  const regressionResultsProvided = input.sanitizedRegressionResults.length > 0;
  const regressionPassed = regressionResultsProvided && input.sanitizedRegressionResults.every((r) => r.passed);
  const rollbackRequired = regressionResultsProvided && !regressionPassed;

  if (input.branchPlanDecision === "blocked") {
    return {
      decision: "blocked",
      branchMatches,
      regressionResultsProvided,
      regressionPassed,
      rollbackRequired,
    };
  }

  if (input.branchPlanDecision !== BRANCH_PLAN_READY) {
    return {
      decision: "defer",
      branchMatches,
      regressionResultsProvided,
      regressionPassed,
      rollbackRequired,
    };
  }

  if (!input.explicitManualExecutionConfirmed) {
    return {
      decision: "defer",
      branchMatches,
      regressionResultsProvided,
      regressionPassed,
      rollbackRequired,
    };
  }

  if (input.actualBranchName.trim().length === 0) {
    return {
      decision: "defer",
      branchMatches: false,
      regressionResultsProvided,
      regressionPassed,
      rollbackRequired,
    };
  }

  if (!branchMatches) {
    return {
      decision: "blocked",
      branchMatches: false,
      regressionResultsProvided,
      regressionPassed,
      rollbackRequired,
    };
  }

  if (!regressionResultsProvided) {
    return {
      decision: "defer",
      branchMatches,
      regressionResultsProvided: false,
      regressionPassed: false,
      rollbackRequired: false,
    };
  }

  if (!regressionPassed) {
    return {
      decision: "blocked",
      branchMatches,
      regressionResultsProvided,
      regressionPassed: false,
      rollbackRequired: true,
    };
  }

  return {
    decision: "manual_branch_verified",
    branchMatches,
    regressionResultsProvided,
    regressionPassed,
    rollbackRequired: false,
  };
}

function buildVerificationChecklist(input: {
  readonly branchPlanDecision: string;
  readonly explicitManualExecutionConfirmed: boolean;
  readonly actualBranchName: string;
  readonly branchMatches: boolean;
}): RuntimeWireManualBranchVerificationChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "source branch plan ready",
      satisfied: input.branchPlanDecision === BRANCH_PLAN_READY,
      detail: `sourceBranchPlanDecision=${input.branchPlanDecision}`,
    },
    {
      item: "manual execution confirmation",
      satisfied: input.explicitManualExecutionConfirmed,
      detail: `explicitManualExecutionConfirmed=${input.explicitManualExecutionConfirmed}`,
    },
    {
      item: "actual branch name provided",
      satisfied: input.actualBranchName.trim().length > 0,
      detail: `actualBranchName=${input.actualBranchName || "(empty)"}`,
    },
    {
      item: "branch name matches expected",
      satisfied: input.branchMatches,
      detail: `branchMatches=${input.branchMatches}`,
    },
  ]);
}

function buildRegressionChecklist(input: {
  readonly regressionResultsProvided: boolean;
  readonly regressionPassed: boolean;
}): RuntimeWireManualBranchVerificationChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "regression results provided",
      satisfied: input.regressionResultsProvided,
      detail: `regressionResultsProvided=${input.regressionResultsProvided}`,
    },
    {
      item: "regression results passed",
      satisfied: input.regressionPassed,
      detail: `regressionPassed=${input.regressionPassed}`,
    },
  ]);
}

function buildRollbackChecklist(input: {
  readonly rollbackRequired: boolean;
}): RuntimeWireManualBranchVerificationChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "rollbackRequired",
      satisfied: !input.rollbackRequired,
      detail: `rollbackRequired=${input.rollbackRequired}`,
    },
    {
      item: "rollback plan available from Stage 4-A",
      satisfied: true,
      detail: "read-only verification; rollback is operator-driven",
    },
  ]);
}

function buildNoRunChecklist(): RuntimeWireManualBranchVerificationChecklistItem[] {
  return mapChecklistEntries([
    { item: "no branch creation in this step", satisfied: true, detail: "createsBranchInThisStep=false" },
    { item: "no git execution in this step", satisfied: true, detail: "executesGitInThisStep=false" },
    { item: "no PR creation in this step", satisfied: true, detail: "createsPullRequestInThisStep=false" },
    {
      item: "no connector routing change in this step",
      satisfied: true,
      detail: "changesConnectorRoutingInThisStep=false",
    },
    { item: "no runtime execution in this step", satisfied: true, detail: "executesRuntimeInThisStep=false" },
    { item: "no write path wire in this step", satisfied: true, detail: "wiresWritePathInThisStep=false" },
    { item: "no feature flag wire in this step", satisfied: true, detail: "wiresFeatureFlagInThisStep=false" },
    { item: "no DB write in this step", satisfied: true, detail: "writesDataInThisStep=false" },
    { item: "no Prisma call in this step", satisfied: true, detail: "callsPrismaInThisStep=false" },
    { item: "no schema change in this step", satisfied: true, detail: "modifiesSchemaInThisStep=false" },
    { item: "no migration in this step", satisfied: true, detail: "createsMigrationInThisStep=false" },
    { item: "no Cursor call in this step", satisfied: true, detail: "callsCursorInThisStep=false" },
    { item: "no GitHub call in this step", satisfied: true, detail: "callsGitHubInThisStep=false" },
  ]);
}

function appendVerificationFindings(input: {
  readonly findings: RuntimeWireManualBranchVerificationFinding[];
  readonly decision: RuntimeWireManualBranchVerificationDecision;
  readonly branchPlanDecision: string;
  readonly explicitManualExecutionConfirmed: boolean;
  readonly actualBranchName: string;
  readonly branchMatches: boolean;
  readonly regressionResultsProvided: boolean;
  readonly regressionPassed: boolean;
  readonly rollbackRequired: boolean;
}): void {
  const { findings, decision, branchPlanDecision } = input;

  findings.push(
    finding(
      "info",
      "manual_branch_verification_read_only",
      "Manual branch verification is read-only; does not execute git or tests",
    ),
  );

  if (decision === "blocked") {
    if (branchPlanDecision === "blocked") {
      findings.push(finding("blocking", "source_branch_plan_blocked", "Source branch plan is blocked"));
    }
    if (!input.branchMatches && input.actualBranchName.trim().length > 0) {
      findings.push(finding("blocking", "manual_branch_name_mismatch", "Actual branch name does not match expected"));
    }
    if (input.regressionResultsProvided && !input.regressionPassed) {
      findings.push(finding("blocking", "manual_branch_regression_failed", "Manual branch regression results failed"));
      findings.push(
        finding("warning", "rollback_required_due_to_regression_failure", "Rollback required due to regression failure"),
      );
    }
    findings.push(
      finding("blocking", "manual_branch_verification_blocked", "Manual branch verification is blocked"),
    );
    return;
  }

  if (decision === "defer") {
    if (branchPlanDecision !== BRANCH_PLAN_READY) {
      findings.push(finding("warning", "source_wire_candidate_not_ready", "Source branch plan is not ready"));
    }
    if (!input.explicitManualExecutionConfirmed) {
      findings.push(
        finding("warning", "manual_execution_confirmation_missing", "Manual execution confirmation is missing"),
      );
    }
    if (input.actualBranchName.trim().length === 0) {
      findings.push(finding("warning", "actual_branch_name_missing", "Actual branch name is missing"));
    }
    if (!input.regressionResultsProvided) {
      findings.push(finding("warning", "manual_branch_regression_missing", "Manual branch regression results are missing"));
    }
    findings.push(
      finding("warning", "manual_branch_verification_deferred", "Manual branch verification defers"),
    );
    return;
  }

  findings.push(
    finding(
      "info",
      "manual_branch_verified",
      "Manual branch verified; not routing change permission; Stage 4-C shadow routing plan is next",
    ),
  );
}

/** Read-only manual branch verification — validates external manual execution inputs only. */
export function evaluateRuntimeWireManualBranchVerification(
  input?: RuntimeWireManualBranchVerificationInput,
): RuntimeWireManualBranchVerificationReport {
  const branchPlan = evaluateRuntimeWireExperimentBranchPlan(input);
  const { explicitManualExecutionConfirmed, actualBranchName, sanitizedRegressionResults } =
    parseManualBranchVerificationInput(input);
  const expectedBranchName = branchPlan.recommendedBranchName;

  const resolved = resolveVerificationDecision({
    branchPlanDecision: branchPlan.decision,
    explicitManualExecutionConfirmed,
    actualBranchName,
    expectedBranchName,
    sanitizedRegressionResults,
  });

  const findings: RuntimeWireManualBranchVerificationFinding[] = [];
  appendVerificationFindings({
    findings,
    decision: resolved.decision,
    branchPlanDecision: branchPlan.decision,
    explicitManualExecutionConfirmed,
    actualBranchName,
    branchMatches: resolved.branchMatches,
    regressionResultsProvided: resolved.regressionResultsProvided,
    regressionPassed: resolved.regressionPassed,
    rollbackRequired: resolved.rollbackRequired,
  });

  return {
    mode: "read_only_runtime_wire_manual_branch_verification",
    stage: "stage_4_b",
    decision: resolved.decision,
    sourceBranchPlanDecision: branchPlan.decision,
    sourcePlanFingerprint: branchPlan.planFingerprint,
    expectedBranchName,
    actualBranchName,
    branchMatches: resolved.branchMatches,
    explicitManualExecutionConfirmed,
    regressionResultsProvided: resolved.regressionResultsProvided,
    regressionPassed: resolved.regressionPassed,
    rollbackRequired: resolved.rollbackRequired,
    sanitizedRegressionResults,
    verificationChecklist: buildVerificationChecklist({
      branchPlanDecision: branchPlan.decision,
      explicitManualExecutionConfirmed,
      actualBranchName,
      branchMatches: resolved.branchMatches,
    }),
    regressionChecklist: buildRegressionChecklist({
      regressionResultsProvided: resolved.regressionResultsProvided,
      regressionPassed: resolved.regressionPassed,
    }),
    rollbackChecklist: buildRollbackChecklist({ rollbackRequired: resolved.rollbackRequired }),
    noRunChecklist: buildNoRunChecklist(),
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
