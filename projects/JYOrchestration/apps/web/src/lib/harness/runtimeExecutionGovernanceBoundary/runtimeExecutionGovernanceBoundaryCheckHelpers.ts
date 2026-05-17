/**
 * H37.5 — governance boundary readiness·alignment 검증 공통 헬퍼(read-only).
 */

import {
  preflightChecklistHas,
  preflightChecklistHasLabel,
} from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightCheckHelpers";

export const governanceChecklistHas = preflightChecklistHas;
export const governanceChecklistHasLabel = preflightChecklistHasLabel;

export function governanceForbiddenIncludes(
  forbiddenGovernanceOperations: readonly string[],
  fragment: string
): boolean {
  return forbiddenGovernanceOperations.some((op) => op.toLowerCase().includes(fragment.toLowerCase()));
}

export function buildGovernanceBoundaryViolationRows(
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
