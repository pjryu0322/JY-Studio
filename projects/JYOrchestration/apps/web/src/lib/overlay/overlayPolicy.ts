/**
 * Overlay Runtime Policy — **힌트 전용**(Hard enforcement 아님).
 */
import { canUseCursorByIdentity, resolveAiIdentityContract } from "@/lib/overlay/overlayRuntimeResolver";

export function shouldEnableKnowledgeHints(roleKey: string | null | undefined): boolean {
  const id = resolveAiIdentityContract(roleKey);
  if (!id) return false;
  return id.capabilities.includes("knowledge_retrieval") || id.capabilities.includes("llm_chat");
}

export function shouldEnableContextAssembly(roleKey: string | null | undefined): boolean {
  const id = resolveAiIdentityContract(roleKey);
  if (!id) return true;
  return id.capabilities.some((c) => c === "llm_chat" || c === "llm_json_object" || c === "slot_orchestration");
}

export function shouldEnableOverlayTrace(roleKey: string | null | undefined): boolean {
  return Boolean(String(roleKey ?? "").trim());
}

export function shouldAllowCursorCapability(roleKey: string | null | undefined): boolean {
  return canUseCursorByIdentity(resolveAiIdentityContract(roleKey));
}
