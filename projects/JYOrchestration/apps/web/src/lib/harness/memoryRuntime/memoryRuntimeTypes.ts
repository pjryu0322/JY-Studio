/**
 * Harness Phase H4 Preparation — **Memory Runtime Harness** 타입.
 *
 * **read-only / planning metadata only.** 이 타입의 어떤 값도 실제 prompt payload, LLM 호출,
 * retrieval, vector DB, provider, Cursor execution, GitHub PR/merge에 영향을 주지 않는다.
 *
 * 목적: "AI가 어떤 기억을 왜 참조했는가"를 설명 가능한 구조로 만든다.
 * 아직 하지 않는 것: persistent memory storage orchestration, vector retrieval,
 * autonomous memory update, memory pruning, actual prompt injection.
 */

import type { MemoryScope } from "@/lib/overlay/memoryScopeContract";

/**
 * 메모리 스코프. 기존 `MemoryScope`(`platform | project | role | session | working`)을 그대로 재사용해
 * 단일 출처를 유지한다. Memory Runtime은 새 스코프를 도입하지 않는다.
 */
export type MemoryScopeType = MemoryScope;

/** Memory Runtime 평가 결과의 freshness/stale 등급. */
export type MemoryFreshness = "fresh" | "aging" | "stale";

/** Memory Runtime 진단 finding의 severity(이 단계에서는 행동 강제 없음 → info/warning만). */
export type MemoryRuntimeFindingSeverity = "info" | "warning";

/**
 * 단일 메모리 참조 후보. **planning metadata** — 실제 retrieval/injection을 수행하지 않는다.
 *
 * 필드 의미:
 * - `memoryId`: 안정적인 식별자(예: `singleChatOrchestrationV1`, `ChatMessage:dialogueExcerpt`).
 * - `scope`: 메모리 스코프(`MemoryScope` 재사용).
 * - `summary`: 사용자가 이해 가능한 한 줄 요약(≤ 240자).
 * - `freshness`: 평가 helper가 산출한 등급.
 * - `selectedReason`: 왜 후보로 선택했는지(예: `"role_policy_match"`, `"recent_timeline_evidence"`).
 * - `selectedBy`: 선택 주체(예: `roleKey`/`"role_policy"`/`"recent_timeline"`).
 * - `estimatedImportance`: 0–100 정수(상대적 우선순위 정렬용 휴리스틱; 실제 가중치 아님).
 */
export type MemoryRuntimeReference = Readonly<{
  memoryId: string;
  scope: MemoryScopeType;
  summary: string;
  freshness: MemoryFreshness;
  selectedReason: string;
  selectedBy: string;
  estimatedImportance: number;
}>;

/** Memory Runtime 진단 발견 항목. */
export type MemoryRuntimeFinding = Readonly<{
  code: string;
  severity: MemoryRuntimeFindingSeverity;
  message: string;
}>;

/**
 * Memory Runtime Plan — 한 turn의 메모리 참조 계획 + 진단.
 *
 * **항상 `mode === "dry_run"`.** apply가 아닌 planning 결과이며, persistence/retrieval에 영향 없음.
 */
export type MemoryRuntimePlan = Readonly<{
  mode: "dry_run";
  roleKey: string | null;
  references: readonly MemoryRuntimeReference[];
  /** plan-level 경고/안내(stale 충돌, 빈 후보 등). */
  findings: readonly MemoryRuntimeFinding[];
}>;

/**
 * Diagnostic API 응답용 누적 summary.
 *
 * - `total`: 평가에 사용된 reference 수.
 * - `fresh/aging/stale`: freshness 분포.
 * - `roleScoped/projectScoped`: 스코프 분포(요약 hint; 전체 분포는 references에서 확인).
 */
export type MemoryRuntimeSummary = Readonly<{
  mode: "dry_run";
  total: number;
  fresh: number;
  aging: number;
  stale: number;
  platformScoped: number;
  projectScoped: number;
  roleScoped: number;
  sessionScoped: number;
  workingScoped: number;
  findingsCount: number;
}>;

/** 빈 plan(replay/empty fallback). 호출부 shape 안정화. */
export function emptyMemoryRuntimePlan(): MemoryRuntimePlan {
  return { mode: "dry_run", roleKey: null, references: [], findings: [] };
}

/** 빈 summary. */
export function emptyMemoryRuntimeSummary(): MemoryRuntimeSummary {
  return {
    mode: "dry_run",
    total: 0,
    fresh: 0,
    aging: 0,
    stale: 0,
    platformScoped: 0,
    projectScoped: 0,
    roleScoped: 0,
    sessionScoped: 0,
    workingScoped: 0,
    findingsCount: 0,
  };
}

/** Memory Runtime Plan → Summary 변환(read-only). */
export function summarizeMemoryRuntimePlan(plan: MemoryRuntimePlan | null | undefined): MemoryRuntimeSummary {
  if (!plan || plan.mode !== "dry_run" || !Array.isArray(plan.references)) {
    return emptyMemoryRuntimeSummary();
  }
  let fresh = 0;
  let aging = 0;
  let stale = 0;
  let platformScoped = 0;
  let projectScoped = 0;
  let roleScoped = 0;
  let sessionScoped = 0;
  let workingScoped = 0;
  for (const ref of plan.references) {
    if (ref.freshness === "fresh") fresh += 1;
    else if (ref.freshness === "aging") aging += 1;
    else if (ref.freshness === "stale") stale += 1;
    if (ref.scope === "platform") platformScoped += 1;
    else if (ref.scope === "project") projectScoped += 1;
    else if (ref.scope === "role") roleScoped += 1;
    else if (ref.scope === "session") sessionScoped += 1;
    else if (ref.scope === "working") workingScoped += 1;
  }
  return {
    mode: "dry_run",
    total: plan.references.length,
    fresh,
    aging,
    stale,
    platformScoped,
    projectScoped,
    roleScoped,
    sessionScoped,
    workingScoped,
    findingsCount: plan.findings?.length ?? 0,
  };
}
