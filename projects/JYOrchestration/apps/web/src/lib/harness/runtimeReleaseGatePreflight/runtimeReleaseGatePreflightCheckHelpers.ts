/**
 * H35.5 — preflight readiness·alignment 검증 공통 헬퍼(read-only).
 */

import type { RuntimeReleaseGateExecutionReadinessBoundary } from "./runtimeReleaseGatePreflightTypes";

export function preflightEnvelopeIncludes(envelopeRows: readonly string[], fragment: string): boolean {
  return envelopeRows.some((row) => row.toLowerCase().includes(fragment.toLowerCase()));
}

export function preflightChecklistHas(checklist: readonly string[], label: string, ok: boolean): boolean {
  return checklist.some((row) => row === `${label}:${ok}`);
}

export function preflightChecklistHasLabel(checklist: readonly string[], label: string): boolean {
  return checklist.some((row) => row.startsWith(`${label}:`));
}

export function preflightBoundaryIncludesForbidden(
  boundary: RuntimeReleaseGateExecutionReadinessBoundary,
  fragment: string
): boolean {
  return boundary.forbiddenBoundaryOperations.some((op) => op.toLowerCase().includes(fragment.toLowerCase()));
}

export function sliceOverlayRows(rows: readonly string[], compactAndNarrowUi: boolean): readonly string[] {
  return compactAndNarrowUi ? rows.slice(0, 1) : [...rows];
}

export function buildPreflightBoundaryViolationRows(
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
    ];
  }
  return [
    ...boundaryViolation.actualFlagViolations,
    ...boundaryViolation.proofViolations,
    ...boundaryViolation.wordingRiskFindings,
  ];
}
