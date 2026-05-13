/**
 * Overlay Registry — resolver 위의 **얇은 wrapper** (singleton 아님, 정적 조회만).
 */
import type { AiIdentityContract, OverlayAiCapabilityId, OverlayKnowledgeScopeId } from "@/lib/overlay/aiIdentityContract";
import type { MemoryScope } from "@/lib/overlay/memoryScopeContract";
import {
  resolveAiIdentityContract,
  resolveDefaultKnowledgeScopesForRole,
  resolveDefaultMemoryScopesForRole,
} from "@/lib/overlay/overlayRuntimeResolver";

export function getOverlayIdentity(roleKey: string | null | undefined): AiIdentityContract | null {
  return resolveAiIdentityContract(roleKey);
}

export function getOverlayCapabilities(roleKey: string | null | undefined): readonly OverlayAiCapabilityId[] {
  return getOverlayIdentity(roleKey)?.capabilities ?? [];
}

export function getOverlayKnowledgeScopes(roleKey: string | null | undefined): readonly OverlayKnowledgeScopeId[] {
  return resolveDefaultKnowledgeScopesForRole(roleKey);
}

export function getOverlayDefaultMemoryScopes(roleKey: string | null | undefined): readonly MemoryScope[] {
  return resolveDefaultMemoryScopesForRole(roleKey);
}

export function getOverlayProvider(roleKey: string | null | undefined): AiIdentityContract["provider"] | null {
  return getOverlayIdentity(roleKey)?.provider ?? null;
}
