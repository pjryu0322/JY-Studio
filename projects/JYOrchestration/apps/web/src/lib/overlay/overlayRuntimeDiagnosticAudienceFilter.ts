/**
 * H8.5 — `GET /api/diagnostics/overlay-runtime` 응답 **audience 축소**(breaking change 없음).
 *
 * `audienceMode` 미지정 시 필터 미적용(기존과 동일).
 */

import type { OverlayAudienceMode } from "@/lib/overlay-ui/overlayAudienceTypes";

const USER_STRIP_KEYS = [
  "lastPromptTraceOverlayExtract",
  "projectOverlay",
  "workspaceAiMemberOverlayMappings",
  "overlayWarningReport",
  "registeredRoles",
  "registeredProviders",
  "registeredCapabilities",
  "memoryScopeMappings",
  "knowledgeHintMappings",
] as const;

export function filterOverlayRuntimeDiagnosticDataForAudience(
  data: Record<string, unknown>,
  audience: OverlayAudienceMode | undefined
): Record<string, unknown> {
  if (!audience || audience === "operator" || audience === "internal") {
    return data;
  }
  if (audience !== "user") return data;
  const out: Record<string, unknown> = { ...data };
  for (const k of USER_STRIP_KEYS) {
    delete out[k];
  }
  return out;
}
