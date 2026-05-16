/**
 * H20.5 — resource pressure·severity 정렬 단일 정의(analyze·UI가 동일 순서를 가정).
 */

import type { RuntimeResourcePressure, RuntimeResourceSeverity } from "./runtimeResourceTypes";

const SEVERITY_RANK: Record<RuntimeResourceSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical_candidate: 3,
};

export function compareRuntimeResourceSeverityDesc(
  a: RuntimeResourceSeverity,
  b: RuntimeResourceSeverity
): number {
  return SEVERITY_RANK[b] - SEVERITY_RANK[a];
}

export function compareRuntimeResourcePressureBySeverityDesc(
  a: RuntimeResourcePressure,
  b: RuntimeResourcePressure
): number {
  return compareRuntimeResourceSeverityDesc(a.severity, b.severity);
}
