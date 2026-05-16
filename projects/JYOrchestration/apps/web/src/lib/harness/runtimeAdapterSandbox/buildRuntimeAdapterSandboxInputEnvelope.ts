/**
 * H26 — sandbox **input envelope** metadata(read-only; payload 생성 없음).
 */

import type { RuntimeSemanticPlanningReportsBeforeAdapterSandbox } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeAdapterSandboxInputEnvelope } from "./runtimeAdapterSandboxTypes";

export function buildRuntimeAdapterSandboxInputEnvelope(
  reports: RuntimeSemanticPlanningReportsBeforeAdapterSandbox
): RuntimeAdapterSandboxInputEnvelope {
  const pf = reports.runtimeNoopAdapterPreflightSummary;
  const pc = reports.runtimePilotContractSummary;
  const v = reports.runtimePilotContractVerificationReport;
  const guard = reports.runtimeAdapterInvocationGuardReport;
  const result = reports.runtimeNoopAdapterResultMetadata;
  const cp = reports.runtimeControlledPilotSummary;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;

  const envelopeRows = mergeSortedUniqueKo([
    `preflightReadiness:${pf.preflightReadiness}`,
    `contractReadiness:${pc.contractReadiness}`,
    `contractVerification:${v.verificationStatus}`,
    `invocationGuard:${guard.invocationGuard}`,
    `noopResultRows:${result.resultRows.length}`,
    `controlledPilotReadiness:${cp.readiness}`,
    `approvalReadiness:${approval.approvalReadiness}`,
    `rollbackReadiness:${rollback.rollbackReadiness}`,
    `auditReadiness:${audit.auditReadiness}`,
    "envelope:metadata_only",
    "actualSandboxInvocation:false",
  ]);

  return {
    mode: "runtime_adapter_sandbox_input_envelope",
    actualRuntimeOrchestrationEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualSandboxInvocationEnabled: false,
    envelopeRows,
    recommendations: mergeSortedUniqueKo([
      "H26: sandbox input envelope — pilot·noop·approval 메타 참조만(실행 없음)",
    ]),
  };
}
