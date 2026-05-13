/**
 * Overlay Architecture — 계약 타입·어휘 재export.
 * Stage1/2·Cursor·GitHub 자동화 경로는 이 모듈을 **필수 import 하지 않는다** (overlay는 점진 주입).
 */
export type { MemoryScope } from "@/lib/overlay/memoryScopeContract";
export type {
  AiIdentityContract,
  OverlayAiCapabilityId,
  OverlayAiPerspectiveId,
  OverlayKnowledgeScopeId,
} from "@/lib/overlay/aiIdentityContract";
export type {
  PromptAssemblyMemoryRef,
  PromptAssemblyMetadataContract,
} from "@/lib/overlay/contextAssemblyContract";
export { emptyPromptAssemblyMetadata } from "@/lib/overlay/contextAssemblyContract";
export type {
  ActiveKnowledgePackActivationStatus,
  ActiveKnowledgePackRef,
} from "@/lib/overlay/activeKnowledgePackRef";
export {
  resolveAiIdentityContract,
  canUseCursorByIdentity,
  resolveDefaultMemoryScopesForRole,
  resolveDefaultKnowledgeScopesForRole,
} from "@/lib/overlay/overlayRuntimeResolver";
export { resolveMemoryScopeFromSource, buildPromptAssemblyMemoryRef } from "@/lib/overlay/memoryScopeRuntime";
export { resolveKnowledgeActivationHintsForRole } from "@/lib/overlay/knowledgeActivationResolver";
export { buildOrchestrationOverlayPromptTraceAugments } from "@/lib/overlay/overlayPromptTraceAugment";
export type { OverlayPromptTraceIdentityWire } from "@/lib/overlay/overlayPromptTraceAugment";
export type { ProjectOverlayDiagnosticWire, ProjectOverlayAgentDiagnosticRow } from "@/lib/overlay/overlayProjectDiagnostic";
export { buildProjectOverlayDiagnosticFromSelectedAgents } from "@/lib/overlay/overlayProjectDiagnostic";
export {
  getOverlayCapabilities,
  getOverlayDefaultMemoryScopes,
  getOverlayIdentity,
  getOverlayKnowledgeScopes,
  getOverlayProvider,
} from "@/lib/overlay/overlayRegistry";
export {
  shouldAllowCursorCapability,
  shouldEnableContextAssembly,
  shouldEnableKnowledgeHints,
  shouldEnableOverlayTrace,
  buildOverlayRuntimePolicyHintsWire,
  parseOverlayRuntimePolicyHintsWire,
} from "@/lib/overlay/overlayPolicy";
export type { OverlayRuntimePolicyHintsWire } from "@/lib/overlay/overlayPolicy";
export {
  buildOverlayPolicyWarnings,
  buildOverlayPolicyWarningsForResolvedRole,
  buildProjectAgentUnresolvedDiagnosticWarnings,
  buildWorkspaceCatalogUnmappedWarnings,
  collateOverlayRuntimeDiagnosticWarnings,
  overlayPolicyExpectationFlagsFromIdentity,
  parseOverlayPolicyWarningsFromUnknown,
  summarizeOverlayPolicyWarnings,
  OVERLAY_POLICY_WARNINGS_MAX_TIMELINE,
} from "@/lib/overlay/overlayPolicyWarning";
export type { OverlayPolicyWarning, OverlayPolicyWarningSeverity, OverlayPolicyWarningSummaryWire } from "@/lib/overlay/overlayPolicyWarning";
export {
  resolveOverlayIdentityFromAiMember,
  validateWorkspaceAiMemberOverlayMappings,
  listUnmappedWorkspaceAiMemberKeys,
} from "@/lib/overlay/overlayIdentityFromWorkspace";
export { extractOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
export type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
export {
  OVERLAY_REGISTRY_CAPABILITY_IDS,
  OVERLAY_REGISTRY_PROVIDERS,
  OVERLAY_REGISTRY_ROLE_KEYS,
} from "@/lib/overlay/overlayRuntimeResolver";
export { OVERLAY_MEMORY_SCOPE_SOURCE_RULES } from "@/lib/overlay/memoryScopeRuntime";
export { OVERLAY_KNOWLEDGE_HINT_SCOPE_BY_ROLE } from "@/lib/overlay/knowledgeActivationResolver";
