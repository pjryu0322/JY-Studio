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
const ROLE_KEY_MAX = 120;
const REASON_MAX = 200;
const DEFAULT_SELECTION_REASON = "role_resolved";

function normalizeStringList(raw: unknown): readonly string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const s = String(item ?? "").trim();
    if (s) out.push(s);
    if (out.length >= MAX_MATCH) break;
  }
  return out;
}

function normalizeRoleKey(raw: unknown, fallback: string | null = null): string | null {
  const s = String(raw ?? "").trim().slice(0, ROLE_KEY_MAX);
  if (s) return s;
  return fallback;
}

function normalizeReason(raw: unknown): string {
  const s = String(raw ?? "").trim();
  return (s || DEFAULT_SELECTION_REASON).slice(0, REASON_MAX);
}

export function buildOverlayOrchestrationDecisionTrace(input: {
  roleKey: string;
  capabilities: readonly string[];
  knowledgeScopes: readonly string[];
  selectionReason?: string;
}): OverlayOrchestrationDecisionTrace {
  return {
    selectedRoleKey: normalizeRoleKey(input.roleKey, "unknown") ?? "unknown",
    selectionReason: normalizeReason(input.selectionReason),
    matchedCapabilities: normalizeStringList(input.capabilities),
    matchedKnowledgeScopes: normalizeStringList(input.knowledgeScopes),
  };
}

export function parseOverlayOrchestrationDecisionTraceFromUnknown(
  raw: unknown
): OverlayOrchestrationDecisionTrace | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const selectedRoleKey = normalizeRoleKey(r.selectedRoleKey);
  if (!selectedRoleKey) return null;
  return {
    selectedRoleKey,
    selectionReason: normalizeReason(r.selectionReason),
    matchedCapabilities: normalizeStringList(r.matchedCapabilities),
    matchedKnowledgeScopes: normalizeStringList(r.matchedKnowledgeScopes),
  };
}
