/**
 * H22.5 — 허용·금지 **scope matrix**(read-only 메타; 재계산 없음).
 */

import type { RuntimeControlBoundaryLevel } from "./runtimeControlBoundaryTypes";

const BASE_ALLOWED: readonly string[] = [
  "read-only diagnostics",
  "planning metadata",
  "dry-run readiness metadata",
  "operator review recommendation metadata",
  "rollback readiness planning metadata",
];

const BASE_FORBIDDEN: readonly string[] = [
  "actual provider switching",
  "actual resource allocation",
  "actual prompt mutation",
  "actual queue control",
  "actual execution blocking",
  "actual trial execution",
  "actual token enforcement",
  "actual retrieval orchestration",
];

export function buildRuntimeControlScopeMatrix(boundaryLevel: RuntimeControlBoundaryLevel): Readonly<{
  allowedMetadataScopes: readonly string[];
  forbiddenControlScopes: readonly string[];
  notesKo: readonly string[];
}> {
  const notes: string[] = [];
  if (boundaryLevel === "read_only") {
    notes.push("read_only — allocation·trial candidate 메타 범위 밖으로 유지.");
  } else if (boundaryLevel === "planning_metadata") {
    notes.push("planning_metadata — execution candidate로 해석되지 않도록 DOM·문구를 planning_only로 유지.");
  } else if (boundaryLevel === "dry_run_metadata") {
    notes.push("dry_run_metadata — 실제 dry-run 실행·큐 제어 없음; readiness 메타만.");
  } else if (boundaryLevel === "execution_candidate_metadata") {
    notes.push("execution_candidate_metadata — H23 이전 후보 설명용; actual routing·blocking 없음.");
  } else {
    notes.push("actual_control_forbidden — operator review·rollback readiness 메타 선행.");
  }
  notes.sort((a, b) => a.localeCompare(b, "ko"));
  return {
    allowedMetadataScopes: [...BASE_ALLOWED].sort((a, b) => a.localeCompare(b, "ko")),
    forbiddenControlScopes: [...BASE_FORBIDDEN].sort((a, b) => a.localeCompare(b, "ko")),
    notesKo: notes,
  };
}
