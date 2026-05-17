/**
 * H39 / H39.5 — final release governance gate readiness·alignment 검증 공통 헬퍼(read-only).
 */

import {
  preflightChecklistHas,
  preflightChecklistHasLabel,
} from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightCheckHelpers";
import { FINAL_RELEASE_GOVERNANCE_GATE_WORDING_RISK_PHRASES } from "./runtimeFinalReleaseGovernanceGateConstants";
import type {
  RuntimeFinalReleaseGovernanceGateAlignmentStatus,
  RuntimeFinalReleaseGovernanceGateVerificationStatus,
} from "./runtimeFinalReleaseGovernanceGateTypes";

export const gateChecklistHas = preflightChecklistHas;
export const gateChecklistHasLabel = preflightChecklistHasLabel;

export function gateForbiddenIncludes(forbiddenGateOperations: readonly string[], fragment: string): boolean {
  return forbiddenGateOperations.some((op) => op.toLowerCase().includes(fragment.toLowerCase()));
}

export function buildFinalReleaseGovernanceGateViolationRows(
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

export function gateBlockersAligned(
  blockerReportBlockers: readonly string[],
  summaryBlockers: readonly string[]
): boolean {
  if (blockerReportBlockers.length === 0 && summaryBlockers.length === 0) {
    return true;
  }
  if (blockerReportBlockers.length > 0) {
    return blockerReportBlockers.every((b) => summaryBlockers.includes(b));
  }
  return true;
}

export function collectFinalReleaseGovernanceGateWordingBlob(parts: readonly string[]): string {
  return parts.join(" ").toLowerCase().replace(/\s+/g, "");
}

export function scanFinalReleaseGovernanceGateWordingRisks(blob: string): readonly string[] {
  const findings: string[] = [];
  for (const { phrase, label } of FINAL_RELEASE_GOVERNANCE_GATE_WORDING_RISK_PHRASES) {
    if (blob.includes(phrase)) {
      findings.push(`wording/flag risk: ${label}`);
    }
  }
  return findings;
}

export function resolveFinalReleaseGovernanceGateVerificationStatus(
  findings: readonly string[]
): RuntimeFinalReleaseGovernanceGateVerificationStatus {
  if (findings.length === 0) {
    return "verified_metadata";
  }
  if (
    findings.some(
      (f) =>
        f.includes("gateMode metadata_only") ||
        f.includes("actualExecutionForbidden must be true") ||
        f.includes("actualApprovalEnforcementForbidden must be true") ||
        f.includes("actualExecutionBlockingForbidden must be true") ||
        f.includes("actualMergeBlockingForbidden must be true") ||
        f.includes("requires no gate blockers")
    )
  ) {
    return "failed";
  }
  return "partial";
}

export function resolveFinalReleaseGovernanceGateAlignmentStatus(
  findings: readonly string[]
): RuntimeFinalReleaseGovernanceGateAlignmentStatus {
  if (findings.length === 0) {
    return "aligned_metadata";
  }
  if (
    findings.some(
      (f) =>
        f.includes("requires empty gate violations") ||
        f.includes("requires empty release-readiness violations") ||
        f.includes("must be true") ||
        f.includes("misaligned with final release governance gate summary")
    )
  ) {
    return "failed";
  }
  return "partial";
}
