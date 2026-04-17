import type { AppFlowGateSnapshot } from "@/lib/workflow/flow-gates";
import { stepReachableInStrip } from "@/lib/workflow/flow-gates";
import type { AppFlowStepId } from "@/lib/workflow/flow-state";

export function stripStepReachableForUi(
  stepId: AppFlowStepId,
  current: AppFlowStepId | null,
  gates: AppFlowGateSnapshot
): boolean {
  if (current && stepId === current) return true;
  return stepReachableInStrip(stepId, gates);
}

export function gateReasonForStep(stepId: AppFlowStepId, gates: AppFlowGateSnapshot): string | null {
  if (stepId === "collaboration") return gates.collaborationReason;
  if (stepId === "features") return gates.featuresReason;
  if (stepId === "tasks") return gates.tasksReason;
  if (stepId === "planning") return gates.planningReason;
  if (stepId === "execution") return gates.executionReason;
  if (stepId === "trace") return gates.traceReason;
  return null;
}
