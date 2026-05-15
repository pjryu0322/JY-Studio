/**
 * H20.5 — AI member **workload**·saturation·imbalance 평가(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeResource } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeMemberWorkload, RuntimeMemberWorkloadEntry } from "./runtimeResourceTypes";

const MAX_MEMBERS = 6;

function workloadFromScore(score: number): RuntimeMemberWorkloadEntry["workloadLevel"] {
  if (score >= 4) return "saturated";
  if (score >= 2) return "elevated";
  if (score >= 1) return "balanced";
  return "idle";
}

export function evaluateRuntimeMemberWorkload(
  reports: RuntimeSemanticPlanningReportsBeforeResource
): RuntimeMemberWorkload {
  const groupCount = reports.semanticGroupsSummary.groups.length;
  const warningPerGroup =
    groupCount > 0
      ? Math.ceil(reports.semanticWarningOriginSummary.origins.length / groupCount)
      : 0;

  const members: RuntimeMemberWorkloadEntry[] = reports.semanticGroupsSummary.groups
    .slice(0, MAX_MEMBERS)
    .map((g, i) => {
      const score = g.compressedItems.length + (i === 0 ? warningPerGroup : 0);
      const workloadLevel = workloadFromScore(score);
      const saturationRisk: RuntimeMemberWorkloadEntry["saturationRisk"] =
        workloadLevel === "saturated" ? "high" : workloadLevel === "elevated" ? "medium" : "low";
      return {
        memberId: g.kind,
        labelKo: g.labelKo,
        workloadLevel,
        saturationRisk,
        noteKo: `compressed items=${g.compressedItems.length}`,
      };
    });

  if (members.length === 0) {
    members.push({
      memberId: "planning-default",
      labelKo: "Planning default member",
      workloadLevel: "balanced",
      saturationRisk: "low",
      noteKo: "semantic group 없음 — neutral workload",
    });
  }

  const saturated = members.filter((m) => m.workloadLevel === "saturated" || m.workloadLevel === "elevated");
  const primary = [...members].sort((a, b) => {
    const rank = { idle: 0, balanced: 1, elevated: 2, saturated: 3 };
    return rank[b.workloadLevel] - rank[a.workloadLevel];
  })[0];

  return {
    mode: "runtime_member_workload",
    actualRuntimeOrchestrationEnabled: false,
    members,
    imbalanceNoteKo:
      saturated.length >= 2
        ? "AI member workload imbalance — routing concentration 가능"
        : "member workload 분포는 관측 범위에서 균형",
    primaryOverloadKo: primary
      ? `${primary.labelKo}: ${primary.workloadLevel}`
      : "overload 관측 없음",
  };
}

export function serializeRuntimeMemberWorkloadForDiagnostic(
  workload: RuntimeMemberWorkload
): Readonly<Record<string, unknown>> {
  return {
    mode: workload.mode,
    actualRuntimeOrchestrationEnabled: workload.actualRuntimeOrchestrationEnabled,
    members: workload.members.map((m) => ({ ...m })),
    imbalanceNoteKo: workload.imbalanceNoteKo,
    primaryOverloadKo: workload.primaryOverloadKo,
  };
}
