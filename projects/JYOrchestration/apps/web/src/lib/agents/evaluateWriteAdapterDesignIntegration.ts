/**
 * Evaluate Agent / Operator write adapter design integration (read-only; no adapter wire, Prisma, or DB write).
 */

import { evaluateAgentExecutionRecordWritePathDesign } from "@/lib/agents/evaluateAgentExecutionRecordWritePathDesign";
import { evaluateAgentExecutionRecordWritePathWireApprovalGate } from "@/lib/agents/evaluateAgentExecutionRecordWritePathWireApprovalGate";
import { evaluateOperatorApprovalAuditWritePathDesign } from "@/lib/agents/evaluateOperatorApprovalAuditWritePathDesign";
import { evaluateOperatorApprovalAuditWritePathWireApprovalGate } from "@/lib/agents/evaluateOperatorApprovalAuditWritePathWireApprovalGate";
import type {
  WriteAdapterDesignIntegrationChecklistItem,
  WriteAdapterDesignIntegrationDecision,
  WriteAdapterDesignIntegrationFinding,
  WriteAdapterDesignIntegrationReport,
} from "@/lib/agents/writeAdapterDesignIntegrationTypes";

const ADAPTER_CHECKLIST_ITEMS = [
  "agent wire gate ready",
  "operator wire gate ready",
  "agent write path design ready",
  "operator write path design ready",
  "agent adapter boundary identified",
  "operator adapter boundary identified",
  "agent feature flag identified",
  "operator feature flag identified",
  "agent sanitizer policy available",
  "operator sanitizer policy available",
  "agent forbidden field guard available",
  "operator forbidden field guard available",
  "operator permission guard available",
  "operator audit guard available",
] as const;

const SAFETY_CHECKLIST_ITEMS = [
  "adapter design only",
  "no adapter wire in this step",
  "no DB write in this step",
  "no Prisma call in this step",
  "no schema change in this step",
  "no migration in this step",
  "no feature flag wire in this step",
  "no runtime route change in this step",
  "existing execution path preserved",
] as const;

const ROLLBACK_CHECKLIST_ITEMS = [
  "agent rollback plan available",
  "operator rollback plan available",
  "agent feature flag rollback available",
  "operator feature flag rollback available",
  "operator approval required for rollback",
  "audit trail rollback impact reviewed",
] as const;

function finding(
  severity: WriteAdapterDesignIntegrationFinding["severity"],
  code: string,
  message: string,
): WriteAdapterDesignIntegrationFinding {
  return { severity, code, message };
}

function resolveIntegrationDecision(input: {
  readonly agentWireGateDecision: string;
  readonly operatorWireGateDecision: string;
  readonly agentWritePathDecision: string;
  readonly operatorWritePathDecision: string;
}): WriteAdapterDesignIntegrationDecision {
  if (
    input.agentWireGateDecision === "blocked" ||
    input.operatorWireGateDecision === "blocked" ||
    input.agentWritePathDecision === "blocked" ||
    input.operatorWritePathDecision === "blocked"
  ) {
    return "blocked";
  }

  if (
    input.agentWireGateDecision !== "ready_for_write_path_wire_approval" ||
    input.operatorWireGateDecision !== "ready_for_write_path_wire_approval" ||
    input.agentWritePathDecision !== "ready_for_write_path_design" ||
    input.operatorWritePathDecision !== "ready_for_write_path_design"
  ) {
    return "defer";
  }

  return "ready_for_adapter_design";
}

function buildChecklist(
  items: readonly string[],
  satisfaction: Record<string, boolean>,
): WriteAdapterDesignIntegrationChecklistItem[] {
  return items.map((item) => ({
    item,
    satisfied: satisfaction[item] ?? false,
    reason: (satisfaction[item] ?? false)
      ? `${item} satisfied`
      : `${item} not satisfied`,
  }));
}

function buildAdapterChecklist(input: {
  readonly agentWireGateReady: boolean;
  readonly operatorWireGateReady: boolean;
  readonly agentWritePathReady: boolean;
  readonly operatorWritePathReady: boolean;
  readonly agentAdapterBoundaryIdentified: boolean;
  readonly operatorAdapterBoundaryIdentified: boolean;
  readonly agentFeatureFlagIdentified: boolean;
  readonly operatorFeatureFlagIdentified: boolean;
  readonly agentSanitizerAvailable: boolean;
  readonly operatorSanitizerAvailable: boolean;
  readonly agentForbiddenGuardAvailable: boolean;
  readonly operatorForbiddenGuardAvailable: boolean;
  readonly operatorPermissionGuardAvailable: boolean;
  readonly operatorAuditGuardAvailable: boolean;
}): WriteAdapterDesignIntegrationChecklistItem[] {
  return buildChecklist(ADAPTER_CHECKLIST_ITEMS, {
    "agent wire gate ready": input.agentWireGateReady,
    "operator wire gate ready": input.operatorWireGateReady,
    "agent write path design ready": input.agentWritePathReady,
    "operator write path design ready": input.operatorWritePathReady,
    "agent adapter boundary identified": input.agentAdapterBoundaryIdentified,
    "operator adapter boundary identified": input.operatorAdapterBoundaryIdentified,
    "agent feature flag identified": input.agentFeatureFlagIdentified,
    "operator feature flag identified": input.operatorFeatureFlagIdentified,
    "agent sanitizer policy available": input.agentSanitizerAvailable,
    "operator sanitizer policy available": input.operatorSanitizerAvailable,
    "agent forbidden field guard available": input.agentForbiddenGuardAvailable,
    "operator forbidden field guard available": input.operatorForbiddenGuardAvailable,
    "operator permission guard available": input.operatorPermissionGuardAvailable,
    "operator audit guard available": input.operatorAuditGuardAvailable,
  });
}

function buildSafetyChecklist(): WriteAdapterDesignIntegrationChecklistItem[] {
  return buildChecklist(SAFETY_CHECKLIST_ITEMS, {
    "adapter design only": true,
    "no adapter wire in this step": true,
    "no DB write in this step": true,
    "no Prisma call in this step": true,
    "no schema change in this step": true,
    "no migration in this step": true,
    "no feature flag wire in this step": true,
    "no runtime route change in this step": true,
    "existing execution path preserved": true,
  });
}

function buildRollbackChecklist(input: {
  readonly agentRollbackAvailable: boolean;
  readonly operatorRollbackAvailable: boolean;
  readonly agentFeatureFlagRollbackAvailable: boolean;
  readonly operatorFeatureFlagRollbackAvailable: boolean;
  readonly operatorApprovalRequired: boolean;
  readonly auditTrailRollbackReviewed: boolean;
}): WriteAdapterDesignIntegrationChecklistItem[] {
  return buildChecklist(ROLLBACK_CHECKLIST_ITEMS, {
    "agent rollback plan available": input.agentRollbackAvailable,
    "operator rollback plan available": input.operatorRollbackAvailable,
    "agent feature flag rollback available": input.agentFeatureFlagRollbackAvailable,
    "operator feature flag rollback available": input.operatorFeatureFlagRollbackAvailable,
    "operator approval required for rollback": input.operatorApprovalRequired,
    "audit trail rollback impact reviewed": input.auditTrailRollbackReviewed,
  });
}

function appendIntegrationFindings(input: {
  readonly findings: WriteAdapterDesignIntegrationFinding[];
  readonly decision: WriteAdapterDesignIntegrationDecision;
  readonly agentWireGateDecision: string;
  readonly operatorWireGateDecision: string;
  readonly agentWritePathDecision: string;
  readonly operatorWritePathDecision: string;
}): void {
  const {
    findings,
    decision,
    agentWireGateDecision,
    operatorWireGateDecision,
    agentWritePathDecision,
    operatorWritePathDecision,
  } = input;

  findings.push(
    finding(
      "info",
      "write_adapter_design_integration_read_only",
      "write adapter design integration is read-only; no adapter wire or DB access",
    ),
  );
  findings.push(finding("info", "no_adapter_wire_in_this_step", "write adapter is not wired in this step"));
  findings.push(finding("info", "no_db_write_in_this_step", "DB write is not performed in this step"));
  findings.push(finding("info", "no_prisma_call_in_this_step", "Prisma client is not called in this step"));

  if (decision === "blocked") {
    if (agentWireGateDecision === "blocked") {
      findings.push(finding("blocking", "agent_wire_gate_blocked", "agent write path wire gate is blocked"));
    }
    if (operatorWireGateDecision === "blocked") {
      findings.push(finding("blocking", "operator_wire_gate_blocked", "operator write path wire gate is blocked"));
    }
    if (agentWritePathDecision === "blocked") {
      findings.push(finding("blocking", "agent_write_path_design_blocked", "agent write path design is blocked"));
    }
    if (operatorWritePathDecision === "blocked") {
      findings.push(
        finding("blocking", "operator_write_path_design_blocked", "operator write path design is blocked"),
      );
    }
    findings.push(finding("blocking", "write_adapter_design_blocked", "write adapter design integration is blocked"));
    return;
  }

  if (decision === "defer") {
    if (agentWireGateDecision !== "ready_for_write_path_wire_approval") {
      findings.push(finding("warning", "agent_wire_gate_deferred", "agent write path wire gate is deferred"));
    }
    if (operatorWireGateDecision !== "ready_for_write_path_wire_approval") {
      findings.push(finding("warning", "operator_wire_gate_deferred", "operator write path wire gate is deferred"));
    }
    if (agentWritePathDecision !== "ready_for_write_path_design") {
      findings.push(finding("warning", "agent_write_path_design_deferred", "agent write path design is deferred"));
    }
    if (operatorWritePathDecision !== "ready_for_write_path_design") {
      findings.push(
        finding("warning", "operator_write_path_design_deferred", "operator write path design is deferred"),
      );
    }
    findings.push(
      finding("warning", "write_adapter_design_deferred", "write adapter design integration defers until prerequisites are met"),
    );
    return;
  }

  findings.push(finding("info", "agent_write_path_design_ready", "agent write path design is ready"));
  findings.push(finding("info", "operator_write_path_design_ready", "operator write path design is ready"));
  findings.push(finding("info", "agent_wire_gate_ready", "agent write path wire gate is ready"));
  findings.push(finding("info", "operator_wire_gate_ready", "operator write path wire gate is ready"));
  findings.push(finding("info", "write_adapter_design_ready", "write adapter design integration is ready"));
}

/** Read-only write adapter design integration — does not wire adapters, call Prisma, or modify schema. */
export function evaluateWriteAdapterDesignIntegration(input?: {
  readonly agentTarget?: string;
  readonly operatorTarget?: string;
  readonly agentExplicitUserApproval?: boolean;
  readonly agentSchemaAppliedConfirmed?: boolean;
  readonly agentMigrationAppliedConfirmed?: boolean;
  readonly agentFeatureFlagWireApproved?: boolean;
  readonly agentWriteAdapterImplementedConfirmed?: boolean;
  readonly operatorExplicitUserApproval?: boolean;
  readonly operatorSchemaAppliedConfirmed?: boolean;
  readonly operatorMigrationAppliedConfirmed?: boolean;
  readonly operatorFeatureFlagWireApproved?: boolean;
  readonly operatorWriteAdapterImplementedConfirmed?: boolean;
  readonly operatorPermissionModelConfirmed?: boolean;
  readonly operatorAuditTrailConfirmed?: boolean;
}): WriteAdapterDesignIntegrationReport {
  const agentTarget = input?.agentTarget ?? "agent_execution_record";
  const operatorTarget = input?.operatorTarget ?? "operator_approval";

  const agentWireGate = evaluateAgentExecutionRecordWritePathWireApprovalGate({
    target: agentTarget,
    explicitUserApproval: input?.agentExplicitUserApproval,
    schemaAppliedConfirmed: input?.agentSchemaAppliedConfirmed,
    migrationAppliedConfirmed: input?.agentMigrationAppliedConfirmed,
    featureFlagWireApproved: input?.agentFeatureFlagWireApproved,
    writeAdapterImplementedConfirmed: input?.agentWriteAdapterImplementedConfirmed,
  });

  const operatorWireGate = evaluateOperatorApprovalAuditWritePathWireApprovalGate({
    target: operatorTarget,
    explicitUserApproval: input?.operatorExplicitUserApproval,
    schemaAppliedConfirmed: input?.operatorSchemaAppliedConfirmed,
    migrationAppliedConfirmed: input?.operatorMigrationAppliedConfirmed,
    featureFlagWireApproved: input?.operatorFeatureFlagWireApproved,
    writeAdapterImplementedConfirmed: input?.operatorWriteAdapterImplementedConfirmed,
    permissionModelConfirmed: input?.operatorPermissionModelConfirmed,
    auditTrailConfirmed: input?.operatorAuditTrailConfirmed,
  });

  const agentWritePath = evaluateAgentExecutionRecordWritePathDesign({ target: agentTarget });
  const operatorWritePath = evaluateOperatorApprovalAuditWritePathDesign({ target: operatorTarget });

  const decision = resolveIntegrationDecision({
    agentWireGateDecision: agentWireGate.decision,
    operatorWireGateDecision: operatorWireGate.decision,
    agentWritePathDecision: agentWritePath.decision,
    operatorWritePathDecision: operatorWritePath.decision,
  });

  const agentWireGateReady = agentWireGate.decision === "ready_for_write_path_wire_approval";
  const operatorWireGateReady = operatorWireGate.decision === "ready_for_write_path_wire_approval";
  const agentWritePathReady = agentWritePath.decision === "ready_for_write_path_design";
  const operatorWritePathReady = operatorWritePath.decision === "ready_for_write_path_design";

  const agentAdapterBoundaryName = agentWritePath.proposedWriteEntrypoints[0] ?? "";
  const operatorAdapterBoundaryName = operatorWritePath.proposedWriteEntrypoints[0] ?? "";

  const adapterChecklist = buildAdapterChecklist({
    agentWireGateReady,
    operatorWireGateReady,
    agentWritePathReady,
    operatorWritePathReady,
    agentAdapterBoundaryIdentified: agentAdapterBoundaryName.length > 0,
    operatorAdapterBoundaryIdentified: operatorAdapterBoundaryName.length > 0,
    agentFeatureFlagIdentified: agentWritePath.featureFlagName.length > 0,
    operatorFeatureFlagIdentified: operatorWritePath.featureFlagName.length > 0,
    agentSanitizerAvailable: agentWritePath.proposedSanitizers.length > 0,
    operatorSanitizerAvailable: operatorWritePath.proposedSanitizers.length > 0,
    agentForbiddenGuardAvailable: agentWritePath.forbiddenFieldGuards.length > 0,
    operatorForbiddenGuardAvailable: operatorWritePath.forbiddenFieldGuards.length > 0,
    operatorPermissionGuardAvailable: operatorWritePath.proposedPermissionGuards.length > 0,
    operatorAuditGuardAvailable: operatorWritePath.proposedAuditIntegrityGuards.length > 0,
  });

  const safetyChecklist = buildSafetyChecklist();

  const rollbackChecklist = buildRollbackChecklist({
    agentRollbackAvailable: agentWritePath.rollbackPlan.length > 0,
    operatorRollbackAvailable: operatorWritePath.rollbackPlan.length > 0,
    agentFeatureFlagRollbackAvailable:
      agentWritePath.featureFlagName.length > 0 && agentWritePath.rollbackPlan.length > 0,
    operatorFeatureFlagRollbackAvailable:
      operatorWritePath.featureFlagName.length > 0 && operatorWritePath.rollbackPlan.length > 0,
    operatorApprovalRequired: agentWritePath.requiresOperatorApproval || operatorWritePath.requiresOperatorApproval,
    auditTrailRollbackReviewed: operatorWritePath.proposedAuditIntegrityGuards.some((item) =>
      item.toLowerCase().includes("audit"),
    ),
  });

  const findings: WriteAdapterDesignIntegrationFinding[] = [];
  appendIntegrationFindings({
    findings,
    decision,
    agentWireGateDecision: agentWireGate.decision,
    operatorWireGateDecision: operatorWireGate.decision,
    agentWritePathDecision: agentWritePath.decision,
    operatorWritePathDecision: operatorWritePath.decision,
  });

  return {
    mode: "read_only_write_adapter_design_integration",
    decision,
    sourceAgentWireGateDecision: agentWireGate.decision,
    sourceOperatorWireGateDecision: operatorWireGate.decision,
    sourceAgentWritePathDecision: agentWritePath.decision,
    sourceOperatorWritePathDecision: operatorWritePath.decision,
    agentAdapterTarget: agentWritePath.target,
    operatorAdapterTarget: operatorWritePath.target,
    agentAdapterBoundaryName,
    operatorAdapterBoundaryName,
    agentFeatureFlagName: agentWritePath.featureFlagName,
    operatorFeatureFlagName: operatorWritePath.featureFlagName,
    agentSanitizerCount: agentWritePath.proposedSanitizers.length,
    operatorSanitizerCount: operatorWritePath.proposedSanitizers.length,
    agentForbiddenGuardCount: agentWritePath.forbiddenFieldGuards.length,
    operatorForbiddenGuardCount: operatorWritePath.forbiddenFieldGuards.length,
    operatorPermissionGuardCount: operatorWritePath.proposedPermissionGuards.length,
    operatorAuditGuardCount: operatorWritePath.proposedAuditIntegrityGuards.length,
    adapterChecklist,
    safetyChecklist,
    rollbackChecklist,
    designsAdapterOnly: true,
    wiresAdapterInThisStep: false,
    writesDataInThisStep: false,
    callsPrismaInThisStep: false,
    modifiesSchemaInThisStep: false,
    createsMigrationInThisStep: false,
    wiresFeatureFlagInThisStep: false,
    findings,
  };
}
