/**
 * H38.5 — governance release-readiness readiness·alignment 검증 공통 헬퍼(read-only).
 */

import {
  preflightChecklistHas,
  preflightChecklistHasLabel,
} from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightCheckHelpers";

export const releaseChecklistHas = preflightChecklistHas;
export const releaseChecklistHasLabel = preflightChecklistHasLabel;

export function releaseForbiddenIncludes(
  forbiddenBoundaryOperations: readonly string[],
  fragment: string
): boolean {
  return forbiddenBoundaryOperations.some((op) => op.toLowerCase().includes(fragment.toLowerCase()));
}

export function releaseEnvelopeIncludesRow(envelopeRows: readonly string[], fragment: string): boolean {
  return envelopeRows.some((row) => row.toLowerCase().includes(fragment.toLowerCase()));
}

export function buildGovernanceReleaseReadinessViolationRows(
  boundaryViolation: Readonly<{
    readonly actualFlagViolations: readonly string[];
    readonly proofViolations: readonly string[];
    readonly wordingRiskFindings: readonly string[];
  }>,
  compactAndNarrowUi: boolean
): readonly string[] {
  if (compactAndNarrowUi) {
    return [
      ...boundaryViolation.actualFlagViolations.slice(0, 1),
      ...boundaryViolation.proofViolations.slice(0, 1),
      ...boundaryViolation.wordingRiskFindings.slice(0, 1),
    ].filter(Boolean);
  }
  return [
    ...boundaryViolation.actualFlagViolations,
    ...boundaryViolation.proofViolations,
    ...boundaryViolation.wordingRiskFindings,
  ];
}
