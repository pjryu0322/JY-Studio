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
}): Readonly<{
  overlayIdentity?: OverlayPromptTraceIdentityWire;
  overlayContextAssembly: PromptAssemblyMetadataContract;
  overlayKnowledgeActivationHints: readonly ActiveKnowledgePackRef[];
  overlayPolicyHints: OverlayRuntimePolicyHintsWire;
  overlayPolicyWarnings: readonly OverlayPolicyWarning[];
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

  return {
    overlayIdentity,
    overlayContextAssembly,
    overlayKnowledgeActivationHints,
    overlayPolicyHints,
    overlayPolicyWarnings,
  };
}
