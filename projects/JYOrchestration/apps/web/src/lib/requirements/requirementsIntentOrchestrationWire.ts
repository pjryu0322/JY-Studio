/**
 * Intent orchestration wire — clarification, focus, routing memory (persisted in state JSON).
 */

import { isQuickActionId, type QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";
import type { IntentRouterMode } from "@/lib/requirements/requirementsIntentRouterTypes";
import type { OrchestrationReplaySnapshot } from "@/lib/requirements/requirementsOrchestrationReplay";
import type { OrchestrationRuntimeMetrics } from "@/lib/requirements/requirementsOrchestrationInstrumentation";
import type { FocusSource } from "@/lib/requirements/requirementsFocusPriority";
import type { RecommendationDisposition } from "@/lib/requirements/requirementsRecommendationGovernance";
import type { RecommendationStatus } from "@/lib/requirements/requirementsRecommendationLifecycle";
import type { GovernedReplaySnapshot } from "@/lib/requirements/requirementsOrchestrationReplayGovernance";
import type { ArtifactDependencyEdge } from "@/lib/requirements/requirementsArtifactDependencyGraph";
import type { OrchestrationTransactionTrace } from "@/lib/requirements/requirementsOrchestrationTransaction";

export type ConversationFocusType = "feature" | "step" | "actor" | "screen" | "api" | "flow" | "none";

export type ConversationFocusWire = Readonly<{
  readonly type: ConversationFocusType;
  readonly id: string;
  readonly label?: string;
  readonly confidence?: number;
  readonly lastReferencedAt?: string;
  readonly referenceCount?: number;
  readonly softStale?: boolean;
  readonly focusSetAtStage?: string;
  readonly focusSource?: FocusSource;
  readonly focusPriority?: number;
}>;

export type IntentClarificationTopic =
  | "feature_target"
  | "target_resolution"
  | "action_choice"
  | "stage_next"
  | "general";

export type IntentClarificationWire = Readonly<{
  readonly pending: boolean;
  readonly topic?: IntentClarificationTopic;
  readonly question?: string;
  readonly candidateActionIds?: readonly QuickActionId[];
  readonly askedAt?: string;
  readonly createdAt?: string;
  readonly expiresAt?: string;
  readonly retryCount?: number;
  readonly unrelatedMessageCount?: number;
  readonly abandoned?: boolean;
  readonly abandonedAt?: string;
  readonly abandonedReason?: string;
}>;

export type IntentRoutingMemoryWire = Readonly<{
  readonly routerMode?: IntentRouterMode;
  readonly routingReason?: string;
  readonly guardReason?: string;
  readonly fallbackReason?: string;
  readonly focusReason?: string;
  readonly confidenceFactors?: readonly string[];
  readonly at?: string;
  readonly actorId?: string;
  readonly agentRole?: string;
  readonly decisionSource?: string;
}>;

export type OrchestrationRecommendationWire = Readonly<{
  readonly actionId: QuickActionId;
  readonly score: number;
  readonly reason: string;
  readonly blocking: boolean;
  readonly generatedAt: string;
  readonly targetKey?: string;
  readonly disposition?: RecommendationDisposition;
  readonly cooldownUntil?: string;
  readonly dismissed?: boolean;
  readonly accepted?: boolean;
  readonly rejected?: boolean;
  readonly status?: "pending" | "accepted" | "dismissed" | "expired" | "obsolete";
}>;

export type ArtifactLifecycleEntryWire = Readonly<{
  readonly artifactKey: string;
  readonly generated: boolean;
  readonly stale: boolean;
  readonly sourceStage: string;
  readonly sourceHash: string;
  readonly artifactVersionId?: string;
  readonly parentArtifactVersionId?: string;
  readonly generatedFromStateHash?: string;
  readonly generatedFromStage?: string;
  readonly lineageLabel?: string;
  readonly generatedAt?: string;
  readonly updatedAt?: string;
  readonly staleReason?: string;
}>;

export type RequirementsIntentOrchestrationV1 = Readonly<{
  readonly version: 1;
  readonly updatedAt: string;
  readonly orchestrationSessionId?: string;
  readonly lastRecoveredAt?: string;
  readonly turnCount?: number;
  readonly lastFocusReferencedTurn?: number;
  readonly alternateFocusHits?: number;
  readonly activeFocus?: ConversationFocusWire;
  readonly archivedFocuses?: readonly ConversationFocusWire[];
  readonly currentEditingTarget?: Readonly<{
    readonly featureId?: string;
    readonly stepId?: string;
    readonly actorId?: string;
  }>;
  readonly lastSuggestedActionId?: QuickActionId | null;
  readonly lastConfirmedActionId?: QuickActionId | null;
  readonly clarification?: IntentClarificationWire;
  readonly recentConversationSummary?: string;
  readonly lastRouting?: IntentRoutingMemoryWire;
  readonly recommendationQueue?: readonly OrchestrationRecommendationWire[];
  readonly artifactLifecycle?: readonly ArtifactLifecycleEntryWire[];
  readonly recentTransitions?: readonly string[];
  readonly lastReplaySnapshot?: OrchestrationReplaySnapshot;
  readonly replayHistory?: readonly GovernedReplaySnapshot[];
  readonly lastRuntimeMetrics?: OrchestrationRuntimeMetrics;
  readonly lastGovernedStage?: string;
  readonly artifactDependencies?: readonly ArtifactDependencyEdge[];
  readonly humanReadableDebugSummary?: string;
  readonly lastTransaction?: OrchestrationTransactionTrace;
}>;

const FOCUS_TYPES = new Set<ConversationFocusType>([
  "feature",
  "step",
  "actor",
  "screen",
  "api",
  "flow",
  "none",
]);

function parseFocus(raw: unknown): ConversationFocusWire | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const f = raw as Record<string, unknown>;
  const type = String(f.type ?? "").trim() as ConversationFocusType;
  const id = String(f.id ?? "").trim();
  if (!FOCUS_TYPES.has(type) || !id) return undefined;
  return {
    type,
    id,
    ...(typeof f.label === "string" && f.label.trim() ? { label: f.label.trim().slice(0, 120) } : {}),
    ...(typeof f.confidence === "number" && Number.isFinite(f.confidence)
      ? { confidence: Math.max(0, Math.min(1, f.confidence)) }
      : {}),
    ...(typeof f.lastReferencedAt === "string" ? { lastReferencedAt: f.lastReferencedAt } : {}),
    ...(typeof f.referenceCount === "number" ? { referenceCount: Math.max(0, Math.floor(f.referenceCount)) } : {}),
    ...(f.softStale === true ? { softStale: true } : {}),
    ...(typeof f.focusSetAtStage === "string" ? { focusSetAtStage: f.focusSetAtStage.trim().slice(0, 40) } : {}),
    ...(typeof f.focusSource === "string" ? { focusSource: f.focusSource as FocusSource } : {}),
    ...(typeof f.focusPriority === "number" ? { focusPriority: Math.floor(f.focusPriority) } : {}),
  };
}

function parseClarification(raw: unknown): IntentClarificationWire | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Record<string, unknown>;
  const pending = c.pending === true;
  const candidateActionIds = Array.isArray(c.candidateActionIds)
    ? c.candidateActionIds
        .map((x) => String(x ?? "").trim())
        .filter((id): id is QuickActionId => isQuickActionId(id))
        .slice(0, 8)
    : undefined;
  return {
    pending,
    ...(typeof c.topic === "string" ? { topic: c.topic.trim() as IntentClarificationTopic } : {}),
    ...(typeof c.question === "string" ? { question: c.question.trim().slice(0, 500) } : {}),
    ...(candidateActionIds?.length ? { candidateActionIds } : {}),
    ...(typeof c.askedAt === "string" ? { askedAt: c.askedAt } : {}),
    ...(typeof c.createdAt === "string" ? { createdAt: c.createdAt } : {}),
    ...(typeof c.expiresAt === "string" ? { expiresAt: c.expiresAt } : {}),
    ...(typeof c.retryCount === "number" ? { retryCount: Math.max(0, Math.floor(c.retryCount)) } : {}),
    ...(typeof c.unrelatedMessageCount === "number"
      ? { unrelatedMessageCount: Math.max(0, Math.floor(c.unrelatedMessageCount)) }
      : {}),
    ...(c.abandoned === true ? { abandoned: true } : {}),
    ...(typeof c.abandonedAt === "string" ? { abandonedAt: c.abandonedAt } : {}),
    ...(typeof c.abandonedReason === "string" ? { abandonedReason: c.abandonedReason.slice(0, 80) } : {}),
  };
}

function parseRecommendationQueue(raw: unknown): OrchestrationRecommendationWire[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: OrchestrationRecommendationWire[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const actionId = String(r.actionId ?? "").trim();
    if (!isQuickActionId(actionId)) continue;
    const score = Number(r.score);
    if (!Number.isFinite(score)) continue;
    const reason = String(r.reason ?? "").trim();
    if (!reason) continue;
    out.push({
      actionId,
      score,
      reason: reason.slice(0, 500),
      blocking: r.blocking === true,
      generatedAt: String(r.generatedAt ?? new Date().toISOString()),
      ...(typeof r.targetKey === "string" ? { targetKey: r.targetKey.slice(0, 80) } : {}),
      ...(typeof r.disposition === "string" ? { disposition: r.disposition as RecommendationDisposition } : {}),
      ...(typeof r.status === "string" ? { status: r.status as RecommendationStatus } : {}),
      ...(typeof r.cooldownUntil === "string" ? { cooldownUntil: r.cooldownUntil } : {}),
      ...(r.dismissed === true ? { dismissed: true } : {}),
      ...(r.accepted === true ? { accepted: true } : {}),
      ...(r.rejected === true ? { rejected: true } : {}),
    });
  }
  return out.length ? out.slice(0, 16) : undefined;
}

function parseArtifactLifecycle(raw: unknown): ArtifactLifecycleEntryWire[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ArtifactLifecycleEntryWire[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const artifactKey = String(r.artifactKey ?? "").trim();
    const sourceHash = String(r.sourceHash ?? "").trim();
    if (!artifactKey || !sourceHash) continue;
    out.push({
      artifactKey,
      generated: r.generated === true,
      stale: r.stale === true,
      sourceStage: String(r.sourceStage ?? "").slice(0, 40),
      sourceHash: sourceHash.slice(0, 240),
      ...(typeof r.generatedAt === "string" ? { generatedAt: r.generatedAt } : {}),
      ...(typeof r.updatedAt === "string" ? { updatedAt: r.updatedAt } : {}),
      ...(typeof r.staleReason === "string" ? { staleReason: r.staleReason.slice(0, 80) } : {}),
    });
  }
  return out.length ? out : undefined;
}

export function parseRequirementsIntentOrchestrationV1(raw: unknown): RequirementsIntentOrchestrationV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (Number(o.version) !== 1) return null;
  const updatedAt = String(o.updatedAt ?? "").trim();
  if (!updatedAt) return null;

  const activeFocus = parseFocus(o.activeFocus);
  const clarification = parseClarification(o.clarification);
  const archivedFocuses = Array.isArray(o.archivedFocuses)
    ? o.archivedFocuses.map(parseFocus).filter((x): x is ConversationFocusWire => Boolean(x)).slice(0, 8)
    : undefined;

  const lastSuggested = o.lastSuggestedActionId;
  const lastConfirmed = o.lastConfirmedActionId;

  return {
    version: 1,
    updatedAt,
    ...(typeof o.orchestrationSessionId === "string"
      ? { orchestrationSessionId: o.orchestrationSessionId.trim().slice(0, 80) }
      : {}),
    ...(typeof o.lastRecoveredAt === "string" ? { lastRecoveredAt: o.lastRecoveredAt } : {}),
    ...(typeof o.turnCount === "number" ? { turnCount: Math.max(0, Math.floor(o.turnCount)) } : {}),
    ...(typeof o.lastFocusReferencedTurn === "number"
      ? { lastFocusReferencedTurn: Math.max(0, Math.floor(o.lastFocusReferencedTurn)) }
      : {}),
    ...(typeof o.alternateFocusHits === "number"
      ? { alternateFocusHits: Math.max(0, Math.floor(o.alternateFocusHits)) }
      : {}),
    ...(activeFocus ? { activeFocus } : {}),
    ...(archivedFocuses?.length ? { archivedFocuses } : {}),
    ...(o.currentEditingTarget && typeof o.currentEditingTarget === "object"
      ? {
          currentEditingTarget: {
            ...(typeof (o.currentEditingTarget as Record<string, unknown>).featureId === "string"
              ? { featureId: String((o.currentEditingTarget as Record<string, unknown>).featureId).trim() }
              : {}),
            ...(typeof (o.currentEditingTarget as Record<string, unknown>).stepId === "string"
              ? { stepId: String((o.currentEditingTarget as Record<string, unknown>).stepId).trim() }
              : {}),
            ...(typeof (o.currentEditingTarget as Record<string, unknown>).actorId === "string"
              ? { actorId: String((o.currentEditingTarget as Record<string, unknown>).actorId).trim() }
              : {}),
          },
        }
      : {}),
    ...(lastSuggested === null ||
    (typeof lastSuggested === "string" && isQuickActionId(lastSuggested))
      ? {
          lastSuggestedActionId:
            lastSuggested === null ? null : (lastSuggested as QuickActionId),
        }
      : {}),
    ...(lastConfirmed === null ||
    (typeof lastConfirmed === "string" && isQuickActionId(lastConfirmed))
      ? {
          lastConfirmedActionId:
            lastConfirmed === null ? null : (lastConfirmed as QuickActionId),
        }
      : {}),
    ...(clarification ? { clarification } : {}),
    ...(typeof o.recentConversationSummary === "string"
      ? { recentConversationSummary: o.recentConversationSummary.trim().slice(0, 2000) }
      : {}),
    ...(o.lastRouting && typeof o.lastRouting === "object" ? { lastRouting: o.lastRouting as IntentRoutingMemoryWire } : {}),
    ...(parseRecommendationQueue(o.recommendationQueue)
      ? { recommendationQueue: parseRecommendationQueue(o.recommendationQueue) }
      : {}),
    ...(parseArtifactLifecycle(o.artifactLifecycle)
      ? { artifactLifecycle: parseArtifactLifecycle(o.artifactLifecycle) }
      : {}),
    ...(Array.isArray(o.recentTransitions)
      ? {
          recentTransitions: o.recentTransitions
            .map((t) => String(t ?? "").trim())
            .filter(Boolean)
            .slice(0, 24),
        }
      : {}),
    ...(o.lastReplaySnapshot && typeof o.lastReplaySnapshot === "object"
      ? { lastReplaySnapshot: o.lastReplaySnapshot as OrchestrationReplaySnapshot }
      : {}),
    ...(o.lastRuntimeMetrics && typeof o.lastRuntimeMetrics === "object"
      ? { lastRuntimeMetrics: o.lastRuntimeMetrics as OrchestrationRuntimeMetrics }
      : {}),
    ...(Array.isArray(o.replayHistory)
      ? { replayHistory: o.replayHistory.slice(-50) as GovernedReplaySnapshot[] }
      : {}),
    ...(typeof o.lastGovernedStage === "string" ? { lastGovernedStage: o.lastGovernedStage.slice(0, 40) } : {}),
    ...(Array.isArray(o.artifactDependencies)
      ? { artifactDependencies: o.artifactDependencies.slice(0, 24) as ArtifactDependencyEdge[] }
      : {}),
    ...(typeof o.humanReadableDebugSummary === "string"
      ? { humanReadableDebugSummary: o.humanReadableDebugSummary.slice(0, 1200) }
      : {}),
    ...(o.lastTransaction && typeof o.lastTransaction === "object"
      ? { lastTransaction: o.lastTransaction as OrchestrationTransactionTrace }
      : {}),
  };
}

export function mergeIntentOrchestrationPatch(
  prev: RequirementsIntentOrchestrationV1 | null | undefined,
  patch: Partial<RequirementsIntentOrchestrationV1>,
  nowIso?: string,
): RequirementsIntentOrchestrationV1 {
  const now = nowIso ?? new Date().toISOString();
  const base = prev ?? { version: 1 as const, updatedAt: now };
  return {
    ...base,
    ...patch,
    version: 1,
    updatedAt: now,
    ...(patch.clarification !== undefined ? { clarification: patch.clarification } : {}),
    ...(patch.activeFocus !== undefined ? { activeFocus: patch.activeFocus } : {}),
    ...(patch.archivedFocuses !== undefined ? { archivedFocuses: patch.archivedFocuses } : {}),
    ...(patch.lastRouting !== undefined ? { lastRouting: patch.lastRouting } : {}),
    ...(patch.recommendationQueue !== undefined ? { recommendationQueue: patch.recommendationQueue } : {}),
    ...(patch.artifactLifecycle !== undefined ? { artifactLifecycle: patch.artifactLifecycle } : {}),
    ...(patch.recentTransitions !== undefined ? { recentTransitions: patch.recentTransitions } : {}),
    ...(patch.lastReplaySnapshot !== undefined ? { lastReplaySnapshot: patch.lastReplaySnapshot } : {}),
    ...(patch.lastRuntimeMetrics !== undefined ? { lastRuntimeMetrics: patch.lastRuntimeMetrics } : {}),
    ...(patch.replayHistory !== undefined ? { replayHistory: patch.replayHistory } : {}),
    ...(patch.lastGovernedStage !== undefined ? { lastGovernedStage: patch.lastGovernedStage } : {}),
    ...(patch.artifactDependencies !== undefined ? { artifactDependencies: patch.artifactDependencies } : {}),
    ...(patch.humanReadableDebugSummary !== undefined
      ? { humanReadableDebugSummary: patch.humanReadableDebugSummary }
      : {}),
    ...(patch.lastTransaction !== undefined ? { lastTransaction: patch.lastTransaction } : {}),
  };
}
