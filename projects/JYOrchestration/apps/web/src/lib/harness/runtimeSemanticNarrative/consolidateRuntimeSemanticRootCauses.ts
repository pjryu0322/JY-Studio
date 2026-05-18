/**
 * H18.5 — 동일 root cause **warning·path collapse**(read-only).
 */

import type { RuntimeSemanticCorePlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeSemanticGraphPlanningReports } from "@/lib/harness/runtimeSemanticGraph/buildRuntimeSemanticGraphPlanningReports";
import { RUNTIME_SEMANTIC_ROOT_CAUSE_KIND_LABEL_KO } from "./runtimeSemanticNarrativeLabelsKo";
import type { RuntimeSemanticRootCauseGroup, RuntimeSemanticRootCauseKind } from "./runtimeSemanticNarrativeTypes";

const MAX_GROUPS = 5;

function kindForWarningCode(code: string): RuntimeSemanticRootCauseKind {
  if (code.includes("hidden") || code.includes("critical_origin")) return "hidden_trace";
  if (code.includes("group_imbalance")) return "group_imbalance";
  if (code.includes("explosion")) return "reasoning_explosion";
  if (code.includes("governance") || code.includes("gov")) return "governance_conflict";
  if (code.includes("dependency") || code.includes("conflict")) return "dependency_conflict";
  if (code.includes("propagation") || code.includes("escalation")) return "propagation_escalation";
  if (code.includes("quality") || code.includes("compress")) return "compression_quality";
  return "compression_quality";
}

export function consolidateRuntimeSemanticRootCauses(
  semanticReports: RuntimeSemanticCorePlanningReports,
  graphReports: RuntimeSemanticGraphPlanningReports
): readonly RuntimeSemanticRootCauseGroup[] {
  const bucket = new Map<
    RuntimeSemanticRootCauseKind,
    { warningCodes: Set<string>; chains: string[][] }
  >();

  const add = (kind: RuntimeSemanticRootCauseKind, code: string, chain: readonly string[]) => {
    const entry = bucket.get(kind) ?? { warningCodes: new Set<string>(), chains: [] };
    entry.warningCodes.add(code);
    const key = chain.join("|");
    if (!entry.chains.some((c) => c.join("|") === key)) {
      entry.chains.push([...chain]);
    }
    bucket.set(kind, entry);
  };

  for (const origin of graphReports.semanticWarningOriginSummary.origins) {
    add(kindForWarningCode(origin.warningCode), origin.warningCode, origin.originChain);
  }

  if (semanticReports.hiddenTraceAudit.hiddenCriticalTransitionCount > 0) {
    add("hidden_trace", "hidden_critical_transition", [
      "hidden critical transition",
      "compressed trace",
      "reasoning chain",
    ]);
  }

  if (semanticReports.hiddenTraceAudit.hiddenGovernanceWarningCount > 0) {
    add("governance_conflict", "hidden_governance_trace", [
      "hidden governance trace",
      "semantic compression",
      "propagation chain",
    ]);
  }

  if (semanticReports.compressionQualityReport.quality !== "safe") {
    add("compression_quality", `quality_${semanticReports.compressionQualityReport.quality}`, [
      "compression quality",
      "semantic compression",
      "planning trace",
    ]);
  }

  if (semanticReports.semanticGroupBalanceSummary.balanceLevel === "imbalanced") {
    add("group_imbalance", "group_imbalance", [
      `dominant group: ${semanticReports.semanticGroupBalanceSummary.dominantGroupKind}`,
      "semantic grouping",
    ]);
  }

  if (semanticReports.semanticRedundancySummary.reasoningExplosionRisk !== "low") {
    add("reasoning_explosion", "reasoning_explosion", [
      "reasoning explosion",
      "semantic compression",
      "overlay mapping",
    ]);
  }

  const depConflicts = semanticReports.compressionQualityReport.findings.some((f) =>
    f.code.includes("dependency")
  );
  if (depConflicts) {
    add("dependency_conflict", "dependency_conflict_signal", [
      "dependency conflict",
      "impact propagation",
      "semantic compression",
    ]);
  }

  if (bucket.size === 0) {
    return [
      {
        kind: "stable_planning",
        labelKo: RUNTIME_SEMANTIC_ROOT_CAUSE_KIND_LABEL_KO.stable_planning,
        warningCodes: [],
        collapsedWarningCount: 0,
        primaryChain: ["stable semantic path", "compression", "reasoning"],
      },
    ];
  }

  const groups: RuntimeSemanticRootCauseGroup[] = [];
  for (const [kind, data] of bucket) {
    const primaryChain = data.chains[0] ?? [];
    const collapsedWarningCount = Math.max(0, data.warningCodes.size - 1);
    groups.push({
      kind,
      labelKo: RUNTIME_SEMANTIC_ROOT_CAUSE_KIND_LABEL_KO[kind],
      warningCodes: [...data.warningCodes].slice(0, 6),
      collapsedWarningCount,
      primaryChain: primaryChain.slice(0, 5),
    });
  }

  return groups
    .sort((a, b) => b.collapsedWarningCount - a.collapsedWarningCount || b.warningCodes.length - a.warningCodes.length)
    .slice(0, MAX_GROUPS);
}

export function serializeRuntimeSemanticRootCauseGroupsForDiagnostic(
  groups: readonly RuntimeSemanticRootCauseGroup[]
): Readonly<Record<string, unknown>> {
  return {
    mode: "runtime_semantic_root_cause_groups",
    actualRuntimeOrchestrationEnabled: false,
    groups: groups.map((g) => ({
      kind: g.kind,
      labelKo: g.labelKo,
      warningCodes: [...g.warningCodes],
      collapsedWarningCount: g.collapsedWarningCount,
      primaryChain: [...g.primaryChain],
    })),
  };
}
