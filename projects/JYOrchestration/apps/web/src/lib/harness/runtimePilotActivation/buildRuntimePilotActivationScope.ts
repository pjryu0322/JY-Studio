/**
 * H27 — activation candidate **scope** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforePilotActivation } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type { RuntimePilotActivationScope } from "./runtimePilotActivationTypes";

const FORBIDDEN_ACTIVATION_OPERATIONS = [
  "actual runtime adapter invocation",
  "actual sandbox invocation",
  "actual execution",
  "provider routing",
  "queue control",
  "rollback execution",
  "approval enforcement",
  "prompt mutation",
] as const;

export function buildRuntimePilotActivationScope(
  reports: RuntimeSemanticPlanningReportsBeforePilotActivation
): RuntimePilotActivationScope {
  const input = reports.runtimeAdapterSandboxInputEnvelope;
  const output = reports.runtimeAdapterSandboxOutputEnvelope;
  const pf = reports.runtimeAdapterSandboxPreflightSummary;

  const requiredInputMetadata = mergeSortedUniqueKo([
    "runtimeAdapterSandboxPreflightSummary",
    "runtimeAdapterSandboxEnvelopeVerificationReport",
    "runtimeAdapterSandboxBoundaryViolationReport",
    "runtimeAdapterSandboxBlockerReport",
    ...input.envelopeRows.slice(0, 4),
  ]);

  const expectedOutputMetadata = mergeSortedUniqueKo([
    "runtimePilotActivationSummary",
    "runtimePilotActivationScope",
    "runtimePilotActivationPolicy",
    "runtimePilotActivationBlockerReport",
    "runtimePilotActivationReadinessChecklist",
    ...output.acceptedMetadataRows.slice(0, 3),
  ]);

  const allowedActivationMetadataScopes = mergeSortedUniqueKo([
    "activation_candidate_status",
    "activation_mode_metadata_only",
    "activation_readiness_checklist",
    `sandboxPreflight:${pf.preflightReadiness}`,
    "diagnosticBundleIncludesPilotActivation:metadata",
  ]);

  const recommendations = mergeSortedUniqueKo([
    "H27: activation scope — metadata_only candidate(실제 activation·sandbox 호출 없음)",
    "H28: pilot skeleton 논의 전 activation candidate gate 유지",
  ]);

  return {
    mode: "runtime_pilot_activation_scope",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotActivationEnabled: false,
    actualPilotExecutionEnabled: false,
    candidateSourceLayer: "H26.5_runtime_adapter_sandbox_preflight",
    candidateTargetLayer: "H28_controlled_runtime_pilot_skeleton",
    requiredInputMetadata,
    expectedOutputMetadata,
    allowedActivationMetadataScopes,
    forbiddenActivationOperations: [...FORBIDDEN_ACTIVATION_OPERATIONS],
    recommendations,
  };
}
