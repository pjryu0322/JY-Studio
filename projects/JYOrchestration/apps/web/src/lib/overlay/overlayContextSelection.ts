/**
 * Overlay: Selection 기반 Orchestration 준비 단계용 read-only metadata.
 *
 * **이 헬퍼는 prompt 본문을 자동 조립하거나 라우팅을 강제하지 않는다.** 어떤 context가
 * 왜 선택되었는지를 진단·replay할 수 있도록 metadata만 생성한다.
 */

export type OverlaySelectedContextRefType =
  | "memory"
  | "knowledge"
  | "timeline"
  | "workspace"
  | "role"
  | "policy";

export type OverlaySelectedContextRef = Readonly<{
  type: OverlaySelectedContextRefType;
  /** 출처 식별자(memory scope id, knowledge pack id, role key 등) */
  source: string;
  /** 선택 사유(예: `role_default`, `bootstrap`, `policy_hint`) */
  reason: string;
  /** 0(가장 강함) → 큰 값(약함). 동일 type 안에서 정렬 가능. */
  priority: number;
}>;

const VALID_TYPES = new Set<OverlaySelectedContextRefType>([
  "memory",
  "knowledge",
  "timeline",
  "workspace",
  "role",
  "policy",
]);

/** SingleChat·Review·Bootstrap 공통: 역할 기반 selection metadata를 만든다. */
export function buildOverlaySelectedContextRefs(input: {
  roleKey: string | null | undefined;
  memoryScopes: readonly string[];
  knowledgeHints: readonly string[];
  timelineEnabled?: boolean;
  workspaceScreenKey?: string | null;
  policyHintSource?: string | null;
}): readonly OverlaySelectedContextRef[] {
  const out: OverlaySelectedContextRef[] = [];
  const rk = String(input.roleKey ?? "").trim();

  if (rk) {
    out.push({
      type: "role",
      source: rk.slice(0, 120),
      reason: "role_resolved",
      priority: 0,
    });
  }

  input.memoryScopes.forEach((scope, idx) => {
    const s = String(scope ?? "").trim();
    if (!s) return;
    out.push({
      type: "memory",
      source: s.slice(0, 120),
      reason: "role_memory_scope",
      priority: 10 + idx,
    });
  });

  input.knowledgeHints.forEach((hint, idx) => {
    const s = String(hint ?? "").trim();
    if (!s) return;
    out.push({
      type: "knowledge",
      source: s.slice(0, 240),
      reason: "role_knowledge_hint",
      priority: 20 + idx,
    });
  });

  if (input.timelineEnabled) {
    out.push({
      type: "timeline",
      source: "promptTimeline",
      reason: "promptTrace_overlay_enabled",
      priority: 30,
    });
  }

  const ws = String(input.workspaceScreenKey ?? "").trim();
  if (ws) {
    out.push({
      type: "workspace",
      source: ws.slice(0, 120),
      reason: "workspace_screen",
      priority: 40,
    });
  }

  const hintSrc = String(input.policyHintSource ?? "").trim();
  if (hintSrc) {
    out.push({
      type: "policy",
      source: hintSrc.slice(0, 120),
      reason: "policy_hint_source",
      priority: 50,
    });
  }

  return out;
}

/** 행당 최대 selection 개수(타임라인 비대화 방지). */
export const OVERLAY_SELECTED_CONTEXT_REFS_MAX = 32;

export function parseOverlaySelectedContextRefsFromUnknown(
  raw: unknown
): readonly OverlaySelectedContextRef[] {
  if (!Array.isArray(raw)) return [];
  const out: OverlaySelectedContextRef[] = [];
  for (const item of raw.slice(0, OVERLAY_SELECTED_CONTEXT_REFS_MAX)) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const t = String(r.type ?? "").trim() as OverlaySelectedContextRefType;
    if (!VALID_TYPES.has(t)) continue;
    const source = String(r.source ?? "").trim().slice(0, 240);
    const reason = String(r.reason ?? "").trim().slice(0, 120);
    const priorityRaw = Number(r.priority);
    const priority = Number.isFinite(priorityRaw) ? Math.max(0, Math.floor(priorityRaw)) : 999;
    if (!source || !reason) continue;
    out.push({ type: t, source, reason, priority });
  }
  return out;
}

export type OverlaySelectionSummaryWire = Readonly<{
  selectedContextCount: number;
  memoryCount: number;
  knowledgeHintCount: number;
  timelineCount: number;
  roleCount: number;
  workspaceCount: number;
  policyCount: number;
}>;

export function summarizeOverlaySelectedContextRefs(
  refs: readonly OverlaySelectedContextRef[]
): OverlaySelectionSummaryWire {
  const counts: Record<OverlaySelectedContextRefType, number> = {
    memory: 0,
    knowledge: 0,
    timeline: 0,
    workspace: 0,
    role: 0,
    policy: 0,
  };
  for (const r of refs) {
    if (counts[r.type] !== undefined) counts[r.type]++;
  }
  return {
    selectedContextCount: refs.length,
    memoryCount: counts.memory,
    knowledgeHintCount: counts.knowledge,
    timelineCount: counts.timeline,
    roleCount: counts.role,
    workspaceCount: counts.workspace,
    policyCount: counts.policy,
  };
}
