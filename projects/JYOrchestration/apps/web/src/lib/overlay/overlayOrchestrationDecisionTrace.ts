/**
 * Overlay: Orchestration Decision Trace (replay·진단용 metadata).
 *
 * **이 헬퍼는 라우팅·실행을 변경하지 않는다.** 어떤 역할이 어떤 사유로 선택되었는지를
 * replay·감사할 수 있도록 metadata만 만든다.
 */

export type OverlayOrchestrationDecisionTrace = Readonly<{
  selectedRoleKey: string;
  selectionReason: string;
  matchedCapabilities: readonly string[];
  matchedKnowledgeScopes: readonly string[];
}>;

const MAX_MATCH = 24;

export function buildOverlayOrchestrationDecisionTrace(input: {
  roleKey: string;
  capabilities: readonly string[];
  knowledgeScopes: readonly string[];
  selectionReason?: string;
}): OverlayOrchestrationDecisionTrace {
  const selectedRoleKey = String(input.roleKey ?? "").trim().slice(0, 120) || "unknown";
  const selectionReason = (String(input.selectionReason ?? "").trim() || "role_resolved").slice(0, 200);
  const matchedCapabilities = (input.capabilities ?? [])
    .map((c) => String(c ?? "").trim())
    .filter(Boolean)
    .slice(0, MAX_MATCH);
  const matchedKnowledgeScopes = (input.knowledgeScopes ?? [])
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .slice(0, MAX_MATCH);
  return {
    selectedRoleKey,
    selectionReason,
    matchedCapabilities,
    matchedKnowledgeScopes,
  };
}

export function parseOverlayOrchestrationDecisionTraceFromUnknown(
  raw: unknown
): OverlayOrchestrationDecisionTrace | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const selectedRoleKey = String(r.selectedRoleKey ?? "").trim().slice(0, 120);
  if (!selectedRoleKey) return null;
  const selectionReason = String(r.selectionReason ?? "").trim().slice(0, 200) || "role_resolved";
  const matchedCapabilities = Array.isArray(r.matchedCapabilities)
    ? (r.matchedCapabilities as unknown[])
        .map((x) => String(x ?? "").trim())
        .filter(Boolean)
        .slice(0, MAX_MATCH)
    : [];
  const matchedKnowledgeScopes = Array.isArray(r.matchedKnowledgeScopes)
    ? (r.matchedKnowledgeScopes as unknown[])
        .map((x) => String(x ?? "").trim())
        .filter(Boolean)
        .slice(0, MAX_MATCH)
    : [];
  return { selectedRoleKey, selectionReason, matchedCapabilities, matchedKnowledgeScopes };
}
