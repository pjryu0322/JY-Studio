/**
 * Stage 6-A runtime execution model baseline support (read-only).
 */

import type {
  RuntimeExecutionModelBaselineChecklistItem,
  RuntimeExecutionModelBaselineDecision,
  RuntimeExecutionModelBaselineDecisionInput,
  RuntimeExecutionModelBaselineFinding,
  RuntimeExecutionModelBaselineInput,
  RuntimeExecutionUnitKind,
} from "@/lib/agents/runtimeExecutionModelBaselineTypes";
import { DEFAULT_RUNTIME_EXECUTION_UNIT_KINDS } from "@/lib/agents/runtimeExecutionModelBaselineConstants";
import {
  findUnknownExecutionUnitKinds,
  uniqueRuntimeExecutionUnitKinds,
} from "@/lib/agents/runtimeExecutionModelBaselineInputHygiene";

export {
  findUnknownExecutionUnitKinds,
  uniqueRuntimeExecutionUnitKinds,
} from "@/lib/agents/runtimeExecutionModelBaselineInputHygiene";

export {
  DEFAULT_RUNTIME_EXECUTION_BOUNDARIES,
  DEFAULT_RUNTIME_EXECUTION_UNIT_KINDS,
  MODEL_BASELINE_TITLE,
  MODEL_BASELINE_VERSION,
  REQUIRED_STAGE6_A_MODEL_BASELINE_CONFIRMATIONS,
  STAGE6_A_RECOMMENDED_NEXT_PHASES,
  STAGE6_A_SEPARATED_WORK_ITEMS,
} from "@/lib/agents/runtimeExecutionModelBaselineConstants";

type ChecklistEntry = {
  readonly item: string;
  readonly satisfied: boolean;
  readonly detail: string;
};

function finding(
  severity: RuntimeExecutionModelBaselineFinding["severity"],
  code: string,
  message: string,
): RuntimeExecutionModelBaselineFinding {
  return { severity, code, message };
}

function mapChecklist(entries: readonly ChecklistEntry[]): RuntimeExecutionModelBaselineChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    satisfied: entry.satisfied,
    reason: `${entry.item}: ${entry.satisfied ? "satisfied" : "not satisfied"} — ${entry.detail}`,
  }));
}

export function parseRuntimeExecutionModelBaselineInput(input?: RuntimeExecutionModelBaselineInput): {
  readonly executionUnitKinds: readonly RuntimeExecutionUnitKind[];
  readonly executionUnitKindInputNormalized: boolean;
  readonly executionUnitKindDuplicateRemovedCount: number;
  readonly confirmationsSatisfied: boolean;
  readonly stage6ModelReviewConfirmed: boolean;
  readonly stage6NoActualExecutionConfirmed: boolean;
  readonly stage6NoConnectorRoutingChangeConfirmed: boolean;
  readonly stage6NoDbMigrationConfirmed: boolean;
  readonly stage6NoFeatureFlagWireConfirmed: boolean;
} {
  const rawRequested = input?.requestedExecutionUnitKinds;
  const executionUnitKinds =
    rawRequested === undefined
      ? [...DEFAULT_RUNTIME_EXECUTION_UNIT_KINDS]
      : uniqueRuntimeExecutionUnitKinds(rawRequested);

  return {
    executionUnitKinds,
    executionUnitKindInputNormalized: rawRequested !== undefined,
    executionUnitKindDuplicateRemovedCount:
      rawRequested === undefined ? 0 : rawRequested.length - executionUnitKinds.length,
    stage6ModelReviewConfirmed: input?.stage6ModelReviewConfirmed === true,
    stage6NoActualExecutionConfirmed: input?.stage6NoActualExecutionConfirmed === true,
    stage6NoConnectorRoutingChangeConfirmed: input?.stage6NoConnectorRoutingChangeConfirmed === true,
    stage6NoDbMigrationConfirmed: input?.stage6NoDbMigrationConfirmed === true,
    stage6NoFeatureFlagWireConfirmed: input?.stage6NoFeatureFlagWireConfirmed === true,
    confirmationsSatisfied:
      input?.stage6ModelReviewConfirmed === true &&
      input?.stage6NoActualExecutionConfirmed === true &&
      input?.stage6NoConnectorRoutingChangeConfirmed === true &&
      input?.stage6NoDbMigrationConfirmed === true &&
      input?.stage6NoFeatureFlagWireConfirmed === true,
  };
}

export function resolveRuntimeExecutionModelBaselineDecision(
  input: RuntimeExecutionModelBaselineDecisionInput,
): RuntimeExecutionModelBaselineDecision {
  if (
    input.sourceStage5Decision === "blocked" ||
    input.sourceStage6EntryMode !== "design_candidate_only" ||
    input.sourceStage6ActualRuntimeExecutionAllowed !== false ||
    input.sourceStage6RequiresSeparateApproval !== true ||
    input.hasUnknownExecutionUnitKind
  ) {
    return "blocked";
  }

  if (input.sourceStage5Decision === "defer" || !input.confirmationsSatisfied) {
    return "defer";
  }

  return "ready_for_execution_model_candidate";
}

export function buildRuntimeExecutionModelBaselineFingerprint(input: {
  readonly sourceStage5Decision: RuntimeExecutionModelBaselineDecisionInput["sourceStage5Decision"];
  readonly executionUnitKinds: readonly RuntimeExecutionUnitKind[];
  readonly confirmationsSatisfied: boolean;
}): string {
  return [
    "runtime-execution-model-baseline-v1",
    `stage5-${input.sourceStage5Decision}`,
    `units-${input.executionUnitKinds.join("|")}`,
    `confirmations-${input.confirmationsSatisfied}`,
  ].join(":");
}

export function buildRuntimeExecutionModelBaselineSummary(
  decision: RuntimeExecutionModelBaselineDecision,
): string {
  if (decision === "blocked") {
    return "Stage 6-A runtime execution model baseline is blocked due to Stage 5 closure or entry guard violation.";
  }
  if (decision === "defer") {
    return "Stage 6-A runtime execution model baseline defers; Stage 5 closure or confirmations are incomplete.";
  }
  return "Stage 6-A runtime execution model baseline is ready. This is design-only — not actual runtime execution permission.";
}

export function buildRuntimeExecutionModelBaselineChecklists(input: {
  readonly parsed: ReturnType<typeof parseRuntimeExecutionModelBaselineInput>;
  readonly sourceStage5Decision: RuntimeExecutionModelBaselineDecisionInput["sourceStage5Decision"];
  readonly sourceStage6EntryMode: RuntimeExecutionModelBaselineDecisionInput["sourceStage6EntryMode"];
  readonly sourceStage6RequiresSeparateApproval: boolean;
}): {
  readonly confirmationChecklist: readonly RuntimeExecutionModelBaselineChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeExecutionModelBaselineChecklistItem[];
} {
  const confirmationChecklist = mapChecklist([
    {
      item: "stage6ModelReviewConfirmed",
      satisfied: input.parsed.stage6ModelReviewConfirmed,
      detail: `stage6ModelReviewConfirmed=${input.parsed.stage6ModelReviewConfirmed}`,
    },
    {
      item: "stage6NoActualExecutionConfirmed",
      satisfied: input.parsed.stage6NoActualExecutionConfirmed,
      detail: `stage6NoActualExecutionConfirmed=${input.parsed.stage6NoActualExecutionConfirmed}`,
    },
    {
      item: "stage6NoConnectorRoutingChangeConfirmed",
      satisfied: input.parsed.stage6NoConnectorRoutingChangeConfirmed,
      detail: `stage6NoConnectorRoutingChangeConfirmed=${input.parsed.stage6NoConnectorRoutingChangeConfirmed}`,
    },
    {
      item: "stage6NoDbMigrationConfirmed",
      satisfied: input.parsed.stage6NoDbMigrationConfirmed,
      detail: `stage6NoDbMigrationConfirmed=${input.parsed.stage6NoDbMigrationConfirmed}`,
    },
    {
      item: "stage6NoFeatureFlagWireConfirmed",
      satisfied: input.parsed.stage6NoFeatureFlagWireConfirmed,
      detail: `stage6NoFeatureFlagWireConfirmed=${input.parsed.stage6NoFeatureFlagWireConfirmed}`,
    },
  ]);

  const boundaryChecklist = mapChecklist([
    { item: "executionModelDesignOnly=true", satisfied: true, detail: "executionModelDesignOnly=true" },
    {
      item: "actualRuntimeExecutionAllowedInThisStep=false",
      satisfied: true,
      detail: "actualRuntimeExecutionAllowedInThisStep=false",
    },
    {
      item: "sourceStage6EntryMode=design_candidate_only",
      satisfied: input.sourceStage6EntryMode === "design_candidate_only",
      detail: `sourceStage6EntryMode=${input.sourceStage6EntryMode}`,
    },
    {
      item: "source Stage 5 knowledge foundation ready",
      satisfied: input.sourceStage5Decision === "stage5_knowledge_foundation_ready",
      detail: `sourceStage5Decision=${input.sourceStage5Decision}`,
    },
    {
      item: "sourceStage6RequiresSeparateApproval=true",
      satisfied: input.sourceStage6RequiresSeparateApproval === true,
      detail: `sourceStage6RequiresSeparateApproval=${input.sourceStage6RequiresSeparateApproval}`,
    },
  ]);

  return { confirmationChecklist, boundaryChecklist };
}

export function appendRuntimeExecutionModelBaselineFindings(input: {
  readonly findings: RuntimeExecutionModelBaselineFinding[];
  readonly decision: RuntimeExecutionModelBaselineDecision;
  readonly parsed: ReturnType<typeof parseRuntimeExecutionModelBaselineInput>;
  readonly sourceStage5Decision: RuntimeExecutionModelBaselineDecisionInput["sourceStage5Decision"];
  readonly unknownUnitKinds: readonly string[];
}): void {
  const { findings, decision, parsed, sourceStage5Decision, unknownUnitKinds } = input;

  findings.push(finding("info", "stage6_a_baseline_evaluator_created", "Stage 6-A baseline evaluator created"));
  findings.push(
    finding("info", "runtime_execution_model_design_only", "Runtime execution model is design-only in this step"),
  );
  findings.push(finding("info", "actual_execution_disallowed", "Actual runtime execution is disallowed in this step"));

  if (sourceStage5Decision === "blocked") {
    findings.push(finding("blocking", "source_stage5_closure_blocked", "Source Stage 5-F closure is blocked"));
    findings.push(finding("blocking", "stage6_a_baseline_blocked", "Stage 6-A baseline is blocked"));
    return;
  }

  if (unknownUnitKinds.length > 0) {
    findings.push(
      finding(
        "blocking",
        "unknown_execution_unit_kind",
        `Unknown execution unit kind requested: ${unknownUnitKinds.join(", ")}`,
      ),
    );
    findings.push(finding("blocking", "stage6_a_baseline_blocked", "Stage 6-A baseline is blocked"));
    return;
  }

  if (decision === "defer") {
    if (sourceStage5Decision === "defer") {
      findings.push(finding("warning", "source_stage5_closure_deferred", "Source Stage 5-F closure defers"));
    }
    if (!parsed.confirmationsSatisfied) {
      findings.push(finding("warning", "stage6_confirmation_missing", "Stage 6-A confirmation is missing"));
    }
    findings.push(finding("warning", "stage6_a_baseline_deferred", "Stage 6-A baseline defers"));
    return;
  }

  findings.push(finding("info", "stage6_a_baseline_ready", "Stage 6-A baseline is ready for model candidate"));
}
