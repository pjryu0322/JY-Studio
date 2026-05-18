/**
 * H17.5 — compressed 과정에서 **숨겨진 trace** 감사(read-only).
 */

import type { RuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import type { CompressedRuntimeReasoningTrace, RuntimeSemanticGroupsSummary } from "./runtimeSemanticTypes";
import type { RuntimeHiddenSemanticTraceAudit, RuntimeSemanticAuditFinding } from "./runtimeSemanticQualityTypes";
import {
  collectRawReasoningTraceItems,
  collectVisibleSemanticTraceItems,
  dedupeTraceKeys,
} from "./runtimeSemanticTraceCollect";

function classifyHiddenLine(text: string): {
  critical: boolean;
  dependency: boolean;
  propagation: boolean;
  governance: boolean;
  stale: boolean;
} {
  const lower = text.toLowerCase();
  return {
    critical: lower.includes("critical") || lower.includes("크리티컬") || lower.includes("transition"),
    dependency: lower.includes("depend") || lower.includes("의존"),
    propagation: lower.includes("propag") || lower.includes("전파") || lower.includes("impact"),
    governance: lower.includes("govern") || lower.includes("거버넌스"),
    stale: lower.includes("stale") || lower.includes("오래") || lower.includes("무효"),
  };
}

export function auditHiddenRuntimeSemanticTrace(input: {
  reasoningReports: RuntimeReasoningPlanningReports;
  compressedReasoningTrace: CompressedRuntimeReasoningTrace;
  semanticGroupsSummary: RuntimeSemanticGroupsSummary;
  stabilizedSemanticOrdering: { orderedCompressedLines: readonly string[] };
}): RuntimeHiddenSemanticTraceAudit {
  const raw = collectRawReasoningTraceItems(input.reasoningReports);
  const visible = collectVisibleSemanticTraceItems({
    compressedReasoningTrace: input.compressedReasoningTrace,
    semanticGroupsSummary: input.semanticGroupsSummary,
    stabilizedSemanticOrdering: input.stabilizedSemanticOrdering,
  });
  const visibleKeys = dedupeTraceKeys(visible);

  const hiddenItems: string[] = [];
  const seenRaw = new Set<string>();
  for (const item of raw) {
    const key = item.trim().toLowerCase();
    if (!key || seenRaw.has(key)) continue;
    seenRaw.add(key);
    if (!visibleKeys.has(key)) hiddenItems.push(item);
  }

  let hiddenCriticalTransitionCount = 0;
  let hiddenDependencyWarningCount = 0;
  let hiddenPropagationWarningCount = 0;
  let hiddenGovernanceWarningCount = 0;
  let hiddenStaleWarningCount = 0;

  for (const item of hiddenItems) {
    const c = classifyHiddenLine(item);
    if (c.critical) hiddenCriticalTransitionCount += 1;
    if (c.dependency) hiddenDependencyWarningCount += 1;
    if (c.propagation) hiddenPropagationWarningCount += 1;
    if (c.governance) hiddenGovernanceWarningCount += 1;
    if (c.stale) hiddenStaleWarningCount += 1;
  }

  const findings: RuntimeSemanticAuditFinding[] = [];
  const hiddenTraceCount = hiddenItems.length;

  if (hiddenTraceCount > 0) {
    findings.push({
      code: "hidden_trace_present",
      severity: hiddenCriticalTransitionCount > 0 ? "warning" : "info",
      messageKo: `압축 과정에서 ${hiddenTraceCount}건의 trace가 overlay에서 생략되었습니다.`,
    });
  }
  if (hiddenCriticalTransitionCount > 0) {
    findings.push({
      code: "hidden_critical_transition",
      severity: "warning",
      messageKo: "숨겨진 critical transition 후보가 있습니다 — 진단 API에서 확인하세요.",
    });
  }
  if (hiddenStaleWarningCount > 0) {
    findings.push({
      code: "hidden_stale_warning",
      severity: "info",
      messageKo: "숨겨진 stale·lifecycle 관련 reasoning이 있습니다.",
    });
  }

  const recommendations: string[] = [
    "Hidden trace audit은 planning observability 메타만 제공합니다. payload 변경 없음.",
    hiddenCriticalTransitionCount > 0
      ? "중요 신호 숨김이 0이 아니면 compression quality를 watch로 올려 검토하세요."
      : "mobile·compact UI에서 hidden trace는 quality summary로 충분합니다.",
  ];

  return {
    mode: "runtime_hidden_semantic_trace_audit",
    actualRuntimeOrchestrationEnabled: false,
    hiddenTraceCount,
    hiddenCriticalTransitionCount,
    hiddenDependencyWarningCount,
    hiddenPropagationWarningCount,
    hiddenGovernanceWarningCount,
    hiddenStaleWarningCount,
    findings: findings.slice(0, 8),
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeRuntimeHiddenSemanticTraceAuditForDiagnostic(
  audit: RuntimeHiddenSemanticTraceAudit
): Readonly<Record<string, unknown>> {
  return {
    mode: audit.mode,
    actualRuntimeOrchestrationEnabled: audit.actualRuntimeOrchestrationEnabled,
    hiddenTraceCount: audit.hiddenTraceCount,
    hiddenCriticalTransitionCount: audit.hiddenCriticalTransitionCount,
    hiddenDependencyWarningCount: audit.hiddenDependencyWarningCount,
    hiddenPropagationWarningCount: audit.hiddenPropagationWarningCount,
    hiddenGovernanceWarningCount: audit.hiddenGovernanceWarningCount,
    hiddenStaleWarningCount: audit.hiddenStaleWarningCount,
    findings: audit.findings.map((f) => ({ ...f })),
    recommendations: [...audit.recommendations],
  };
}
