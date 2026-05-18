/**
 * H22.5 — control boundary **위반 후보** 탐지(read-only; report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReportsBeforeControlBoundary } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type { RuntimeControlBoundaryViolationReport } from "./runtimeControlBoundaryTypes";

const ACTUAL_FLAG_KEYS = new Set([
  "actualRuntimeOrchestrationEnabled",
  "actualResourceAllocationEnabled",
  "actualTrialExecutionEnabled",
  "actualControlEnabled",
]);

const WORDING_CHECKS: readonly { re: RegExp; label: string }[] = [
  { re: /provider\s*switching/i, label: "provider switching 유사 표현" },
  { re: /프로바이더\s*전환/i, label: "프로바이더 전환 유사 표현" },
  { re: /execution\s*blocking/i, label: "execution blocking 유사 표현" },
  { re: /실행\s*차단/i, label: "실행 차단 유사 표현" },
  { re: /merge\s*blocking/i, label: "merge blocking 유사 표현" },
  { re: /머지\s*차단/i, label: "머지 차단 유사 표현" },
];

function walkActualTrueViolations(obj: unknown, path: string, out: string[]): void {
  if (obj === null || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => walkActualTrueViolations(v, `${path}[${i}]`, out));
    return;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const next = path ? `${path}.${k}` : k;
    if (ACTUAL_FLAG_KEYS.has(k) && v === true) {
      out.push(`${next}=true`);
    }
    if (typeof v === "object" && v !== null) walkActualTrueViolations(v, next, out);
  }
}

function collectStrings(obj: unknown, depth: number, out: string[]): void {
  if (depth <= 0 || obj === null) return;
  if (typeof obj === "string") {
    if (obj.trim()) out.push(obj);
    return;
  }
  if (typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const v of obj) collectStrings(v, depth - 1, out);
    return;
  }
  for (const v of Object.values(obj as Record<string, unknown>)) {
    collectStrings(v, depth - 1, out);
  }
}

export function detectRuntimeControlBoundaryViolations(
  reports: RuntimeSemanticPlanningReportsBeforeControlBoundary
): RuntimeControlBoundaryViolationReport {
  const actualFlagViolations: string[] = [];
  walkActualTrueViolations(reports, "reports", actualFlagViolations);
  actualFlagViolations.sort((a, b) => a.localeCompare(b, "ko"));

  const strings: string[] = [];
  collectStrings(reports, 12, strings);
  const wordingRiskFindings: string[] = [];
  for (const s of strings) {
    for (const { re, label } of WORDING_CHECKS) {
      if (re.test(s)) {
        wordingRiskFindings.push(`${label}: "${s.slice(0, 120)}${s.length > 120 ? "…" : ""}"`);
        break;
      }
    }
  }
  wordingRiskFindings.sort((a, b) => a.localeCompare(b, "ko"));

  return {
    mode: "runtime_control_boundary_violation_report",
    actualRuntimeOrchestrationEnabled: false,
    actualControlEnabled: false,
    actualFlagViolations,
    wordingRiskFindings,
  };
}
