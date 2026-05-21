/**
 * Evaluate Operator approval/audit write path wire approval gate (read-only; no Prisma/DB/write wire).
 */

import type { OperatorApprovalAuditSchemaPrApprovalPackageReport } from "@/lib/agents/operatorApprovalAuditSchemaPrApprovalPackageTypes";
import type {
  OperatorApprovalAuditWritePathWireApprovalChecklistItem,
  OperatorApprovalAuditWritePathWireApprovalDecision,
  OperatorApprovalAuditWritePathWireApprovalFinding,
  OperatorApprovalAuditWritePathWireApprovalGateReport,
} from "@/lib/agents/operatorApprovalAuditWritePathWireApprovalGateTypes";
import type {
  OperatorApprovalAuditWritePathDesignReport,
  OperatorApprovalAuditWritePathTarget,
} from "@/lib/agents/operatorApprovalAuditWritePathDesignTypes";
import { evaluateOperatorApprovalAuditSchemaPrApprovalPackage } from "@/lib/agents/evaluateOperatorApprovalAuditSchemaPrApprovalPackage";
import {
  evaluateOperatorApprovalAuditWritePathDesign,
  normalizeOperatorApprovalAuditWritePathTarget,
} from "@/lib/agents/evaluateOperatorApprovalAuditWritePathDesign";

const APPROVAL_CHECKLIST_ITEMS = [
  "explicit user approval confirmed",
  "schema approval package ready",
  "schema applied confirmed",
  "migration applied confirmed",
  "feature flag wire approved",
  "write adapter implemented confirmed",
  "permission model confirmed",
  "audit trail confirmed",
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
  "operator approval flow reviewed",
  "operator override flow reviewed",
  "rollback approval flow reviewed",
  "audit event flow reviewed",
] as const;

const PERMISSION_CHECKLIST_ITEMS = [
  "operator identity required",
  "actor role policy reviewed",
  "approval permission boundary reviewed",
  "override permission boundary reviewed",
  "rollback permission boundary reviewed",
  "least privilege reviewed",
] as const;

const AUDIT_CHECKLIST_ITEMS = [
  "audit event model available",
  "audit actor recorded",
  "audit decision recorded",
  "audit target recorded",
  "audit timestamp recorded",
  "audit integrity reviewed",
] as const;

const ROLLBACK_CHECKLIST_ITEMS = [
  "feature flag rollback plan available",
  "write adapter rollback plan available",
  "schema rollback risk reviewed",
  "migration rollback risk reviewed",
  "data retention impact reviewed",
  "operator approval required for rollback",
  "audit trail rollback impact reviewed",
] as const;

function finding(
  severity: OperatorApprovalAuditWritePathWireApprovalFinding["severity"],
  code: string,
  message: string,
): OperatorApprovalAuditWritePathWireApprovalFinding {
  return { severity, code, message };
}

function resolveOperatorSchemaApprovalContext(target: OperatorApprovalAuditWritePathTarget): {
  readonly schemaApprovalTarget: string;
  readonly schemaApprovalReferenceOnly: boolean;
} {
  if (target === "operator_approval") {
    return { schemaApprovalTarget: "operator_approval", schemaApprovalReferenceOnly: false };
  }
  if (target === "audit_event") {
    return { schemaApprovalTarget: "audit_event", schemaApprovalReferenceOnly: false };
  }
  if (target === "operator_override" || target === "rollback_approval") {
    return { schemaApprovalTarget: target, schemaApprovalReferenceOnly: true };
  }
  return { schemaApprovalTarget: "unknown", schemaApprovalReferenceOnly: true };
}

function collectSourceBlockingFindingCodes(input: {
  readonly writePath: OperatorApprovalAuditWritePathDesignReport;
  readonly schemaApproval: OperatorApprovalAuditSchemaPrApprovalPackageReport;
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
  readonly writePath: OperatorApprovalAuditWritePathDesignReport;
  readonly schemaApproval: OperatorApprovalAuditSchemaPrApprovalPackageReport;
  readonly schemaApprovalReferenceOnly: boolean;
  readonly explicitUserApproval: boolean;
  readonly schemaAppliedConfirmed: boolean;
  readonly migrationAppliedConfirmed: boolean;
  readonly featureFlagWireApproved: boolean;
  readonly writeAdapterImplementedConfirmed: boolean;
  readonly permissionModelConfirmed: boolean;
  readonly auditTrailConfirmed: boolean;
  readonly sourceBlockingFindingCodes: readonly string[];
}): OperatorApprovalAuditWritePathWireApprovalDecision {
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
    !input.writeAdapterImplementedConfirmed ||
    !input.permissionModelConfirmed ||
    !input.auditTrailConfirmed
  ) {
    return "defer";
  }

  return "ready_for_write_path_wire_approval";
}

function buildChecklist(
  items: readonly string[],
  satisfaction: Record<string, boolean>,
): OperatorApprovalAuditWritePathWireApprovalChecklistItem[] {
  return items.map((item) => ({
    item,
    satisfied: satisfaction[item] ?? false,
    reason: (satisfaction[item] ?? false)
      ? `${item} satisfied`
      : `${item} not satisfied`,
  }));
}

function buildApprovalChecklist(input: {
  readonly explicitUserApproval: boolean;
  readonly schemaApprovalReady: boolean;
  readonly schemaAppliedConfirmed: boolean;
  readonly migrationAppliedConfirmed: boolean;
  readonly featureFlagWireApproved: boolean;
  readonly writeAdapterImplementedConfirmed: boolean;
  readonly permissionModelConfirmed: boolean;
  readonly auditTrailConfirmed: boolean;
}): OperatorApprovalAuditWritePathWireApprovalChecklistItem[] {
  return buildChecklist(APPROVAL_CHECKLIST_ITEMS, {
    "explicit user approval confirmed": input.explicitUserApproval,
    "schema approval package ready": input.schemaApprovalReady,
    "schema applied confirmed": input.schemaAppliedConfirmed,
    "migration applied confirmed": input.migrationAppliedConfirmed,
    "feature flag wire approved": input.featureFlagWireApproved,
    "write adapter implemented confirmed": input.writeAdapterImplementedConfirmed,
    "permission model confirmed": input.permissionModelConfirmed,
    "audit trail confirmed": input.auditTrailConfirmed,
    "separate PR reviewed": input.schemaApprovalReady,
    "no write path wire in this step": true,
    "no data write in this step": true,
    "no Prisma call in this step": true,
  });
}

function buildRuntimeChecklist(input: {
  readonly writePathReady: boolean;
  readonly writePath: OperatorApprovalAuditWritePathDesignReport;
}): OperatorApprovalAuditWritePathWireApprovalChecklistItem[] {
  const { writePath, writePathReady } = input;
  return buildChecklist(RUNTIME_CHECKLIST_ITEMS, {
    "write path design ready": writePathReady,
    "runtime execution path unchanged": true,
    "feature flag default off before wire": writePath.featureFlagDefault === "off",
    "write adapter boundary identified": writePath.proposedWriteEntrypoints.length > 0,
    "sanitizer policy available": writePath.proposedSanitizers.length > 0,
    "forbidden field policy available": writePath.forbiddenFieldGuards.length > 0,
    "operator approval flow reviewed": writePath.target === "operator_approval",
    "operator override flow reviewed":
      writePath.target === "operator_override" || writePath.target === "operator_approval",
    "rollback approval flow reviewed":
      writePath.target === "rollback_approval" || writePath.target === "operator_approval",
    "audit event flow reviewed": writePath.target === "audit_event" || writePath.target === "operator_approval",
  });
}

function buildPermissionChecklist(input: {
  readonly writePath: OperatorApprovalAuditWritePathDesignReport;
  readonly schemaApproval: OperatorApprovalAuditSchemaPrApprovalPackageReport;
  readonly permissionModelConfirmed: boolean;
}): OperatorApprovalAuditWritePathWireApprovalChecklistItem[] {
  const permissionGuards = input.writePath.proposedPermissionGuards.length > 0;
  const permissionChecklistReviewed = input.schemaApproval.permissionAccessChecklist.length > 0;

  return buildChecklist(PERMISSION_CHECKLIST_ITEMS, {
    "operator identity required": permissionGuards,
    "actor role policy reviewed": permissionChecklistReviewed,
    "approval permission boundary reviewed": permissionGuards,
    "override permission boundary reviewed": permissionGuards,
    "rollback permission boundary reviewed": permissionGuards,
    "least privilege reviewed": input.permissionModelConfirmed && permissionChecklistReviewed,
  });
}

function buildAuditChecklist(input: {
  readonly writePath: OperatorApprovalAuditWritePathDesignReport;
  readonly schemaApproval: OperatorApprovalAuditSchemaPrApprovalPackageReport;
  readonly auditTrailConfirmed: boolean;
}): OperatorApprovalAuditWritePathWireApprovalChecklistItem[] {
  const auditGuards = input.writePath.proposedAuditIntegrityGuards.length > 0;
  const auditChecklistReviewed = input.schemaApproval.auditIntegrityChecklist.length > 0;

  return buildChecklist(AUDIT_CHECKLIST_ITEMS, {
    "audit event model available": auditChecklistReviewed || input.writePath.target === "audit_event",
    "audit actor recorded": auditGuards,
    "audit decision recorded": auditGuards,
    "audit target recorded": auditGuards,
    "audit timestamp recorded": auditGuards,
    "audit integrity reviewed": input.auditTrailConfirmed && auditChecklistReviewed,
  });
}

function buildRollbackChecklist(input: {
  readonly writePath: OperatorApprovalAuditWritePathDesignReport;
  readonly schemaApproval: OperatorApprovalAuditSchemaPrApprovalPackageReport;
}): OperatorApprovalAuditWritePathWireApprovalChecklistItem[] {
  const featureFlagRollback =
    input.writePath.featureFlagName.trim().length > 0 && input.writePath.rollbackPlan.length > 0;
  const adapterRollback =
    input.writePath.proposedWriteEntrypoints.length > 0 && input.writePath.rollbackPlan.length > 0;
  const auditTrailRollbackReviewed = input.writePath.proposedAuditIntegrityGuards.some((item) =>
    item.toLowerCase().includes("audit"),
  );

  return buildChecklist(ROLLBACK_CHECKLIST_ITEMS, {
    "feature flag rollback plan available": featureFlagRollback,
    "write adapter rollback plan available": adapterRollback,
    "schema rollback risk reviewed": input.schemaApproval.rollbackChecklist.length > 0,
    "migration rollback risk reviewed": input.schemaApproval.migrationChecklist.length > 0,
    "data retention impact reviewed": input.schemaApproval.permissionAccessChecklist.length > 0,
    "operator approval required for rollback": input.writePath.requiresOperatorApproval,
    "audit trail rollback impact reviewed": auditTrailRollbackReviewed,
  });
}

function appendGateFindings(input: {
  readonly findings: OperatorApprovalAuditWritePathWireApprovalFinding[];
  readonly decision: OperatorApprovalAuditWritePathWireApprovalDecision;
  readonly target: string;
  readonly writePath: OperatorApprovalAuditWritePathDesignReport;
  readonly schemaApproval: OperatorApprovalAuditSchemaPrApprovalPackageReport;
  readonly explicitUserApproval: boolean;
  readonly schemaAppliedConfirmed: boolean;
  readonly migrationAppliedConfirmed: boolean;
  readonly featureFlagWireApproved: boolean;
  readonly writeAdapterImplementedConfirmed: boolean;
  readonly permissionModelConfirmed: boolean;
  readonly auditTrailConfirmed: boolean;
  readonly unsafeUpstream: boolean;
}): void {
  const {
    findings,
    decision,
    target,
    writePath,
    schemaApproval,
    explicitUserApproval,
    schemaAppliedConfirmed,
    migrationAppliedConfirmed,
    featureFlagWireApproved,
    writeAdapterImplementedConfirmed,
    permissionModelConfirmed,
    auditTrailConfirmed,
    unsafeUpstream,
  } = input;

  findings.push(
    finding(
      "info",
      "operator_write_path_wire_gate_read_only",
      "operator write path wire approval gate is read-only; no write/schema/migration wire",
    ),
  );
  findings.push(finding("info", "no_write_path_wire_in_this_step", "write path is not wired in this step"));
  findings.push(finding("info", "no_data_write_in_this_step", "DB write is not performed in this step"));
  findings.push(finding("info", "no_prisma_call_in_this_step", "Prisma client is not called in this step"));

  if (decision === "blocked") {
    if (target === "unknown") {
      findings.push(
        finding("blocking", "unknown_operator_write_path_target", "unknown operator write path target is blocked"),
      );
    }
    if (writePath.decision === "blocked") {
      findings.push(
        finding("blocking", "operator_write_path_design_blocked", "operator write path design is blocked"),
      );
    }
    if (schemaApproval.decision === "blocked") {
      findings.push(
        finding("blocking", "operator_schema_approval_blocked", "operator schema approval package is blocked"),
      );
    }
    if (unsafeUpstream) {
      findings.push(
        finding(
          "blocking",
          "unsafe_operator_write_path_wire",
          "unsafe upstream findings block operator write path wire approval",
        ),
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
    if (!permissionModelConfirmed) {
      findings.push(
        finding("warning", "permission_model_not_confirmed", "permission model confirmation is missing"),
      );
    }
    if (!auditTrailConfirmed) {
      findings.push(finding("warning", "audit_trail_not_confirmed", "audit trail confirmation is missing"));
    }
    findings.push(
      finding(
        "warning",
        "operator_write_path_wire_gate_deferred",
        "operator write path wire approval gate defers until prerequisites are met",
      ),
    );
    return;
  }

  findings.push(finding("info", "schema_approval_package_ready", "schema approval package is ready"));
  findings.push(finding("info", "write_path_design_ready", "write path design is ready for wire approval"));
  findings.push(
    finding(
      "info",
      "operator_write_path_wire_approval_ready",
      "operator write path wire approval gate is ready for wire approval",
    ),
  );
}

/** Read-only operator write path wire approval gate — does not wire write path, call Prisma, or modify schema. */
export function evaluateOperatorApprovalAuditWritePathWireApprovalGate(input?: {
  readonly target?: string;
  readonly explicitUserApproval?: boolean;
  readonly schemaAppliedConfirmed?: boolean;
  readonly migrationAppliedConfirmed?: boolean;
  readonly featureFlagWireApproved?: boolean;
  readonly writeAdapterImplementedConfirmed?: boolean;
  readonly permissionModelConfirmed?: boolean;
  readonly auditTrailConfirmed?: boolean;
}): OperatorApprovalAuditWritePathWireApprovalGateReport {
  const target = normalizeOperatorApprovalAuditWritePathTarget(input?.target);
  const { schemaApprovalTarget, schemaApprovalReferenceOnly } = resolveOperatorSchemaApprovalContext(target);
  const explicitUserApproval = input?.explicitUserApproval === true;
  const schemaAppliedConfirmed = input?.schemaAppliedConfirmed === true;
  const migrationAppliedConfirmed = input?.migrationAppliedConfirmed === true;
  const featureFlagWireApproved = input?.featureFlagWireApproved === true;
  const writeAdapterImplementedConfirmed = input?.writeAdapterImplementedConfirmed === true;
  const permissionModelConfirmed = input?.permissionModelConfirmed === true;
  const auditTrailConfirmed = input?.auditTrailConfirmed === true;

  const writePath = evaluateOperatorApprovalAuditWritePathDesign({ target });
  const schemaApproval = evaluateOperatorApprovalAuditSchemaPrApprovalPackage({
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
    permissionModelConfirmed,
    auditTrailConfirmed,
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
    permissionModelConfirmed,
    auditTrailConfirmed,
  });

  const runtimeChecklist = buildRuntimeChecklist({ writePathReady, writePath });
  const permissionChecklist = buildPermissionChecklist({
    writePath,
    schemaApproval,
    permissionModelConfirmed,
  });
  const auditChecklist = buildAuditChecklist({ writePath, schemaApproval, auditTrailConfirmed });
  const rollbackChecklist = buildRollbackChecklist({ writePath, schemaApproval });

  const findings: OperatorApprovalAuditWritePathWireApprovalFinding[] = [];
  appendGateFindings({
    findings,
    decision,
    target,
    writePath,
    schemaApproval,
    explicitUserApproval,
    schemaAppliedConfirmed,
    migrationAppliedConfirmed,
    featureFlagWireApproved,
    writeAdapterImplementedConfirmed,
    permissionModelConfirmed,
    auditTrailConfirmed,
    unsafeUpstream,
  });

  return {
    mode: "read_only_operator_approval_audit_write_path_wire_approval_gate",
    decision,
    sourceWritePathDecision: writePath.decision,
    sourceSchemaApprovalDecision: schemaApproval.decision,
    sourceSchemaApprovalTarget: schemaApprovalTarget,
    schemaApprovalReferenceOnly,
    target,
    explicitUserApprovalProvided: explicitUserApproval,
    schemaAppliedConfirmed,
    migrationAppliedConfirmed,
    featureFlagWireApproved,
    writeAdapterImplementedConfirmed,
    permissionModelConfirmed,
    auditTrailConfirmed,
    sourceWritePathFeatureFlagName: writePath.featureFlagName,
    sourceWritePathRollbackPlan: [...writePath.rollbackPlan],
    sourceSchemaApprovalRollbackItemCount: schemaApproval.rollbackChecklist.length,
    sourceSchemaApprovalMigrationItemCount: schemaApproval.migrationChecklist.length,
    sourceBlockingFindingCodes,
    approvalChecklist,
    runtimeChecklist,
    rollbackChecklist,
    permissionChecklist,
    auditChecklist,
    requiresExplicitUserApproval: true,
    requiresSchemaApplied: true,
    requiresMigrationApplied: true,
    requiresFeatureFlagWireApproval: true,
    requiresWriteAdapterImplemented: true,
    requiresPermissionModelConfirmed: true,
    requiresAuditTrailConfirmed: true,
    wiresWritePathInThisStep: false,
    writesDataInThisStep: false,
    callsPrismaInThisStep: false,
    modifiesSchemaInThisStep: false,
    createsMigrationInThisStep: false,
    findings,
  };
}
