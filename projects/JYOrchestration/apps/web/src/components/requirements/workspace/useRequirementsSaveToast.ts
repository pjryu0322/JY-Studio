"use client";

import { type SaveFlowState, useSavePulseToast } from "@/components/workspace/useSavePulseToast";

export type RequirementsSaveState = SaveFlowState;

export function useRequirementsSaveToast(saveState: RequirementsSaveState) {
  return useSavePulseToast(saveState, 2000);
}
