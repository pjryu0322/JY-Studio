import { NextRequest, NextResponse } from "next/server";
import { OVERLAY_KNOWLEDGE_HINT_SCOPE_BY_ROLE } from "@/lib/overlay/knowledgeActivationResolver";
import { OVERLAY_MEMORY_SCOPE_SOURCE_RULES } from "@/lib/overlay/memoryScopeRuntime";
import {
  OVERLAY_REGISTRY_CAPABILITY_IDS,
  OVERLAY_REGISTRY_PROVIDERS,
  OVERLAY_REGISTRY_ROLE_KEYS,
  resolveAiIdentityContract,
} from "@/lib/overlay/overlayRuntimeResolver";

/**
 * Overlay 런타임·레지스트리 **읽기 전용** 진단. DB·오케스트레이션 경로에 영향 없음.
 * 선택 쿼리: `?roles=a,b,c` — 각 문자열에 대해 `resolveAiIdentityContract` 실패 시 `unresolvedRoleKeys`에 포함.
 */
export async function GET(request: NextRequest) {
  const rolesParam = request.nextUrl.searchParams.get("roles");
  const sample = rolesParam?.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean) ?? [];
  const unresolvedRoleKeys = sample.filter((r) => !resolveAiIdentityContract(r));

  const knowledgeHintMappings = Object.entries(OVERLAY_KNOWLEDGE_HINT_SCOPE_BY_ROLE)
    .map(([roleKey, hintScope]) => ({ roleKey, hintScope }))
    .sort((a, b) => a.roleKey.localeCompare(b.roleKey));

  const memoryScopeMappings = OVERLAY_MEMORY_SCOPE_SOURCE_RULES.map((r) => ({
    sourceLabel: r.sourceLabel,
    scope: r.scope,
  }));

  return NextResponse.json({
    success: true,
    data: {
      overlayRuntimeEnabled: true,
      registeredRoles: [...OVERLAY_REGISTRY_ROLE_KEYS],
      registeredProviders: [...OVERLAY_REGISTRY_PROVIDERS],
      registeredCapabilities: [...OVERLAY_REGISTRY_CAPABILITY_IDS],
      memoryScopeMappings,
      knowledgeHintMappings,
      unresolvedRoleKeys,
      promptTraceOverlayEnabled: true,
    },
  });
}
