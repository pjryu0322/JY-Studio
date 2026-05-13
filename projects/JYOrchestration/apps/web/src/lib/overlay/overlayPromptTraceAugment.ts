import type { ActiveKnowledgePackRef } from "@/lib/overlay/activeKnowledgePackRef";
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
import type { SingleChatOrchestrationTurnMeta } from "@/lib/requirements/singleChatOrchestrationOpenAI";

export type OverlayPromptTraceIdentityWire = Readonly<{
  roleKey: string;
  perspective: string;
  provider: string;
  capabilities: readonly string[];
}>;

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
  overlayContextBudget?: OverlayContextBudgetMetadata;
  overlayOrchestrationDecisionTrace?: OverlayOrchestrationDecisionTrace;
  overlayConflictWarnings?: readonly OverlayConflictWarning[];
}> {
  const usedRoleRaw =
    String(input.meta.questionGeneratedBy ?? "").trim() ||
    String(input.meta.orchestratorAgent ?? "").trim() ||
    String(input.meta.activeConversationOwner ?? "").trim() ||
    String(input.meta.conversationOwner ?? "").trim() ||
    null;

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

  const overlayIdentity: OverlayPromptTraceIdentityWire | undefined = identity
    ? {
        roleKey: identity.roleKey,
        perspective: identity.perspective,
        provider: identity.provider,
        capabilities: [...identity.capabilities],
      }
    : usedRoleRaw
      ? {
          roleKey: usedRoleRaw,
          perspective: "unknown",
          provider: "unknown",
          capabilities: [],
        }
      : undefined;

  const roleKeyForHints = identity?.roleKey ?? usedRoleRaw;
  const overlayKnowledgeActivationHints = shouldEnableKnowledgeHints(policyRoleKey)
    ? resolveKnowledgeActivationHintsForRole({
        roleKey: roleKeyForHints,
        projectId: input.projectId,
      })
    : [];

  const usedMemoryRefs = [
    buildPromptAssemblyMemoryRef("singleChatOrchestrationV1", "singleChatOrchestrationV1"),
    buildPromptAssemblyMemoryRef("ChatMessage", "dialogueExcerpt"),
  ];

  const overlayContextAssembly: PromptAssemblyMetadataContract = shouldEnableContextAssembly(policyRoleKey)
    ? {
        usedRole: usedRoleRaw ?? identity?.roleKey ?? null,
        usedMemoryRefs,
        usedKnowledgePacks: overlayKnowledgeActivationHints.map((h) => h.knowledgePackId),
        usedStage: `${input.workspaceScreenKey} · ${input.timelineStage}`.slice(0, 240),
        tokenBudgetHint: "not_measured",
      }
    : emptyPromptAssemblyMetadata();

  // Overlay 5단계 준비 metadata — 모두 read-only, prompt 본문·라우팅 비변경.
  const memoryScopesForSelection = identity ? [...identity.memoryScopes] : [];
  const knowledgeHintsForSelection = overlayKnowledgeActivationHints.map((h) => h.knowledgePackId);
  const overlaySelectedContextRefs = buildOverlaySelectedContextRefs({
    roleKey: identity?.roleKey ?? usedRoleRaw ?? null,
    memoryScopes: memoryScopesForSelection,
    knowledgeHints: knowledgeHintsForSelection,
    timelineEnabled: true,
    workspaceScreenKey: input.workspaceScreenKey,
    policyHintSource: identity?.roleKey ?? null,
  });

  const resolvedPromptLength = resolveOverlayBudgetPromptLength({
    promptLength: input.promptLength,
    promptText: input.promptText,
    fallbackPayload: { meta: input.meta, refs: overlaySelectedContextRefs },
  });
  const overlayContextBudget = buildOverlayContextBudgetMetadata({
    promptLength: resolvedPromptLength,
    selectedContextCount: overlaySelectedContextRefs.length,
  });

  const overlayOrchestrationDecisionTrace = identity
    ? buildOverlayOrchestrationDecisionTrace({
        roleKey: identity.roleKey,
        capabilities: [...identity.capabilities],
        knowledgeScopes: [...identity.knowledgeScopes],
        selectionReason: usedRoleRaw === identity.roleKey ? "role_resolved" : "role_resolved_via_meta",
      })
    : undefined;

  const conflictTimelineMessages = (input.timelineMessages ?? [])
    .map((m) => (typeof m === "string" ? m : ""))
    .filter((m) => m.length > 0);
  const overlayConflictWarnings = conflictTimelineMessages.length
    ? detectOverlayConflicts({ timelineMessages: conflictTimelineMessages })
    : [];

  return {
    overlayIdentity,
    overlayContextAssembly,
    overlayKnowledgeActivationHints,
    overlayPolicyHints,
    overlayPolicyWarnings,
    ...(overlaySelectedContextRefs.length ? { overlaySelectedContextRefs } : {}),
    overlayContextBudget,
    ...(overlayOrchestrationDecisionTrace ? { overlayOrchestrationDecisionTrace } : {}),
    ...(overlayConflictWarnings.length ? { overlayConflictWarnings } : {}),
  };
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
