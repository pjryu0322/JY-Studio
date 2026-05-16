/**
 * H20.5 검증 — resource 진단 묶음 **직렬화 전용**(report 재빌드 없음; `buildRuntimeResourcePlanningReports` 결과만 입력).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { serializeRuntimeResourceExplainabilityForDiagnostic } from "./buildRuntimeResourceExplainability";
import { serializeRuntimeResourceSummaryForDiagnostic } from "./buildRuntimeResourceSummary";
import { serializeRuntimeMemberWorkloadForDiagnostic } from "./evaluateRuntimeMemberWorkload";
import {
  serializeRuntimeResourceCapacityForDiagnostic,
  serializeRuntimeResourceForecastForDiagnostic,
} from "./forecastRuntimeResourceCapacity";

export function serializeRuntimeResourceDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<Record<string, unknown>> {
  return {
    runtimeResourceSummary: serializeRuntimeResourceSummaryForDiagnostic(reports.runtimeResourceSummary),
    runtimeResourceForecast: serializeRuntimeResourceForecastForDiagnostic(reports.runtimeResourceForecast),
    runtimeResourceCapacity: serializeRuntimeResourceCapacityForDiagnostic(reports.runtimeResourceCapacity),
    runtimeMemberWorkload: serializeRuntimeMemberWorkloadForDiagnostic(reports.runtimeMemberWorkload),
    runtimeResourceExplainability: serializeRuntimeResourceExplainabilityForDiagnostic(
      reports.runtimeResourceExplainability
    ),
  };
}
