import type { ActiveKnowledgePackRef } from "@/lib/overlay/activeKnowledgePackRef";
import type { AiIdentityContract } from "@/lib/overlay/aiIdentityContract";
import type { PromptAssemblyMetadataContract } from "@/lib/overlay/contextAssemblyContract";
import { emptyPromptAssemblyMetadata } from "@/lib/overlay/contextAssemblyContract";
import { buildPromptAssemblyMemoryRef } from "@/lib/overlay/memoryScopeRuntime";
import { resolveKnowledgeActivationHintsForRole } from "@/lib/overlay/knowledgeActivationResolver";
import {
  buildOverlayRuntimePolicyHintsWire,
  type OverlayRuntimePolicyHintsWire,
  shouldEnableContextAssembly,
  shouldEnableKnowledgeHints,
  shouldEnableOverlayTrace,
} from "@/lib/overlay/overlayPolicy";
import { buildOverlayPolicyWarningsForResolvedRole } from "@/lib/overlay/overlayPolicyWarning";
import type { OverlayPolicyWarning } from "@/lib/overlay/overlayPolicyWarning";
import { resolveAiIdentityContract } from "@/lib/overlay/overlayRuntimeResolver";
import type { OverlaySelectedContextRef } from "@/lib/overlay/overlayContextSelection";
import { buildOverlaySelectedContextRefs } from "@/lib/overlay/overlayContextSelection";
import type { OverlayContextBudgetMetadata } from "@/lib/overlay/overlayContextBudget";
import { buildOverlayContextBudgetMetadata } from "@/lib/overlay/overlayContextBudget";
import type { OverlayOrchestrationDecisionTrace } from "@/lib/overlay/overlayOrchestrationDecisionTrace";
import { buildOverlayOrchestrationDecisionTrace } from "@/lib/overlay/overlayOrchestrationDecisionTrace";
import type { OverlayConflictWarning } from "@/lib/overlay/overlayConflictDetection";
import { detectOverlayConflicts } from "@/lib/overlay/overlayConflictDetection";
import type { OverlayAssemblyPlanItem } from "@/lib/overlay/overlayContextAssemblyPlan";
import { buildOverlayContextAssemblyPlan } from "@/lib/overlay/overlayContextAssemblyPlan";
import type { OverlayPruningCandidate } from "@/lib/overlay/overlayContextPruning";
import { suggestOverlayPruningCandidates } from "@/lib/overlay/overlayContextPruning";
import { prioritizeOverlayContexts } from "@/lib/overlay/overlayContextPrioritization";
import { detectOverlayPolicyDrift } from "@/lib/overlay/overlayPolicyDriftWarning";
import type { SingleChatOrchestrationTurnMeta } from "@/lib/requirements/singleChatOrchestrationOpenAI";
import type {
  HarnessPromptAssemblyPreview,
  HarnessPromptPreviewDiff,
} from "@/lib/harness/promptAssembly/harnessPromptAssemblyTypes";
import { buildHarnessPromptAssemblyPreview } from "@/lib/harness/promptAssembly/buildHarnessPromptAssemblyPreview";
import { compareHarnessPromptPreview } from "@/lib/harness/promptAssembly/compareHarnessPromptPreview";

export type OverlayPromptTraceIdentityWire = Readonly<{
  roleKey: string;
  perspective: string;
  provider: string;
  capabilities: readonly string[];
}>;

const USED_STAGE_MAX_LEN = 240;

/**
 * SingleChat 오케스트레이션 성공 턴의 `promptTrace`에만 붙는 Overlay 메타(프롬프트 본문·라우팅 비변경).
 */
export function buildOrchestrationOverlayPromptTraceAugments(input: {
  readonly workspaceScreenKey: string;
  readonly timelineStage: string;
  readonly meta: SingleChatOrchestrationTurnMeta;
  readonly projectId?: string | null;
  /** 선택: budget metadata용 실제 프롬프트 길이(가장 정확). */
  readonly promptLength?: number;
  /** 선택: `promptLength`가 없을 때 fallback heuristic으로 사용할 프롬프트 본문. */
  readonly promptText?: string | null;
  /** 선택: conflict 키워드 휴리스틱 입력(user/assistant/bootstrap/orchestration 메시지 등). */
  readonly timelineMessages?: readonly (string | null | undefined)[];
}): Readonly<{
  overlayIdentity?: OverlayPromptTraceIdentityWire;
  overlayContextAssembly: PromptAssemblyMetadataContract;
  overlayKnowledgeActivationHints: readonly ActiveKnowledgePackRef[];
  overlayPolicyHints: OverlayRuntimePolicyHintsWire;
  overlayPolicyWarnings: readonly OverlayPolicyWarning[];
  overlaySelectedContextRefs?: readonly OverlaySelectedContextRef[];
  overlayPrioritizedContextRefs?: readonly OverlaySelectedContextRef[];
  overlayContextBudget?: OverlayContextBudgetMetadata;
  overlayOrchestrationDecisionTrace?: OverlayOrchestrationDecisionTrace;
  overlayConflictWarnings?: readonly OverlayConflictWarning[];
  overlayContextAssemblyPlan?: readonly OverlayAssemblyPlanItem[];
  overlayPruningCandidates?: readonly OverlayPruningCandidate[];
  overlayPolicyDriftWarnings?: readonly OverlayPolicyWarning[];
  harnessPromptAssemblyPreview?: HarnessPromptAssemblyPreview;
  harnessPromptPreviewDiff?: HarnessPromptPreviewDiff;
}> {
  const usedRoleRaw = resolveOverlayTurnRoleKey(input.meta);
  const identity = resolveAiIdentityContract(usedRoleRaw);
  const policyRoleKey = identity?.roleKey ?? usedRoleRaw ?? null;
  const overlayPolicyHints = buildOverlayRuntimePolicyHintsWire(policyRoleKey);
  const overlayPolicyWarnings = buildOverlayPolicyWarningsForResolvedRole({
    policyRoleKey,
    source: "singlechat",
    identity,
  });

  if (!shouldEnableOverlayTrace(policyRoleKey)) {
    return {
      overlayPolicyHints,
      overlayContextAssembly: emptyPromptAssemblyMetadata(),
      overlayKnowledgeActivationHints: [],
      overlayPolicyWarnings,
    };
  }

  const overlayIdentity = buildOverlayPromptTraceIdentity(identity, usedRoleRaw);
  const overlayKnowledgeActivationHints = shouldEnableKnowledgeHints(policyRoleKey)
    ? resolveKnowledgeActivationHintsForRole({
        roleKey: identity?.roleKey ?? usedRoleRaw,
        projectId: input.projectId,
      })
    : [];

  const overlayContextAssembly = buildOverlayPromptTraceContextAssembly({
    policyRoleKey,
    usedRoleRaw,
    identity,
    workspaceScreenKey: input.workspaceScreenKey,
    timelineStage: input.timelineStage,
    knowledgeHints: overlayKnowledgeActivationHints,
  });

  const overlaySelectedContextRefs = buildOverlayPromptTraceSelectionRefs({
    identity,
    usedRoleRaw,
    workspaceScreenKey: input.workspaceScreenKey,
    knowledgeHints: overlayKnowledgeActivationHints,
  });

  const overlayContextBudget = buildOverlayContextBudgetMetadata({
    promptLength: resolveOverlayBudgetPromptLength({
      promptLength: input.promptLength,
      promptText: input.promptText,
      fallbackPayload: { meta: input.meta, refs: overlaySelectedContextRefs },
    }),
    selectedContextCount: overlaySelectedContextRefs.length,
  });

  const overlayOrchestrationDecisionTrace = buildOverlayPromptTraceDecisionTrace({
    identity,
    usedRoleRaw,
  });

  const overlayConflictWarnings = buildOverlayPromptTraceConflictWarnings(input.timelineMessages);

  const overlayPrioritizedContextRefs = prioritizeOverlayContexts({
    contexts: overlaySelectedContextRefs,
    budgetPolicy: overlayContextBudget.budgetPolicy,
  });

  const overlayContextAssemblyPlan = buildOverlayContextAssemblyPlan({
    selectedContextRefs: overlayPrioritizedContextRefs,
    budgetMetadata: overlayContextBudget,
  });
  const overlayPruningCandidates = suggestOverlayPruningCandidates({
    assemblyPlan: overlayContextAssemblyPlan,
    overflowRisk: overlayContextBudget.overflowRisk,
  });
  const overlayPolicyDriftWarnings = detectOverlayPolicyDrift({
    assemblyPlan: overlayContextAssemblyPlan,
    budgetMetadata: overlayContextBudget,
  });

  // Harness Phase H1 — Controlled prompt assembly preview (dry-run only).
  // 실제 prompt payload·OpenAI 호출과 무관. 위에서 이미 계산한 overlay metadata만 입력으로 사용.
  const harnessPromptAssemblyPreview = buildHarnessPromptAssemblyPreview({
    overlayAssemblyPlan: overlayContextAssemblyPlan,
    overlayPrioritizedContextRefs,
    overlayContextBudget,
    overlayIdentity,
    existingPromptText: input.promptText ?? null,
  });
  const harnessPromptPreviewDiff = compareHarnessPromptPreview({
    existingPromptText: input.promptText ?? null,
    preview: harnessPromptAssemblyPreview,
  });

  return {
    overlayIdentity,
    overlayContextAssembly,
    overlayKnowledgeActivationHints,
    overlayPolicyHints,
    overlayPolicyWarnings,
    ...(overlaySelectedContextRefs.length ? { overlaySelectedContextRefs } : {}),
    ...(overlayPrioritizedContextRefs.length ? { overlayPrioritizedContextRefs } : {}),
    overlayContextBudget,
    ...(overlayOrchestrationDecisionTrace ? { overlayOrchestrationDecisionTrace } : {}),
    ...(overlayConflictWarnings.length ? { overlayConflictWarnings } : {}),
    ...(overlayContextAssemblyPlan.length ? { overlayContextAssemblyPlan } : {}),
    ...(overlayPruningCandidates.length ? { overlayPruningCandidates } : {}),
    ...(overlayPolicyDriftWarnings.length ? { overlayPolicyDriftWarnings } : {}),
    harnessPromptAssemblyPreview,
    harnessPromptPreviewDiff,
  };
}

/** orchestration turn meta에서 가장 신뢰도 높은 role 키를 우선순위대로 선택한다. */
function resolveOverlayTurnRoleKey(meta: SingleChatOrchestrationTurnMeta): string | null {
  const candidates: readonly (string | null | undefined)[] = [
    meta.questionGeneratedBy,
    meta.orchestratorAgent,
    meta.activeConversationOwner,
    meta.conversationOwner,
  ];
  for (const c of candidates) {
    const s = String(c ?? "").trim();
    if (s) return s;
  }
  return null;
}

function buildOverlayPromptTraceIdentity(
  identity: AiIdentityContract | null | undefined,
  usedRoleRaw: string | null
): OverlayPromptTraceIdentityWire | undefined {
  if (identity) {
    return {
      roleKey: identity.roleKey,
      perspective: identity.perspective,
      provider: identity.provider,
      capabilities: [...identity.capabilities],
    };
  }
  if (usedRoleRaw) {
    return {
      roleKey: usedRoleRaw,
      perspective: "unknown",
      provider: "unknown",
      capabilities: [],
    };
  }
  return undefined;
}

function buildOverlayPromptTraceContextAssembly(input: {
  readonly policyRoleKey: string | null;
  readonly usedRoleRaw: string | null;
  readonly identity: AiIdentityContract | null | undefined;
  readonly workspaceScreenKey: string;
  readonly timelineStage: string;
  readonly knowledgeHints: readonly ActiveKnowledgePackRef[];
}): PromptAssemblyMetadataContract {
  if (!shouldEnableContextAssembly(input.policyRoleKey)) {
    return emptyPromptAssemblyMetadata();
  }
  return {
    usedRole: input.usedRoleRaw ?? input.identity?.roleKey ?? null,
    usedMemoryRefs: [
      buildPromptAssemblyMemoryRef("singleChatOrchestrationV1", "singleChatOrchestrationV1"),
      buildPromptAssemblyMemoryRef("ChatMessage", "dialogueExcerpt"),
    ],
    usedKnowledgePacks: input.knowledgeHints.map((h) => h.knowledgePackId),
    usedStage: `${input.workspaceScreenKey} · ${input.timelineStage}`.slice(0, USED_STAGE_MAX_LEN),
    tokenBudgetHint: "not_measured",
  };
}

function buildOverlayPromptTraceSelectionRefs(input: {
  readonly identity: AiIdentityContract | null | undefined;
  readonly usedRoleRaw: string | null;
  readonly workspaceScreenKey: string;
  readonly knowledgeHints: readonly ActiveKnowledgePackRef[];
}): readonly OverlaySelectedContextRef[] {
  return buildOverlaySelectedContextRefs({
    roleKey: input.identity?.roleKey ?? input.usedRoleRaw ?? null,
    memoryScopes: input.identity ? [...input.identity.memoryScopes] : [],
    knowledgeHints: input.knowledgeHints.map((h) => h.knowledgePackId),
    timelineEnabled: true,
    workspaceScreenKey: input.workspaceScreenKey,
    policyHintSource: input.identity?.roleKey ?? null,
  });
}

function buildOverlayPromptTraceDecisionTrace(input: {
  readonly identity: AiIdentityContract | null | undefined;
  readonly usedRoleRaw: string | null;
}): OverlayOrchestrationDecisionTrace | undefined {
  if (!input.identity) return undefined;
  return buildOverlayOrchestrationDecisionTrace({
    roleKey: input.identity.roleKey,
    capabilities: [...input.identity.capabilities],
    knowledgeScopes: [...input.identity.knowledgeScopes],
    selectionReason:
      input.usedRoleRaw === input.identity.roleKey ? "role_resolved" : "role_resolved_via_meta",
  });
}

function buildOverlayPromptTraceConflictWarnings(
  rawMessages: readonly (string | null | undefined)[] | undefined
): readonly OverlayConflictWarning[] {
  const cleaned = (rawMessages ?? [])
    .map((m) => (typeof m === "string" ? m : ""))
    .filter((m) => m.length > 0);
  if (!cleaned.length) return [];
  return detectOverlayConflicts({ timelineMessages: cleaned });
}

/**
 * Context budget metadata용 프롬프트 길이를 안전하게 산출한다.
 *
 * 우선순위:
 * 1. 명시된 `promptLength`(가장 정확).
 * 2. `promptText.length` (실제 직렬화된 프롬프트 본문 길이).
 * 3. `JSON.stringify({ meta, refs })` 길이(휴리스틱 fallback).
 *
 * **실제 토큰 카운팅이 아니다.** OpenAI payload·라우팅 비변경. budget metadata 생성만을 위함.
 */
function resolveOverlayBudgetPromptLength(input: {
  readonly promptLength?: number;
  readonly promptText?: string | null;
  readonly fallbackPayload: { readonly meta: unknown; readonly refs: readonly OverlaySelectedContextRef[] };
}): number {
  if (typeof input.promptLength === "number" && Number.isFinite(input.promptLength) && input.promptLength > 0) {
    return Math.floor(input.promptLength);
  }
  const promptTextLen = typeof input.promptText === "string" ? input.promptText.length : 0;
  if (promptTextLen > 0) return promptTextLen;
  try {
    return JSON.stringify(input.fallbackPayload).length;
  } catch {
    return 0;
  }
}
