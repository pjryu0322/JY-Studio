/**
 * H20.5 — AI member **workload**·saturation·imbalance 평가(read-only).
 * Semantic group kind → planner/architect/developer/reviewer/security 역할로 **결정적** 매핑(실행량·세션 제어 없음).
 */

import type { RuntimeSemanticPlanningReportsBeforeResource } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeSemanticGroupKind } from "@/lib/harness/runtimeSemantic/runtimeSemanticTypes";
import type { RuntimeMemberWorkload, RuntimeMemberWorkloadEntry } from "./runtimeResourceTypes";

const ROLE_IDS = ["planner", "architect", "developer", "reviewer", "security"] as const;
type RoleId = (typeof ROLE_IDS)[number];

const SEMANTIC_KIND_TO_ROLE: Record<RuntimeSemanticGroupKind, RoleId> = {
  lifecycle: "planner",
  coherence: "planner",
  dependency: "architect",
  propagation: "developer",
  other: "developer",
  criticality: "reviewer",
  governance: "security",
};

const ROLE_LABEL_KO: Record<RoleId, string> = {
  planner: "Planner (AI 멤버)",
  architect: "Architect (AI 멤버)",
  developer: "Developer (AI 멤버)",
  reviewer: "Reviewer (AI 멤버)",
  security: "Security (AI 멤버)",
};

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
  const warningShare =
    groupCount > 0 ? Math.ceil(reports.semanticWarningOriginSummary.origins.length / groupCount) : 0;

  const scoreByRole = new Map<RoleId, number>();
  for (const role of ROLE_IDS) scoreByRole.set(role, 0);

  for (const g of reports.semanticGroupsSummary.groups) {
    const role = SEMANTIC_KIND_TO_ROLE[g.kind];
    scoreByRole.set(role, (scoreByRole.get(role) ?? 0) + g.compressedItems.length);
  }

  const members: RuntimeMemberWorkloadEntry[] = ROLE_IDS.map((roleId, index) => {
    let score = scoreByRole.get(roleId) ?? 0;
    if (index === 0) score += warningShare;
    const workloadLevel = workloadFromScore(score);
    const saturationRisk: RuntimeMemberWorkloadEntry["saturationRisk"] =
      workloadLevel === "saturated" ? "high" : workloadLevel === "elevated" ? "medium" : "low";
    return {
      memberId: roleId,
      labelKo: ROLE_LABEL_KO[roleId],
      workloadLevel,
      saturationRisk,
      noteKo: `planning score=${score} (semantic compression proxy)`,
    };
  });

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
