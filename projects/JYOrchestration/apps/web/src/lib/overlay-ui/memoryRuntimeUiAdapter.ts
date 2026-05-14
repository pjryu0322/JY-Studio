/**
 * Harness Phase H4 Preparation — **Memory Runtime UI adapter**.
 *
 * `MemoryRuntimePlan` → 사용자 표현 ViewModel. 순수 함수, read-only display.
 *
 * 사용자에게 "실제 long-term memory" 같은 과장 표현 금지. **planning/diagnostic** 표현 유지.
 */

import type {
  MemoryFreshness,
  MemoryRuntimeFinding,
  MemoryRuntimeFindingSeverity,
  MemoryRuntimePlan,
  MemoryRuntimeReference,
  MemoryScopeType,
} from "@/lib/harness/memoryRuntime/memoryRuntimeTypes";
import { OVERLAY_UI_MISSING_LABEL, formatKoreanInt } from "@/lib/overlay-ui/overlayUiFormat";
import type { OverlayUiBadgeTone } from "@/lib/overlay-ui/overlayUiLabel";

/** "실제 long-term memory가 아닌 planning metadata"임을 노출하는 공식 안내 문구. */
export const MEMORY_RUNTIME_PLAN_DISCLAIMER =
  "이 표시는 실제 장기 기억이 아니라, 이번 턴에서 AI가 참조 후보로 삼은 메모리 계획입니다.";

const SCOPE_LABEL: Readonly<Record<MemoryScopeType, string>> = {
  platform: "플랫폼",
  project: "프로젝트",
  role: "역할",
  session: "세션",
  working: "작업 컨텍스트",
};

const SCOPE_TONE: Readonly<Record<MemoryScopeType, OverlayUiBadgeTone>> = {
  platform: "neutral",
  project: "info",
  role: "info",
  session: "neutral",
  working: "positive",
};

const FRESHNESS_LABEL: Readonly<Record<MemoryFreshness, string>> = {
  fresh: "최신",
  aging: "유의",
  stale: "오래됨",
};

const FRESHNESS_TONE: Readonly<Record<MemoryFreshness, OverlayUiBadgeTone>> = {
  fresh: "positive",
  aging: "info",
  stale: "warning",
};

const SEVERITY_LABEL: Readonly<Record<MemoryRuntimeFindingSeverity, string>> = {
  info: "안내",
  warning: "주의",
};

export function memoryRuntimeScopeLabel(scope: MemoryScopeType): string {
  return SCOPE_LABEL[scope] ?? "기타";
}

export function memoryRuntimeScopeTone(scope: MemoryScopeType): OverlayUiBadgeTone {
  return SCOPE_TONE[scope] ?? "neutral";
}

export function memoryRuntimeFreshnessLabel(freshness: MemoryFreshness): string {
  return FRESHNESS_LABEL[freshness] ?? "유의";
}

export function memoryRuntimeFreshnessTone(freshness: MemoryFreshness): OverlayUiBadgeTone {
  return FRESHNESS_TONE[freshness] ?? "neutral";
}

export function memoryRuntimeFindingSeverityLabel(
  severity: MemoryRuntimeFindingSeverity
): string {
  return SEVERITY_LABEL[severity] ?? "안내";
}

export type MemoryRuntimeReferenceVM = Readonly<{
  memoryId: string;
  scope: MemoryScopeType;
  scopeLabel: string;
  scopeTone: OverlayUiBadgeTone;
  freshness: MemoryFreshness;
  freshnessLabel: string;
  freshnessTone: OverlayUiBadgeTone;
  summary: string;
  selectedReasonLabel: string;
  selectedByLabel: string;
  estimatedImportanceLabel: string;
}>;

export type MemoryRuntimeFindingVM = Readonly<{
  code: string;
  severity: MemoryRuntimeFindingSeverity;
  severityLabel: string;
  message: string;
}>;

export type MemoryRuntimePlanVM = Readonly<{
  hasData: boolean;
  disclaimer: string;
  roleLabel: string;
  totalLabel: string;
  freshLabel: string;
  agingLabel: string;
  staleLabel: string;
  scopeBreakdownText: string;
  references: readonly MemoryRuntimeReferenceVM[];
  findings: readonly MemoryRuntimeFindingVM[];
}>;

function toReferenceVM(ref: MemoryRuntimeReference): MemoryRuntimeReferenceVM {
  return {
    memoryId: ref.memoryId,
    scope: ref.scope,
    scopeLabel: memoryRuntimeScopeLabel(ref.scope),
    scopeTone: memoryRuntimeScopeTone(ref.scope),
    freshness: ref.freshness,
    freshnessLabel: memoryRuntimeFreshnessLabel(ref.freshness),
    freshnessTone: memoryRuntimeFreshnessTone(ref.freshness),
    summary: ref.summary,
    selectedReasonLabel: `사유: ${ref.selectedReason}`,
    selectedByLabel: `선택자: ${ref.selectedBy}`,
    estimatedImportanceLabel: `중요도 ${formatKoreanInt(ref.estimatedImportance)}`,
  };
}

function toFindingVM(f: MemoryRuntimeFinding): MemoryRuntimeFindingVM {
  return {
    code: f.code,
    severity: f.severity,
    severityLabel: memoryRuntimeFindingSeverityLabel(f.severity),
    message: f.message,
  };
}

function buildScopeBreakdownText(refs: readonly MemoryRuntimeReference[]): string {
  if (!refs.length) return "후보 없음";
  const counts: Record<MemoryScopeType, number> = {
    platform: 0,
    project: 0,
    role: 0,
    session: 0,
    working: 0,
  };
  for (const r of refs) counts[r.scope] = (counts[r.scope] ?? 0) + 1;
  const parts = (Object.keys(counts) as MemoryScopeType[])
    .filter((scope) => counts[scope] > 0)
    .map((scope) => `${memoryRuntimeScopeLabel(scope)} ${formatKoreanInt(counts[scope])}`);
  return parts.length ? parts.join(" · ") : "후보 없음";
}

/**
 * `MemoryRuntimePlan` → UI VM.
 *
 * - plan이 null/undefined 또는 mode 잘못 → `hasData: false` 안전 fallback.
 */
export function buildMemoryRuntimePlanVM(
  plan: MemoryRuntimePlan | null | undefined
): MemoryRuntimePlanVM {
  const safe = plan && plan.mode === "dry_run" ? plan : null;
  if (!safe) {
    return {
      hasData: false,
      disclaimer: MEMORY_RUNTIME_PLAN_DISCLAIMER,
      roleLabel: `역할: ${OVERLAY_UI_MISSING_LABEL}`,
      totalLabel: "후보 0개",
      freshLabel: "최신 0",
      agingLabel: "유의 0",
      staleLabel: "오래됨 0",
      scopeBreakdownText: "후보 없음",
      references: [],
      findings: [],
    };
  }
  let fresh = 0;
  let aging = 0;
  let stale = 0;
  for (const r of safe.references) {
    if (r.freshness === "fresh") fresh += 1;
    else if (r.freshness === "aging") aging += 1;
    else if (r.freshness === "stale") stale += 1;
  }
  return {
    hasData: safe.references.length > 0 || safe.findings.length > 0,
    disclaimer: MEMORY_RUNTIME_PLAN_DISCLAIMER,
    roleLabel: `역할: ${safe.roleKey?.length ? safe.roleKey : OVERLAY_UI_MISSING_LABEL}`,
    totalLabel: `후보 ${formatKoreanInt(safe.references.length)}개`,
    freshLabel: `최신 ${formatKoreanInt(fresh)}`,
    agingLabel: `유의 ${formatKoreanInt(aging)}`,
    staleLabel: `오래됨 ${formatKoreanInt(stale)}`,
    scopeBreakdownText: buildScopeBreakdownText(safe.references),
    references: safe.references.map(toReferenceVM),
    findings: safe.findings.map(toFindingVM),
  };
}
