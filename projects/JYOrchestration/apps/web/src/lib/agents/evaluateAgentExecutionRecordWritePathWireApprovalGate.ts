/**
 * Evaluate Agent execution record write path wire approval gate (read-only; no Prisma/DB/write wire).
 */

import type { AgentExecutionRecordSchemaPrApprovalPackageReport } from "@/lib/agents/agentExecutionRecordSchemaPrApprovalPackageTypes";
import type {
  AgentExecutionRecordWritePathWireApprovalChecklistItem,
  AgentExecutionRecordWritePathWireApprovalDecision,
  AgentExecutionRecordWritePathWireApprovalFinding,
  AgentExecutionRecordWritePathWireApprovalGateReport,
} from "@/lib/agents/agentExecutionRecordWritePathWireApprovalGateTypes";
import type {
  AgentExecutionRecordWritePathDesignReport,
  AgentExecutionRecordWritePathTarget,
} from "@/lib/agents/agentExecutionRecordWritePathDesignTypes";
import { evaluateAgentExecutionRecordSchemaPrApprovalPackage } from "@/lib/agents/evaluateAgentExecutionRecordSchemaPrApprovalPackage";
import {
  evaluateAgentExecutionRecordWritePathDesign,
  normalizeAgentExecutionRecordWritePathTarget,
} from "@/lib/agents/evaluateAgentExecutionRecordWritePathDesign";

const APPROVAL_CHECKLIST_ITEMS = [
  "explicit user approval confirmed",
  "schema approval package ready",
  "schema applied confirmed",
  "migration applied confirmed",
  "feature flag wire approved",
  "write adapter implemented confirmed",
  "separate PR reviewed",
  "no write path wire in this step",
  "no data write in this step",
  "no Prisma call in this step",
] as const;

const RUNTIME_CHECKLIST_ITEMS = [
  "write path design ready",
  "runtime execution path unchanged",
  "feature flag default off before wire",
  "write adapter boundary identified",
  "sanitizer policy available",
  "forbidden field policy available",
  "audit/timeline link policy reviewed",
] as const;

const ROLLBACK_CHECKLIST_ITEMS = [
  "feature flag rollback plan available",
  "write adapter rollback plan available",
  "schema rollback risk reviewed",
  "migration rollback risk reviewed",
  "data retention impact reviewed",
  "operator approval required for rollback",
] as const;

function finding(
  severity: AgentExecutionRecordWritePathWireApprovalFinding["severity"],
  code: string,
  message: string,
): AgentExecutionRecordWritePathWireApprovalFinding {
  return { severity, code, message };
}

function resolveAgentSchemaApprovalContext(target: AgentExecutionRecordWritePathTarget): {
  readonly schemaApprovalTarget: string;
  readonly schemaApprovalReferenceOnly: boolean;
} {
  if (target === "agent_execution_record") {
    return { schemaApprovalTarget: "agent_execution_record", schemaApprovalReferenceOnly: false };
  }
  if (target === "timeline_event_link" || target === "audit_trail_link") {
    return { schemaApprovalTarget: "unknown", schemaApprovalReferenceOnly: true };
  }
  return { schemaApprovalTarget: "unknown", schemaApprovalReferenceOnly: true };
}

function collectSourceBlockingFindingCodes(input: {
  readonly writePath: AgentExecutionRecordWritePathDesignReport;
  readonly schemaApproval: AgentExecutionRecordSchemaPrApprovalPackageReport;
  readonly schemaApprovalReferenceOnly: boolean;
}): string[] {
  const schemaFindings = input.schemaApprovalReferenceOnly ? [] : input.schemaApproval.findings;
  return [...input.writePath.findings, ...schemaFindings]
    .filter((item) => item.severity === "blocking")
    .map((item) => item.code);
}

function hasUnsafeUpstreamFindings(sourceBlockingFindingCodes: readonly string[]): boolean {
  return sourceBlockingFindingCodes.length > 0;
}

function resolveWireApprovalDecision(input: {
  readonly target: string;
  readonly writePath: AgentExecutionRecordWritePathDesignReport;
  readonly schemaApproval: AgentExecutionRecordSchemaPrApprovalPackageReport;
  readonly schemaApprovalReferenceOnly: boolean;
  readonly explicitUserApproval: boolean;
  readonly schemaAppliedConfirmed: boolean;
  readonly migrationAppliedConfirmed: boolean;
  readonly featureFlagWireApproved: boolean;
  readonly writeAdapterImplementedConfirmed: boolean;
  readonly sourceBlockingFindingCodes: readonly string[];
}): AgentExecutionRecordWritePathWireApprovalDecision {
  if (input.target === "unknown") {
    return "blocked";
  }

  if (input.writePath.decision === "blocked") {
    return "blocked";
  }

  if (!input.schemaApprovalReferenceOnly && input.schemaApproval.decision === "blocked") {
    return "blocked";
  }

  if (hasUnsafeUpstreamFindings(input.sourceBlockingFindingCodes)) {
    return "blocked";
  }

  if (input.writePath.decision !== "ready_for_write_path_design") {
    return "defer";
  }

  if (
    input.schemaApprovalReferenceOnly ||
    input.schemaApproval.decision !== "ready_for_explicit_schema_pr_approval"
  ) {
    return "defer";
  }

  if (
    !input.explicitUserApproval ||
    !input.schemaAppliedConfirmed ||
    !input.migrationAppliedConfirmed ||
    !input.featureFlagWireApproved ||
    !input.writeAdapterImplementedConfirmed
  ) {
    return "defer";
  }

  return "ready_for_write_path_wire_approval";
}

function buildApprovalChecklist(input: {
  readonly explicitUserApproval: boolean;
  readonly schemaApprovalReady: boolean;
  readonly schemaAppliedConfirmed: boolean;
  readonly migrationAppliedConfirmed: boolean;
  readonly featureFlagWireApproved: boolean;
  readonly writeAdapterImplementedConfirmed: boolean;
}): AgentExecutionRecordWritePathWireApprovalChecklistItem[] {
  const satisfaction: Record<string, boolean> = {
    "explicit user approval confirmed": input.explicitUserApproval,
    "schema approval package ready": input.schemaApprovalReady,
    "schema applied confirmed": input.schemaAppliedConfirmed,
    "migration applied confirmed": input.migrationAppliedConfirmed,
    "feature flag wire approved": input.featureFlagWireApproved,
    "write adapter implemented confirmed": input.writeAdapterImplementedConfirmed,
    "separate PR reviewed": input.schemaApprovalReady,
    "no write path wire in this step": true,
    "no data write in this step": true,
    "no Prisma call in this step": true,
  };

  return APPROVAL_CHECKLIST_ITEMS.map((item) => ({
    item,
    satisfied: satisfaction[item] ?? false,
    reason: (satisfaction[item] ?? false)
      ? `${item} satisfied`
      : `${item} not satisfied`,
  }));
}

function buildRuntimeChecklist(input: {
  readonly writePathReady: boolean;
  readonly writePath: AgentExecutionRecordWritePathDesignReport;
}): AgentExecutionRecordWritePathWireApprovalChecklistItem[] {
  const { writePath, writePathReady } = input;
  const sanitizersAvailable = writePath.proposedSanitizers.length > 0;
  const forbiddenPolicyAvailable = writePath.forbiddenFieldGuards.length > 0;
  const linkPolicyReviewed =
    writePath.target === "agent_execution_record" ||
    writePath.target === "timeline_event_link" ||
    writePath.target === "audit_trail_link";

  const satisfaction: Record<string, boolean> = {
    "write path design ready": writePathReady,
    "runtime execution path unchanged": true,
    "feature flag default off before wire": writePath.featureFlagDefault === "off",
    "write adapter boundary identified": writePath.proposedWriteEntrypoints.length > 0,
    "sanitizer policy available": sanitizersAvailable,
    "forbidden field policy available": forbiddenPolicyAvailable,
    "audit/timeline link policy reviewed": linkPolicyReviewed,
  };

  return RUNTIME_CHECKLIST_ITEMS.map((item) => ({
    item,
    satisfied: satisfaction[item] ?? false,
    reason: (satisfaction[item] ?? false)
      ? `${item} satisfied`
      : `${item} not satisfied`,
  }));
}

function buildRollbackChecklist(input: {
  readonly writePath: AgentExecutionRecordWritePathDesignReport;
  readonly schemaApproval: AgentExecutionRecordSchemaPrApprovalPackageReport;
}): AgentExecutionRecordWritePathWireApprovalChecklistItem[] {
  const featureFlagRollback =
    input.writePath.featureFlagName.trim().length > 0 && input.writePath.rollbackPlan.length > 0;
  const adapterRollback =
    input.writePath.proposedWriteEntrypoints.length > 0 && input.writePath.rollbackPlan.length > 0;
  const schemaRollbackReviewed = input.schemaApproval.rollbackChecklist.length > 0;
  const migrationRollbackReviewed = input.schemaApproval.migrationChecklist.length > 0;
  const retentionReviewed = input.schemaApproval.retentionAccessChecklist.length > 0;

  const satisfaction: Record<string, boolean> = {
    "feature flag rollback plan available": featureFlagRollback,
    "write adapter rollback plan available": adapterRollback,
    "schema rollback risk reviewed": schemaRollbackReviewed,
    "migration rollback risk reviewed": migrationRollbackReviewed,
    "data retention impact reviewed": retentionReviewed,
    "operator approval required for rollback": input.writePath.requiresOperatorApproval,
  };

  return ROLLBACK_CHECKLIST_ITEMS.map((item) => ({
    item,
    satisfied: satisfaction[item] ?? false,
    reason: (satisfaction[item] ?? false)
      ? `${item} satisfied`
      : `${item} not satisfied`,
  }));
}

function appendGateFindings(input: {
  readonly findings: AgentExecutionRecordWritePathWireApprovalFinding[];
  readonly decision: AgentExecutionRecordWritePathWireApprovalDecision;
  readonly writePath: AgentExecutionRecordWritePathDesignReport;
  readonly schemaApproval: AgentExecutionRecordSchemaPrApprovalPackageReport;
  readonly explicitUserApproval: boolean;
  readonly schemaAppliedConfirmed: boolean;
  readonly migrationAppliedConfirmed: boolean;
  readonly featureFlagWireApproved: boolean;
  readonly writeAdapterImplementedConfirmed: boolean;
  readonly unsafeUpstream: boolean;
}): void {
  const {
    findings,
    decision,
    writePath,
    schemaApproval,
    explicitUserApproval,
    schemaAppliedConfirmed,
    migrationAppliedConfirmed,
    featureFlagWireApproved,
    writeAdapterImplementedConfirmed,
    unsafeUpstream,
  } = input;

  findings.push(
    finding(
      "info",
      "write_path_wire_gate_read_only",
      "write path wire approval gate is read-only; no write/schema/migration wire",
    ),
  );
  findings.push(finding("info", "no_write_path_wire_in_this_step", "write path is not wired in this step"));
  findings.push(finding("info", "no_data_write_in_this_step", "DB write is not performed in this step"));
  findings.push(finding("info", "no_prisma_call_in_this_step", "Prisma client is not called in this step"));

  if (decision === "blocked") {
    if (writePath.decision === "blocked") {
      findings.push(finding("blocking", "write_path_design_blocked", "write path design is blocked"));
    }
    if (schemaApproval.decision === "blocked") {
      findings.push(finding("blocking", "schema_approval_blocked", "schema approval package is blocked"));
    }
    if (unsafeUpstream) {
      findings.push(
        finding("blocking", "unsafe_write_path_wire", "unsafe upstream findings block write path wire approval"),
      );
    }
    return;
  }

  if (decision === "defer") {
    if (!explicitUserApproval) {
      findings.push(
        finding("warning", "explicit_user_approval_missing", "explicit user approval is required before wire"),
      );
    }
    if (!schemaAppliedConfirmed) {
      findings.push(finding("warning", "schema_not_applied", "schema applied confirmation is missing"));
    }
    if (!migrationAppliedConfirmed) {
      findings.push(finding("warning", "migration_not_applied", "migration applied confirmation is missing"));
    }
    if (!featureFlagWireApproved) {
      findings.push(
        finding("warning", "feature_flag_wire_not_approved", "feature flag wire approval is missing"),
      );
    }
    if (!writeAdapterImplementedConfirmed) {
      findings.push(
        finding("warning", "write_adapter_not_implemented", "write adapter implementation is not confirmed"),
      );
    }
    findings.push(
      finding(
        "warning",
        "write_path_wire_gate_deferred",
        "write path wire approval gate defers until prerequisites are met",
      ),
    );
    return;
  }

  findings.push(finding("info", "schema_approval_package_ready", "schema approval package is ready"));
  findings.push(finding("info", "write_path_design_ready", "write path design is ready for wire approval"));
  findings.push(
    finding("info", "write_path_wire_approval_ready", "write path wire approval gate is ready for wire approval"),
  );
}

/** Read-only write path wire approval gate — does not wire write path, call Prisma, or modify schema. */
export function evaluateAgentExecutionRecordWritePathWireApprovalGate(input?: {
  readonly target?: string;
  readonly explicitUserApproval?: boolean;
  readonly schemaAppliedConfirmed?: boolean;
  readonly migrationAppliedConfirmed?: boolean;
  readonly featureFlagWireApproved?: boolean;
  readonly writeAdapterImplementedConfirmed?: boolean;
}): AgentExecutionRecordWritePathWireApprovalGateReport {
  const target = normalizeAgentExecutionRecordWritePathTarget(input?.target);
  const { schemaApprovalTarget, schemaApprovalReferenceOnly } = resolveAgentSchemaApprovalContext(target);
  const explicitUserApproval = input?.explicitUserApproval === true;
  const schemaAppliedConfirmed = input?.schemaAppliedConfirmed === true;
  const migrationAppliedConfirmed = input?.migrationAppliedConfirmed === true;
  const featureFlagWireApproved = input?.featureFlagWireApproved === true;
  const writeAdapterImplementedConfirmed = input?.writeAdapterImplementedConfirmed === true;

  const writePath = evaluateAgentExecutionRecordWritePathDesign({ target });
  const schemaApproval = evaluateAgentExecutionRecordSchemaPrApprovalPackage({
    target: schemaApprovalTarget,
    explicitUserApproval: input?.explicitUserApproval,
  });

  const sourceBlockingFindingCodes = collectSourceBlockingFindingCodes({
    writePath,
    schemaApproval,
    schemaApprovalReferenceOnly,
  });
  const unsafeUpstream = hasUnsafeUpstreamFindings(sourceBlockingFindingCodes);
  const decision = resolveWireApprovalDecision({
    target,
    writePath,
    schemaApproval,
    schemaApprovalReferenceOnly,
    explicitUserApproval,
    schemaAppliedConfirmed,
    migrationAppliedConfirmed,
    featureFlagWireApproved,
    writeAdapterImplementedConfirmed,
    sourceBlockingFindingCodes,
  });

  const schemaApprovalReady =
    !schemaApprovalReferenceOnly &&
    schemaApproval.decision === "ready_for_explicit_schema_pr_approval";
  const writePathReady = writePath.decision === "ready_for_write_path_design";

  const approvalChecklist = buildApprovalChecklist({
    explicitUserApproval,
    schemaApprovalReady,
    schemaAppliedConfirmed,
    migrationAppliedConfirmed,
    featureFlagWireApproved,
    writeAdapterImplementedConfirmed,
  });

  const runtimeChecklist = buildRuntimeChecklist({ writePathReady, writePath });
  const rollbackChecklist = buildRollbackChecklist({ writePath, schemaApproval });

  const findings: AgentExecutionRecordWritePathWireApprovalFinding[] = [];
  appendGateFindings({
    findings,
    decision,
    writePath,
    schemaApproval,
    explicitUserApproval,
    schemaAppliedConfirmed,
    migrationAppliedConfirmed,
    featureFlagWireApproved,
    writeAdapterImplementedConfirmed,
    unsafeUpstream,
  });

  return {
    mode: "read_only_agent_execution_record_write_path_wire_approval_gate",
    decision,
    sourceWritePathDecision: writePath.decision,
    sourceSchemaApprovalDecision: schemaApproval.decision,
    sourceSchemaApprovalTarget: schemaApprovalTarget,
    schemaApprovalReferenceOnly,
    sourceWritePathTarget: writePath.target,
    sourceSchemaApprovalMode: schemaApprovalReferenceOnly ? "reference_only" : "primary",
    target,
    explicitUserApprovalProvided: explicitUserApproval,
    schemaAppliedConfirmed,
    migrationAppliedConfirmed,
    featureFlagWireApproved,
    writeAdapterImplementedConfirmed,
    sourceWritePathFeatureFlagName: writePath.featureFlagName,
    sourceWritePathRollbackPlan: [...writePath.rollbackPlan],
    sourceSchemaApprovalRollbackItemCount: schemaApproval.rollbackChecklist.length,
    sourceSchemaApprovalMigrationItemCount: schemaApproval.migrationChecklist.length,
    sourceBlockingFindingCodes,
    approvalChecklist,
    runtimeChecklist,
    rollbackChecklist,
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
    findings,
  };
}
