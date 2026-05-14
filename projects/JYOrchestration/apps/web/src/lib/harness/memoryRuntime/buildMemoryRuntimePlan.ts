/**
 * Harness Phase H4 Preparation — **Memory Runtime Plan Builder**.
 *
 * 입력(역할, 프로젝트 컨텍스트, 최근 timeline, working context)을 보고
 * "어떤 기억을 왜 참조 후보로 삼을지" planning metadata를 생성한다.
 *
 * **절대 원칙(읽기 전용):**
 * - 실제 prompt payload·LLM 호출·retrieval·vector DB·provider·Cursor execution·GitHub PR/merge
 *   어디에도 영향을 주지 않는다.
 * - 후보일 뿐이며 자동 적용·강제 주입 없음. 결정은 항상 별도/수동.
 * - 결정론적 정렬: 같은 입력은 같은 references 순서를 생성한다.
 */

import { trimAndClipString } from "@/lib/harness/promptAssembly/internal/harnessPromptAssemblyStrings";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";

import { evaluateMemoryFreshness } from "./evaluateMemoryFreshness";
import { detectMemoryRuntimeDirectionalConflict } from "./memoryRuntimeConflictRules";
import { classifyMemoryRuntimeScope } from "./memoryRuntimeScopeClassifier";
import {
  MEMORY_RUNTIME_DEFAULT_POLICY,
  resolveMemoryRuntimeRolePolicy,
  type MemoryRuntimeRolePolicy,
} from "./memoryRuntimeRolePolicy";
import {
  type MemoryFreshness,
  type MemoryRuntimeFinding,
  type MemoryRuntimePlan,
  type MemoryRuntimeReference,
  type MemoryScopeType,
} from "./memoryRuntimeTypes";

/** 참조 후보 상한(timeline·UI 비대화 방지). */
export const MEMORY_RUNTIME_REFERENCE_MAX = 12;
/** findings 상한. */
export const MEMORY_RUNTIME_FINDINGS_MAX = 6;
/** summary 문자열 최대 길이. */
const MEMORY_RUNTIME_SUMMARY_MAX = 240;

export type MemoryRuntimeTimelineEntryInput = Readonly<{
  /** ISO 또는 epoch ms. 알 수 없으면 null. */
  at?: string | number | Date | null;
  /** 메모리 후보 식별자(예: `"singleChatOrchestrationV1"`). */
  memoryId?: string | null;
  /** 출처 라벨(스코프 결정에 사용). 비어 있으면 `memoryId`를 fallback로 사용. */
  source?: string | null;
  /** 텍스트(키워드 매칭용). 보통 user/assistant message 또는 메모 요약. */
  text?: string | null;
  /** 명시적 scope override(테스트/외부 진단용). */
  scope?: MemoryScopeType | null;
}>;

export type MemoryRuntimeProjectContextInput = Readonly<{
  /** 프로젝트 식별자(있으면 project 스코프 후보를 보강). */
  projectId?: string | null;
  /** 프로젝트의 방향 키워드(예: "microservice"). 충돌 진단 입력. */
  directionalKeywords?: readonly string[] | null;
}>;

export type MemoryRuntimeWorkingContextInput = Readonly<{
  /** 현재 화면/작업 흐름 키. */
  workspaceScreenKey?: string | null;
  /** 사용자 입력 최근 텍스트(요약본). */
  recentUserText?: string | null;
}>;

export type BuildMemoryRuntimePlanInput = Readonly<{
  /** 현재 turn의 역할(예: `"planner"`). 없으면 default 정책 사용. */
  roleKey?: string | null;
  projectContext?: MemoryRuntimeProjectContextInput | null;
  recentTimelineEntries?: readonly MemoryRuntimeTimelineEntryInput[] | null;
  workingContext?: MemoryRuntimeWorkingContextInput | null;
  /** 선택: 평가 기준 시각(테스트/replay용; 미제공이면 `Date.now()`). */
  now?: number | Date | null;
  /**
   * 선택: overlay metadata에서 onset된 메모리 참조 hint.
   * `overlayContextAssembly.usedMemoryRefs`를 그대로 받아 보강한다.
   */
  overlayMetadata?: Pick<ExtractedOverlayPromptTraceMetadata, "overlayContextAssembly"> | null;
}>;

/** 분류 보조 입력(planner 내부에서만 사용). */
type ScopeClassifierContext = Readonly<{
  readonly roleKey: string | null;
  readonly workspaceScreenKey: string | null;
}>;

/**
 * Memory Runtime Plan 빌더. **결정론적·read-only**.
 */
export function buildMemoryRuntimePlan(input: BuildMemoryRuntimePlanInput): MemoryRuntimePlan {
  const policy = resolveMemoryRuntimeRolePolicy(input.roleKey ?? null);
  const now = toEpochMsOrNow(input.now);
  const directionalKeywords = normalizeKeywords(input.projectContext?.directionalKeywords ?? []);
  const classifierContext: ScopeClassifierContext = {
    roleKey: trimAndClipString(input.roleKey, 80) || null,
    workspaceScreenKey: trimAndClipString(input.workingContext?.workspaceScreenKey, 80) || null,
  };

  const collected: MemoryRuntimeReference[] = [];
  const seenIds = new Set<string>();

  // 1) Overlay에서 이미 식별된 memory refs를 우선 채택(가장 신뢰도 높음).
  for (const ref of collectOverlayMemoryReferences(input, policy, now, directionalKeywords, classifierContext)) {
    if (collected.length >= MEMORY_RUNTIME_REFERENCE_MAX) break;
    if (seenIds.has(ref.memoryId)) continue;
    seenIds.add(ref.memoryId);
    collected.push(ref);
  }

  // 2) Recent timeline에서 키워드/스코프 매치 후보 보강.
  for (const ref of collectTimelineMemoryReferences(input, policy, now, directionalKeywords, classifierContext)) {
    if (collected.length >= MEMORY_RUNTIME_REFERENCE_MAX) break;
    if (seenIds.has(ref.memoryId)) continue;
    seenIds.add(ref.memoryId);
    collected.push(ref);
  }

  // 3) Working context(현재 사용자 입력) 후보 보강.
  const workingRef = buildWorkingContextReference(input, policy);
  if (workingRef && !seenIds.has(workingRef.memoryId) && collected.length < MEMORY_RUNTIME_REFERENCE_MAX) {
    seenIds.add(workingRef.memoryId);
    collected.push(workingRef);
  }

  // 4) 결정론적 정렬: 중요도 ↓, scope 우선순위 ↑, memoryId asc.
  const scopeOrderIndex = buildScopeOrderIndex(policy.preferredScopes);
  collected.sort((a, b) => {
    if (b.estimatedImportance !== a.estimatedImportance) {
      return b.estimatedImportance - a.estimatedImportance;
    }
    const sa = scopeOrderIndex.get(a.scope) ?? Number.MAX_SAFE_INTEGER;
    const sb = scopeOrderIndex.get(b.scope) ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return a.memoryId.localeCompare(b.memoryId);
  });

  const findings = buildPlanFindings(collected, policy);

  return {
    mode: "dry_run",
    roleKey: normalizeRoleKeyForPlan(input.roleKey),
    references: collected,
    findings,
  };
}

// ── internal helpers ────────────────────────────────────────────────────────

function toEpochMsOrNow(value: number | Date | null | undefined): number {
  if (value == null) return Date.now();
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : Date.now();
  }
  return Number.isFinite(value) ? Number(value) : Date.now();
}

function normalizeRoleKeyForPlan(value: string | null | undefined): string | null {
  const raw = trimAndClipString(value, 80);
  return raw.length ? raw : null;
}

function normalizeKeywords(values: readonly string[] | null | undefined): readonly string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const s = trimAndClipString(v, 80).toLowerCase();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function buildScopeOrderIndex(scopes: readonly MemoryScopeType[]): Map<MemoryScopeType, number> {
  const map = new Map<MemoryScopeType, number>();
  scopes.forEach((scope, idx) => {
    if (!map.has(scope)) map.set(scope, idx);
  });
  return map;
}

function scopePriorityScore(scope: MemoryScopeType, policy: MemoryRuntimeRolePolicy): number {
  const idx = policy.preferredScopes.indexOf(scope);
  if (idx < 0) return 0;
  // 1순위 30점, 이후 -10씩 감소(최소 0).
  return Math.max(0, 30 - idx * 10);
}

function keywordMatchScore(text: string, policy: MemoryRuntimeRolePolicy): number {
  if (!text) return 0;
  const lower = text.toLowerCase();
  let hits = 0;
  for (const k of policy.keywordHints) {
    if (!k) continue;
    if (lower.includes(k)) hits += 1;
  }
  return Math.min(40, hits * 10);
}

function evaluateRefFreshness(opts: {
  readonly lastReferencedAt: string | number | Date | null;
  readonly text: string;
  readonly directionalKeywords: readonly string[];
  readonly now: number;
}): { freshness: MemoryFreshness; reason: string } {
  const conflict = detectMemoryRuntimeDirectionalConflict({
    memoryText: opts.text,
    currentDirectionalKeywords: opts.directionalKeywords,
  });
  const { freshness, reason } = evaluateMemoryFreshness({
    lastReferencedAt: opts.lastReferencedAt,
    now: opts.now,
    conflictDetected: conflict,
  });
  return { freshness, reason };
}

function buildSummaryFromText(text: string, fallback: string): string {
  const cleaned = trimAndClipString(text, MEMORY_RUNTIME_SUMMARY_MAX);
  return cleaned.length ? cleaned : fallback;
}

/** Overlay metadata에 기록된 `usedMemoryRefs`를 references로 승격. */
function collectOverlayMemoryReferences(
  input: BuildMemoryRuntimePlanInput,
  policy: MemoryRuntimeRolePolicy,
  now: number,
  directionalKeywords: readonly string[],
  classifierContext: ScopeClassifierContext
): readonly MemoryRuntimeReference[] {
  const overlay = input.overlayMetadata?.overlayContextAssembly;
  if (!overlay?.usedMemoryRefs?.length) return [];
  const out: MemoryRuntimeReference[] = [];
  for (const ref of overlay.usedMemoryRefs) {
    const memoryId = trimAndClipString(ref.ref, 200);
    if (!memoryId) continue;
    const scope: MemoryScopeType = classifyMemoryRuntimeScope({
      source: ref.scope,
      memoryId,
      roleKey: classifierContext.roleKey,
      workspaceScreenKey: classifierContext.workspaceScreenKey,
    });
    const summary = buildSummaryFromText(memoryId, `Overlay 기록 메모리 (${scope})`);
    const { freshness, reason } = evaluateRefFreshness({
      lastReferencedAt: null,
      text: summary,
      directionalKeywords,
      now,
    });
    const importance =
      40 +
      scopePriorityScore(scope, policy) +
      keywordMatchScore(summary, policy) +
      (freshness === "fresh" ? 10 : 0) -
      (freshness === "stale" ? 15 : 0);
    out.push({
      memoryId: `overlay:${memoryId}`,
      scope,
      summary,
      freshness,
      selectedReason: `overlay_used_memory_ref:${reason}`,
      selectedBy: "overlay_context_assembly",
      estimatedImportance: clampImportance(importance),
    });
  }
  return out;
}

function collectTimelineMemoryReferences(
  input: BuildMemoryRuntimePlanInput,
  policy: MemoryRuntimeRolePolicy,
  now: number,
  directionalKeywords: readonly string[],
  classifierContext: ScopeClassifierContext
): readonly MemoryRuntimeReference[] {
  const entries = Array.isArray(input.recentTimelineEntries) ? input.recentTimelineEntries : [];
  if (!entries.length) return [];
  const out: MemoryRuntimeReference[] = [];
  for (const entry of entries) {
    if (!entry) continue;
    const memoryIdRaw = trimAndClipString(entry.memoryId, 200);
    const sourceRaw = trimAndClipString(entry.source, 200);
    const text = trimAndClipString(entry.text, MEMORY_RUNTIME_SUMMARY_MAX);
    if (!memoryIdRaw && !sourceRaw && !text) continue;
    const memoryId = memoryIdRaw || (sourceRaw ? `source:${sourceRaw}` : `timeline:${text.slice(0, 32)}`);
    const scope: MemoryScopeType =
      (entry.scope as MemoryScopeType | null | undefined) ??
      classifyMemoryRuntimeScope({
        source: sourceRaw,
        memoryId: memoryIdRaw,
        roleKey: classifierContext.roleKey,
        workspaceScreenKey: classifierContext.workspaceScreenKey,
      });
    const summary = buildSummaryFromText(text || sourceRaw || memoryId, `최근 기록 (${scope})`);
    const { freshness, reason } = evaluateRefFreshness({
      lastReferencedAt: entry.at ?? null,
      text: summary,
      directionalKeywords,
      now,
    });
    const importance =
      20 +
      scopePriorityScore(scope, policy) +
      keywordMatchScore(summary, policy) +
      (freshness === "fresh" ? 15 : 0) -
      (freshness === "stale" ? 20 : 0);
    out.push({
      memoryId: `timeline:${memoryId}`,
      scope,
      summary,
      freshness,
      selectedReason: `recent_timeline:${reason}`,
      selectedBy: "recent_timeline",
      estimatedImportance: clampImportance(importance),
    });
  }
  return out;
}

function buildWorkingContextReference(
  input: BuildMemoryRuntimePlanInput,
  policy: MemoryRuntimeRolePolicy
): MemoryRuntimeReference | null {
  const ctx = input.workingContext;
  if (!ctx) return null;
  const text = trimAndClipString(ctx.recentUserText, MEMORY_RUNTIME_SUMMARY_MAX);
  const screen = trimAndClipString(ctx.workspaceScreenKey, 80);
  if (!text && !screen) return null;
  const summary = buildSummaryFromText(text || `현재 화면: ${screen}`, "현재 작업 컨텍스트");
  const scope: MemoryScopeType = "working";
  const importance =
    15 + scopePriorityScore(scope, policy) + keywordMatchScore(summary, policy);
  return {
    memoryId: `working:${screen || "current"}`,
    scope,
    summary,
    freshness: "fresh",
    selectedReason: "working_context",
    selectedBy: "working_context",
    estimatedImportance: clampImportance(importance),
  };
}

function clampImportance(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildPlanFindings(
  references: readonly MemoryRuntimeReference[],
  policy: MemoryRuntimeRolePolicy
): readonly MemoryRuntimeFinding[] {
  const findings: MemoryRuntimeFinding[] = [];
  if (!references.length) {
    findings.push({
      code: "no_candidates",
      severity: "info",
      message: "참조 후보 메모리를 찾지 못했습니다. 입력이 충분히 쌓이면 자동으로 보강됩니다.",
    });
    return findings.slice(0, MEMORY_RUNTIME_FINDINGS_MAX);
  }
  const staleCount = references.filter((r) => r.freshness === "stale").length;
  if (staleCount > 0) {
    findings.push({
      code: "stale_memory_detected",
      severity: "warning",
      message: `오래되었거나 현재 방향과 충돌 가능한 메모리 ${staleCount}개가 감지되었습니다.`,
    });
  }
  const scopeCount = new Set(references.map((r) => r.scope)).size;
  if (scopeCount === 1 && references.length >= 3) {
    findings.push({
      code: "scope_imbalance",
      severity: "info",
      message: "단일 스코프 메모리만 후보로 선택되어 균형이 부족할 수 있습니다.",
    });
  }
  if (policy === MEMORY_RUNTIME_DEFAULT_POLICY) {
    findings.push({
      code: "role_policy_missing",
      severity: "info",
      message: "역할별 메모리 정책이 매칭되지 않아 기본 정책으로 후보를 선택했습니다.",
    });
  }
  return findings.slice(0, MEMORY_RUNTIME_FINDINGS_MAX);
}
