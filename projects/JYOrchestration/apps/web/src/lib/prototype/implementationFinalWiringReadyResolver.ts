import {
  INTEGRATION_FINAL_WIRING_STEP_ID,
  INTEGRATION_FINAL_WIRING_WORK_BRANCH,
  type ImplementationIntegrationStepV1,
} from "@/lib/prototype/implementationIntegrationStep";
import { findIntegrationStep } from "@/lib/prototype/implementationIntegrationStepMutations";
import { loadImplementationIntegrationStepsFromState } from "@/lib/prototype/implementationIntegrationStepStore";
import type { RequirementsPromptTimelineEntry, RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export type FinalWiringReadyReasonV1 =
  | "step_ready"
  | "ready_event_found"
  | "branch_and_sources_ready"
  | "missing_final_wiring_step"
  | "missing_source_units"
  | "missing_work_branch"
  | "step_not_ready";

export type FinalWiringReadyStateV1 = Readonly<{
  readonly ready: boolean;
  readonly reason: FinalWiringReadyReasonV1;
  readonly finalWiringStepId: string | null;
  readonly finalWiringWorkBranch: string | null;
  readonly sourceUnitCount: number;
  readonly hasReadyEvent: boolean;
  readonly stepStatus: string | null;
}>;

const STEP_STATUS_READY_FOR_INTEGRATION_BUTTON = new Set([
  "ready",
  "completed",
  "failed",
  "pending",
  "running",
]);

export function hasFinalWiringReadyTimelineEvent(
  timeline: readonly RequirementsPromptTimelineEntry[] | null | undefined,
): boolean {
  for (const entry of timeline ?? []) {
    const action = String(entry.action ?? "").trim();
    if (action === "implementation_integration_final_wiring_ready") return true;
    const responseText = String(entry.responseText ?? "");
    if (responseText.includes("type=implementation_integration_final_wiring_ready")) return true;
  }
  return false;
}

export function resolveFinalWiringReadyState(input: {
  readonly integrationSteps: readonly ImplementationIntegrationStepV1[];
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  readonly sourceUnitCount: number;
  readonly projectId?: string | null;
}): FinalWiringReadyStateV1 {
  const step = findIntegrationStep(input.integrationSteps, "final_wiring");
  const hasReadyEvent = hasFinalWiringReadyTimelineEvent(input.promptTimeline);
  const finalWiringStepId = step?.stepId?.trim() || INTEGRATION_FINAL_WIRING_STEP_ID;
  const finalWiringWorkBranch =
    String(step?.workBranch ?? INTEGRATION_FINAL_WIRING_WORK_BRANCH).trim() || null;
  const stepStatus = step ? String(step.status).trim() : null;
  const sourceUnitCount = Math.max(0, input.sourceUnitCount);

  const base = {
    finalWiringStepId,
    finalWiringWorkBranch,
    sourceUnitCount,
    hasReadyEvent,
    stepStatus,
  } as const;

  if (hasReadyEvent) {
    return { ready: true, reason: "ready_event_found", ...base };
  }

  if (step && stepStatus && STEP_STATUS_READY_FOR_INTEGRATION_BUTTON.has(stepStatus)) {
    if (sourceUnitCount > 0) {
      return {
        ready: true,
        reason: stepStatus === "pending" || stepStatus === "running" ? "branch_and_sources_ready" : "step_ready",
        ...base,
      };
    }
    return { ready: false, reason: "missing_source_units", ...base };
  }

  if (step && finalWiringWorkBranch && sourceUnitCount > 0) {
    return { ready: true, reason: "branch_and_sources_ready", ...base };
  }

  if (!step) {
    return { ready: false, reason: "missing_final_wiring_step", ...base };
  }
  if (sourceUnitCount <= 0) {
    return { ready: false, reason: "missing_source_units", ...base };
  }
  if (!finalWiringWorkBranch) {
    return { ready: false, reason: "missing_work_branch", ...base };
  }
  return { ready: false, reason: "step_not_ready", ...base };
}

export function resolveFinalWiringReadyForIntegrationGate(input: {
  readonly requirementsState: RequirementsStateJson | null | undefined;
  readonly sourceUnitCount: number;
  readonly projectId?: string | null;
  readonly integrationSteps?: readonly ImplementationIntegrationStepV1[];
}): FinalWiringReadyStateV1 {
  const steps =
    input.integrationSteps ??
    loadImplementationIntegrationStepsFromState(input.requirementsState ?? {});
  return resolveFinalWiringReadyState({
    integrationSteps: steps,
    promptTimeline: input.requirementsState?.promptTimeline ?? [],
    sourceUnitCount: input.sourceUnitCount,
    projectId: input.projectId,
  });
}

export function logFinalWiringReadyResolved(
  state: FinalWiringReadyStateV1,
  input?: Readonly<{ readonly projectId?: string | null }>,
): void {
  if (typeof console === "undefined" || !console.info) return;
  console.info(
    JSON.stringify({
      action: "implementation_integration_final_wiring_ready_resolved",
      projectId: input?.projectId ?? null,
      ready: state.ready,
      reason: state.reason,
      finalWiringStepId: state.finalWiringStepId,
      finalWiringWorkBranch: state.finalWiringWorkBranch,
      sourceUnitCount: state.sourceUnitCount,
      hasReadyEvent: state.hasReadyEvent,
      stepStatus: state.stepStatus,
    }),
  );
}

/** @deprecated Prefer resolveFinalWiringReadyForIntegrationGate().ready */
export function isFinalWiringStepReadyForIntegrationButton(
  status: string | null | undefined,
): boolean {
  const s = String(status ?? "").trim();
  return STEP_STATUS_READY_FOR_INTEGRATION_BUTTON.has(s);
}
