import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type { ActiveKnowledgePackActivationStatus, ActiveKnowledgePackRef } from "@/lib/overlay/activeKnowledgePackRef";
import type { PromptAssemblyMetadataContract } from "@/lib/overlay/contextAssemblyContract";
import type { OverlayRuntimePolicyHintsWire } from "@/lib/overlay/overlayPolicy";
import { parseOverlayRuntimePolicyHintsWire } from "@/lib/overlay/overlayPolicy";
import type { OverlayPolicyWarning } from "@/lib/overlay/overlayPolicyWarning";
import { parseOverlayPolicyWarningsFromUnknown } from "@/lib/overlay/overlayPolicyWarning";
import type { OverlaySelectedContextRef } from "@/lib/overlay/overlayContextSelection";
import type { OverlayContextBudgetMetadata } from "@/lib/overlay/overlayContextBudget";
import type { OverlayConflictWarning } from "@/lib/overlay/overlayConflictDetection";
import type { OverlayOrchestrationDecisionTrace } from "@/lib/overlay/overlayOrchestrationDecisionTrace";
import type { OverlayAssemblyPlanItem } from "@/lib/overlay/overlayContextAssemblyPlan";
import type { OverlayPruningCandidate } from "@/lib/overlay/overlayContextPruning";
import type {
  HarnessPromptAssemblyPreview,
  HarnessPromptPreviewDiff,
} from "@/lib/harness/promptAssembly/harnessPromptAssemblyTypes";
import { coerceHarnessPromptAssemblyMetadata } from "@/lib/harness/promptAssembly/harnessPromptAssemblyCoerce";
import type { KnowledgeActivationPlan } from "@/lib/harness/knowledgeActivation/knowledgeActivationPolicyTypes";
import { coerceKnowledgeActivationMetadata } from "@/lib/harness/knowledgeActivation/knowledgeActivationCoerce";
import type { MemoryRuntimePlan } from "@/lib/harness/memoryRuntime/memoryRuntimeTypes";
import { coerceMemoryRuntimeMetadata } from "@/lib/harness/memoryRuntime/memoryRuntimeCoerce";
import type { ExecutionRoutingPlan } from "@/lib/harness/executionRouting/executionCapabilityTypes";
import type { ExecutionRoutingSafetyReport } from "@/lib/harness/executionRouting/executionRoutingSafetyTypes";
import { coerceExecutionRoutingMetadata } from "@/lib/harness/executionRouting/executionRoutingCoerce";
import { coerceOverlayPromptTracePreparationMetadata } from "@/lib/overlay/overlayPromptTracePreparationCoerce";

export type ExtractedOverlayPromptTraceMetadata = Readonly<{
  overlayIdentity?: RequirementsPromptTimelineEntry["overlayIdentity"];
  overlayContextAssembly?: PromptAssemblyMetadataContract;
  overlayKnowledgeActivationHints?: readonly ActiveKnowledgePackRef[];
  overlayPolicyHints?: OverlayRuntimePolicyHintsWire;
  overlayPolicyWarnings?: readonly OverlayPolicyWarning[];
  overlaySelectedContextRefs?: readonly OverlaySelectedContextRef[];
  overlayPrioritizedContextRefs?: readonly OverlaySelectedContextRef[];
  overlayContextBudget?: OverlayContextBudgetMetadata;
  overlayConflictWarnings?: readonly OverlayConflictWarning[];
  overlayOrchestrationDecisionTrace?: OverlayOrchestrationDecisionTrace;
  overlayContextAssemblyPlan?: readonly OverlayAssemblyPlanItem[];
  overlayPruningCandidates?: readonly OverlayPruningCandidate[];
  overlayPolicyDriftWarnings?: readonly OverlayPolicyWarning[];
  harnessPromptAssemblyPreview?: HarnessPromptAssemblyPreview;
  harnessPromptPreviewDiff?: HarnessPromptPreviewDiff;
  knowledgeActivationPlan?: KnowledgeActivationPlan;
  memoryRuntimePlan?: MemoryRuntimePlan;
  executionRoutingPlan?: ExecutionRoutingPlan;
  executionRoutingSafetyReport?: ExecutionRoutingSafetyReport;
}>;

/**
 * 저장된 `promptTrace` / 타임라인 행에서 Overlay 필드만 안전하게 꺼낸다(replay·진단).
 */
export function extractOverlayPromptTraceMetadata(
  entry: RequirementsPromptTimelineEntry | Record<string, unknown> | null | undefined
): ExtractedOverlayPromptTraceMetadata {
  if (!entry || typeof entry !== "object") return {};
  const e = entry as Record<string, unknown>;
  const out: {
    overlayIdentity?: RequirementsPromptTimelineEntry["overlayIdentity"];
    overlayContextAssembly?: PromptAssemblyMetadataContract;
    overlayKnowledgeActivationHints?: readonly ActiveKnowledgePackRef[];
    overlayPolicyHints?: OverlayRuntimePolicyHintsWire;
    overlayPolicyWarnings?: readonly OverlayPolicyWarning[];
    overlaySelectedContextRefs?: readonly OverlaySelectedContextRef[];
    overlayPrioritizedContextRefs?: readonly OverlaySelectedContextRef[];
    overlayContextBudget?: OverlayContextBudgetMetadata;
    overlayConflictWarnings?: readonly OverlayConflictWarning[];
    overlayOrchestrationDecisionTrace?: OverlayOrchestrationDecisionTrace;
    overlayContextAssemblyPlan?: readonly OverlayAssemblyPlanItem[];
    overlayPruningCandidates?: readonly OverlayPruningCandidate[];
    overlayPolicyDriftWarnings?: readonly OverlayPolicyWarning[];
    harnessPromptAssemblyPreview?: HarnessPromptAssemblyPreview;
    harnessPromptPreviewDiff?: HarnessPromptPreviewDiff;
    knowledgeActivationPlan?: KnowledgeActivationPlan;
    memoryRuntimePlan?: MemoryRuntimePlan;
    executionRoutingPlan?: ExecutionRoutingPlan;
    executionRoutingSafetyReport?: ExecutionRoutingSafetyReport;
  } = {};

  const oi = e.overlayIdentity;
  if (oi && typeof oi === "object") {
    const o = oi as Record<string, unknown>;
    const roleKey = String(o.roleKey ?? "").trim();
    const perspective = String(o.perspective ?? "").trim();
    const provider = String(o.provider ?? "").trim();
    const caps = Array.isArray(o.capabilities)
      ? o.capabilities.map((x) => String(x ?? "").trim()).filter(Boolean)
      : [];
    if (roleKey && perspective && provider) {
      out.overlayIdentity = { roleKey, perspective, provider, capabilities: caps };
    }
  }

  const oc = e.overlayContextAssembly;
  if (oc && typeof oc === "object") {
    out.overlayContextAssembly = oc as PromptAssemblyMetadataContract;
  }

  const hk = e.overlayKnowledgeActivationHints;
  if (Array.isArray(hk)) {
    const hints: ActiveKnowledgePackRef[] = [];
    for (const item of hk) {
      if (!item || typeof item !== "object") continue;
      const h = item as Record<string, unknown>;
      const knowledgePackId = String(h.knowledgePackId ?? "").trim();
      const activationReason = String(h.activationReason ?? "").trim();
      const status = String(h.status ?? "").trim();
      const priority = Number(h.priority);
      const targetRoles = Array.isArray(h.targetRoles)
        ? h.targetRoles.map((x) => String(x ?? "").trim()).filter(Boolean)
        : [];
      if (!knowledgePackId || !activationReason) continue;
      if (status !== "proposed" && status !== "selected" && status !== "merged" && status !== "skipped") continue;
      hints.push({
        knowledgePackId,
        targetRoles,
        activationReason,
        priority: Number.isFinite(priority) ? Math.max(0, Math.floor(priority)) : 0,
        status: status as ActiveKnowledgePackActivationStatus,
      });
    }
    if (hints.length) out.overlayKnowledgeActivationHints = hints;
  }

  const parsedPolicy = parseOverlayRuntimePolicyHintsWire(e.overlayPolicyHints);
  if (parsedPolicy) out.overlayPolicyHints = parsedPolicy;

  const parsedWarnings = parseOverlayPolicyWarningsFromUnknown(e.overlayPolicyWarnings);
  if (parsedWarnings.length) out.overlayPolicyWarnings = parsedWarnings;

  Object.assign(out, coerceOverlayPromptTracePreparationMetadata(e));
  Object.assign(out, coerceHarnessPromptAssemblyMetadata(e));
  Object.assign(out, coerceKnowledgeActivationMetadata(e));
  Object.assign(out, coerceMemoryRuntimeMetadata(e));
  Object.assign(out, coerceExecutionRoutingMetadata(e));

  return out as ExtractedOverlayPromptTraceMetadata;
}
