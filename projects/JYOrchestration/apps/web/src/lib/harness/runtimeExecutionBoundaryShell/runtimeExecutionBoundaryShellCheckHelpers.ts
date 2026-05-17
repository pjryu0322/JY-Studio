/**
 * H36.5 — execution boundary shell readiness·alignment 검증 공통 헬퍼(read-only).
 */

import {
  preflightChecklistHas,
  preflightChecklistHasLabel,
} from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightCheckHelpers";

export const shellChecklistHas = preflightChecklistHas;
export const shellChecklistHasLabel = preflightChecklistHasLabel;

export function shellForbiddenIncludes(forbiddenShellOperations: readonly string[], fragment: string): boolean {
  return forbiddenShellOperations.some((op) => op.toLowerCase().includes(fragment.toLowerCase()));
}

export function buildShellBoundaryViolationRows(
  boundaryViolation: Readonly<{
    readonly actualFlagViolations: readonly string[];
    readonly wordingRiskFindings: readonly string[];
  }>,
  compactAndNarrowUi: boolean
): readonly string[] {
  if (compactAndNarrowUi) {
    return [
      ...boundaryViolation.actualFlagViolations.slice(0, 1),
      ...boundaryViolation.wordingRiskFindings.slice(0, 1),
    ].filter(Boolean);
  }
  return [...boundaryViolation.actualFlagViolations, ...boundaryViolation.wordingRiskFindings];
}
