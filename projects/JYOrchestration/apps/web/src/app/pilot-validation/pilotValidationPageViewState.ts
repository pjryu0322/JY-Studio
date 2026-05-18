/**
 * Pilot Validation page view-state resolver (read-only UI; no execution).
 */

import type { PilotValidationUserSummaryVm } from "@/lib/overlay-ui/pilotValidationUserSummaryVm";

export type PilotValidationPageViewState =
  | "missing_project"
  | "loading"
  | "error"
  | "no_vm"
  | "ready";

export function resolvePilotValidationPageViewState(input: Readonly<{
  projectId: string;
  loading: boolean;
  error: string | null;
  vm: PilotValidationUserSummaryVm | null;
}>): PilotValidationPageViewState {
  if (!input.projectId.trim()) {
    return "missing_project";
  }
  if (input.loading) {
    return "loading";
  }
  if (input.error) {
    return "error";
  }
  if (!input.vm) {
    return "no_vm";
  }
  return "ready";
}

export function buildPilotValidationOverlayRuntimeDiagnosticUrl(projectId: string): string {
  const qs = new URLSearchParams({
    projectId: projectId.trim(),
    audienceMode: "user",
  });
  return `/api/diagnostics/overlay-runtime?${qs.toString()}`;
}
