import type { OverlayPolicyWarning, OverlayPolicyWarningSummaryWire } from "@/lib/overlay/overlayPolicyWarning";
import { summarizeOverlayPolicyWarnings } from "@/lib/overlay/overlayPolicyWarning";

const SEVERITY_RANK: Record<string, number> = { critical: 0, warning: 1, info: 2 };

function compareWarnings(a: OverlayPolicyWarning, b: OverlayPolicyWarning): number {
  const ra = SEVERITY_RANK[a.severity] ?? 9;
  const rb = SEVERITY_RANK[b.severity] ?? 9;
  if (ra !== rb) return ra - rb;
  return a.code.localeCompare(b.code);
}

/**
 * UI·문서 진단 리포트용 read-only 묶음. 실행 차단·의사결정 변경 없음.
 */
export function buildOverlayWarningReport(input: {
  warnings: readonly OverlayPolicyWarning[];
}): {
  summary: OverlayPolicyWarningSummaryWire;
  topWarnings: readonly OverlayPolicyWarning[];
  recommendations: readonly string[];
} {
  const warnings = input.warnings;
  const summary = summarizeOverlayPolicyWarnings(warnings);
  const sorted = [...warnings].sort(compareWarnings);
  const topWarnings = sorted.slice(0, 12);

  const codes = new Set(warnings.map((w) => w.code));
  const recommendations: string[] = [];
  if (codes.has("OVERLAY_ROLE_UNRESOLVED") || codes.has("OVERLAY_PROJECT_AGENT_UNRESOLVED")) {
    recommendations.push("Overlay identity mapping을 추가하거나 선택 에이전트의 orchestration 역할·카탈로그 키를 계약 역할에 맞춥니다.");
  }
  if (codes.has("OVERLAY_CURSOR_CAPABILITY_NOT_ALLOWED")) {
    recommendations.push("현재는 차단하지 않으며, 실행 권한 정책 도입 전까지 diagnostic·메타만 유지합니다.");
  }
  if (codes.has("OVERLAY_WORKSPACE_CATALOG_UNMAPPED")) {
    recommendations.push("platformAiMembers catalog key와 overlay identity 매핑을 동기화합니다.");
  }

  return { summary, topWarnings, recommendations };
}
