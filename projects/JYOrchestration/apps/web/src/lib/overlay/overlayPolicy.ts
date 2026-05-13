/**
 * Overlay Runtime Policy — **힌트 전용**(Hard enforcement 아님).
 */
import { canUseCursorByIdentity, resolveAiIdentityContract } from "@/lib/overlay/overlayRuntimeResolver";

/** 진단·promptTrace·Review Harness에만 기록; Cursor 실행 차단과 무관 */
export type OverlayRuntimePolicyHintsWire = Readonly<{
  knowledgeHintsEnabled: boolean;
  contextAssemblyEnabled: boolean;
  overlayTraceEnabled: boolean;
  cursorCapabilityAllowed: boolean;
  cursorCapabilityEnforcement: "not_applied";
}>;

export function buildOverlayRuntimePolicyHintsWire(roleKey: string | null | undefined): OverlayRuntimePolicyHintsWire {
  return {
    knowledgeHintsEnabled: shouldEnableKnowledgeHints(roleKey),
    contextAssemblyEnabled: shouldEnableContextAssembly(roleKey),
    overlayTraceEnabled: shouldEnableOverlayTrace(roleKey),
    cursorCapabilityAllowed: shouldAllowCursorCapability(roleKey),
    cursorCapabilityEnforcement: "not_applied",
  };
}

/** 저장 JSON·타임라인 행에서 `overlayPolicyHints` 복원(coerce·extract 공통). */
export function parseOverlayRuntimePolicyHintsWire(raw: unknown): OverlayRuntimePolicyHintsWire | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (
    typeof o.knowledgeHintsEnabled === "boolean" &&
    typeof o.contextAssemblyEnabled === "boolean" &&
    typeof o.overlayTraceEnabled === "boolean" &&
    typeof o.cursorCapabilityAllowed === "boolean" &&
    o.cursorCapabilityEnforcement === "not_applied"
  ) {
    return {
      knowledgeHintsEnabled: o.knowledgeHintsEnabled,
      contextAssemblyEnabled: o.contextAssemblyEnabled,
      overlayTraceEnabled: o.overlayTraceEnabled,
      cursorCapabilityAllowed: o.cursorCapabilityAllowed,
      cursorCapabilityEnforcement: "not_applied",
    };
  }
  return null;
}

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
