/**
 * Harness Phase H8 — Overlay 추출·누적 진단 입력으로 **maturity baseline**을 산출한다.
 *
 * 순수 함수 / read-only. enforcement·routing·payload 변경 없음.
 */

import type { HarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import type { RecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { evaluateExecutionRoutingSafety } from "@/lib/harness/executionRouting/evaluateExecutionRoutingSafety";
import { resolveHarnessExposureLevel } from "./harnessExposurePolicy";
import type {
  HarnessMaturityBaselineReport,
  HarnessMaturityFinding,
  HarnessMaturityLayer,
  HarnessMaturityLayerStatus,
  HarnessMaturityStatus,
} from "./harnessMaturityTypes";

const LAYER_ORDER: readonly HarnessMaturityLayer[] = [
  "prompt_assembly_preview",
  "apply_readiness",
  "knowledge_activation",
  "memory_runtime",
  "memory_stabilization",
  "execution_routing",
  "execution_safety",
  "review_security",
  "issue_planning",
  "message_explainability",
];

function statusRank(s: HarnessMaturityStatus): number {
  switch (s) {
    case "missing":
      return 0;
    case "partial":
      return 1;
    case "ready_read_only":
      return 2;
    case "ready_for_controlled_trial":
      return 3;
  }
}

function worstStatus(a: HarnessMaturityStatus, b: HarnessMaturityStatus): HarnessMaturityStatus {
  return statusRank(a) <= statusRank(b) ? a : b;
}

function isValidMemoryPlan(plan: ExtractedOverlayPromptTraceMetadata["memoryRuntimePlan"]): boolean {
  return Boolean(plan && plan.mode === "dry_run" && Array.isArray(plan.references));
}

function evaluatePromptAssemblyPreview(
  extract: ExtractedOverlayPromptTraceMetadata | null | undefined
): HarnessMaturityLayerStatus {
  const preview = extract?.harnessPromptAssemblyPreview;
  const diff = extract?.harnessPromptPreviewDiff;
  const missing: string[] = [];
  if (!preview) missing.push("harnessPromptAssemblyPreview");
  if (!diff) missing.push("harnessPromptPreviewDiff");
  let status: HarnessMaturityStatus;
  let evidence = 0;
  if (preview && diff) {
    status = "ready_read_only";
    evidence = 2;
  } else if (preview || diff) {
    status = "partial";
    evidence = preview && diff ? 2 : 1;
  } else {
    status = "missing";
    evidence = 0;
  }
  return {
    layer: "prompt_assembly_preview",
    status,
    exposureLevel: resolveHarnessExposureLevel("prompt_assembly_preview"),
    evidenceCount: evidence,
    missingSignals: missing,
    warnings: [],
  };
}

function evaluateApplyReadiness(
  report: HarnessPromptApplyReadinessReport | null | undefined
): HarnessMaturityLayerStatus {
  const missing: string[] = [];
  if (!report) {
    missing.push("harnessPromptApplyReadinessReport");
    return {
      layer: "apply_readiness",
      status: "missing",
      exposureLevel: resolveHarnessExposureLevel("apply_readiness"),
      evidenceCount: 0,
      missingSignals: missing,
      warnings: [],
    };
  }
  const hasSample = report.sampledEntryCount > 0;
  if (!hasSample) missing.push("sampled_timeline_entries");
  let status: HarnessMaturityStatus;
  if (!hasSample) status = "partial";
  else if (report.level === "ready_candidate" || report.level === "watch") status = "ready_read_only";
  else status = "partial";

  const warnings =
    report.findings?.filter((f) => f.severity === "warning").map((f) => f.message) ?? [];
  return {
    layer: "apply_readiness",
    status,
    exposureLevel: resolveHarnessExposureLevel("apply_readiness"),
    evidenceCount: hasSample ? 1 + (report.previewEntryCount > 0 ? 1 : 0) : 0,
    missingSignals: missing,
    warnings,
  };
}

function evaluateKnowledgeActivation(
  extract: ExtractedOverlayPromptTraceMetadata | null | undefined
): HarnessMaturityLayerStatus {
  const plan = extract?.knowledgeActivationPlan;
  const ok = Boolean(plan);
  return {
    layer: "knowledge_activation",
    status: ok ? "ready_read_only" : "missing",
    exposureLevel: resolveHarnessExposureLevel("knowledge_activation"),
    evidenceCount: ok ? 1 : 0,
    missingSignals: ok ? [] : ["knowledgeActivationPlan"],
    warnings: [],
  };
}

function evaluateMemoryRuntime(
  extract: ExtractedOverlayPromptTraceMetadata | null | undefined
): HarnessMaturityLayerStatus {
  const plan = extract?.memoryRuntimePlan;
  const ok = isValidMemoryPlan(plan);
  return {
    layer: "memory_runtime",
    status: ok ? "ready_read_only" : "missing",
    exposureLevel: resolveHarnessExposureLevel("memory_runtime"),
    evidenceCount: ok ? 1 : 0,
    missingSignals: ok ? [] : ["memoryRuntimePlan"],
    warnings: [],
  };
}

function evaluateMemoryStabilization(input: {
  extract: ExtractedOverlayPromptTraceMetadata | null | undefined;
  recentMemoryRuntimeSummary: RecentMemoryRuntimeSummary | null | undefined;
}): HarnessMaturityLayerStatus {
  const recent = input.recentMemoryRuntimeSummary;
  const hasRecent = Boolean(recent && recent.planEntryCount > 0);
  const hasRuntime = isValidMemoryPlan(input.extract?.memoryRuntimePlan);
  const missing: string[] = [];
  if (!hasRecent) missing.push("recent_memory_runtime_summary");
  let status: HarnessMaturityStatus;
  if (hasRecent) status = "ready_read_only";
  else if (hasRuntime) status = "partial";
  else status = "missing";
  return {
    layer: "memory_stabilization",
    status,
    exposureLevel: resolveHarnessExposureLevel("memory_stabilization"),
    evidenceCount: hasRecent ? 1 : hasRuntime ? 1 : 0,
    missingSignals: missing,
    warnings: [],
  };
}

function withDerivedExecutionSafety(
  extract: ExtractedOverlayPromptTraceMetadata | null | undefined
): ExtractedOverlayPromptTraceMetadata | null | undefined {
  if (!extract) return extract;
  if (extract.executionRoutingSafetyReport) return extract;
  if (!extract.executionRoutingPlan) return extract;
  return {
    ...extract,
    executionRoutingSafetyReport: evaluateExecutionRoutingSafety({ plan: extract.executionRoutingPlan }),
  };
}

function evaluateExecutionRouting(
  extract: ExtractedOverlayPromptTraceMetadata | null | undefined
): HarnessMaturityLayerStatus {
  const plan = extract?.executionRoutingPlan;
  const ok = Boolean(plan);
  return {
    layer: "execution_routing",
    status: ok ? "ready_read_only" : "missing",
    exposureLevel: resolveHarnessExposureLevel("execution_routing"),
    evidenceCount: ok ? 1 : 0,
    missingSignals: ok ? [] : ["executionRoutingPlan"],
    warnings: [],
  };
}

function evaluateExecutionSafety(
  extract: ExtractedOverlayPromptTraceMetadata | null | undefined
): HarnessMaturityLayerStatus {
  const merged = withDerivedExecutionSafety(extract);
  const report = merged?.executionRoutingSafetyReport;
  if (!report) {
    return {
      layer: "execution_safety",
      status: "missing",
      exposureLevel: resolveHarnessExposureLevel("execution_safety"),
      evidenceCount: 0,
      missingSignals: ["executionRoutingSafetyReport"],
      warnings: [],
    };
  }
  const flagsOk =
    report.providerSwitchingEnabled === false &&
    report.executionBlockingEnabled === false &&
    report.automaticExecutionEnabled === false;
  const missing: string[] = [];
  if (!flagsOk) {
    if (report.providerSwitchingEnabled !== false) missing.push("providerSwitchingEnabled_must_be_false");
    if (report.executionBlockingEnabled !== false) missing.push("executionBlockingEnabled_must_be_false");
    if (report.automaticExecutionEnabled !== false) missing.push("automaticExecutionEnabled_must_be_false");
  }
  const status: HarnessMaturityStatus = flagsOk ? "ready_read_only" : "partial";
  return {
    layer: "execution_safety",
    status,
    exposureLevel: resolveHarnessExposureLevel("execution_safety"),
    evidenceCount: flagsOk ? 4 : 0,
    missingSignals: missing,
    warnings: [],
  };
}

function evaluateReviewSecurity(
  extract: ExtractedOverlayPromptTraceMetadata | null | undefined
): HarnessMaturityLayerStatus {
  const plan = extract?.reviewSecurityHarnessPlan;
  const ok = Boolean(plan);
  return {
    layer: "review_security",
    status: ok ? "ready_read_only" : "missing",
    exposureLevel: resolveHarnessExposureLevel("review_security"),
    evidenceCount: ok ? 1 : 0,
    missingSignals: ok ? [] : ["reviewSecurityHarnessPlan"],
    warnings: [],
  };
}

function evaluateIssuePlanning(
  extract: ExtractedOverlayPromptTraceMetadata | null | undefined
): HarnessMaturityLayerStatus {
  const issue = extract?.reviewSecurityIssuePlanningReport;
  const rem = extract?.remediationLoopPlan;
  const missing: string[] = [];
  if (!issue) missing.push("reviewSecurityIssuePlanningReport");
  if (!rem) missing.push("remediationLoopPlan");
  let status: HarnessMaturityStatus;
  if (issue && rem) status = "ready_read_only";
  else if (issue || rem) status = "partial";
  else status = "missing";
  return {
    layer: "issue_planning",
    status,
    exposureLevel: resolveHarnessExposureLevel("issue_planning"),
    evidenceCount: (issue ? 1 : 0) + (rem ? 1 : 0),
    missingSignals: missing,
    warnings: [],
  };
}

function evaluateMessageExplainability(messageExplainabilityAvailable: boolean | undefined): HarnessMaturityLayerStatus {
  const ok = messageExplainabilityAvailable === true;
  return {
    layer: "message_explainability",
    status: ok ? "ready_read_only" : "missing",
    exposureLevel: resolveHarnessExposureLevel("message_explainability"),
    evidenceCount: ok ? 2 : 0,
    missingSignals: ok ? [] : ["MessageExplainabilityPanel_wiring"],
    warnings: [],
  };
}

export function evaluateHarnessMaturityBaseline(input: {
  overlayExtract?: ExtractedOverlayPromptTraceMetadata | null;
  /** H2 누적 진단. 없으면 apply_readiness는 partial/missing 쪽으로만 평가된다. */
  harnessPromptApplyReadinessReport?: HarnessPromptApplyReadinessReport | null;
  /** H4.5 누적 요약. 없으면 memory_stabilization은 단일 턴 plan만으로 partial까지. */
  recentMemoryRuntimeSummary?: RecentMemoryRuntimeSummary | null;
  /** 앱에 SingleChat explainability UI가 배포·연결되어 있는지(정적 가드). */
  messageExplainabilityAvailable?: boolean;
}): HarnessMaturityBaselineReport {
  const extract = withDerivedExecutionSafety(input.overlayExtract ?? null) ?? null;
  const layers: HarnessMaturityLayerStatus[] = [
    evaluatePromptAssemblyPreview(extract),
    evaluateApplyReadiness(input.harnessPromptApplyReadinessReport ?? null),
    evaluateKnowledgeActivation(extract),
    evaluateMemoryRuntime(extract),
    evaluateMemoryStabilization({
      extract,
      recentMemoryRuntimeSummary: input.recentMemoryRuntimeSummary ?? null,
    }),
    evaluateExecutionRouting(extract),
    evaluateExecutionSafety(extract),
    evaluateReviewSecurity(extract),
    evaluateIssuePlanning(extract),
    evaluateMessageExplainability(input.messageExplainabilityAvailable),
  ];

  const byLayer = new Map(layers.map((l) => [l.layer, l] as const));
  const ordered = LAYER_ORDER.map((layer) => byLayer.get(layer)!);

  let overallStatus: HarnessMaturityStatus = "ready_read_only";
  for (const l of ordered) {
    overallStatus = worstStatus(overallStatus, l.status);
  }

  const readyReadOnlyCount = ordered.filter((l) => l.status === "ready_read_only").length;
  const partialCount = ordered.filter((l) => l.status === "partial").length;
  const missingCount = ordered.filter((l) => l.status === "missing").length;

  const userVisibleSummaryReady = input.messageExplainabilityAvailable === true;

  const controlledTrialReady =
    missingCount === 0 &&
    partialCount === 0 &&
    readyReadOnlyCount === ordered.length &&
    userVisibleSummaryReady;

  const findings: HarnessMaturityFinding[] = [];
  for (const l of ordered) {
    for (const w of l.warnings) {
      findings.push({
        code: `layer_warning:${l.layer}`,
        severity: "warning",
        message: w,
      });
    }
    if (l.status === "partial" && l.missingSignals.length) {
      findings.push({
        code: `layer_partial:${l.layer}`,
        severity: "info",
        message: `${l.layer}: ${l.missingSignals.join(", ")}`,
      });
    }
  }

  return {
    mode: "read_only_maturity_baseline",
    overallStatus,
    layers: ordered,
    readyReadOnlyCount,
    partialCount,
    missingCount,
    userVisibleSummaryReady,
    controlledTrialReady,
    findings,
  };
}
