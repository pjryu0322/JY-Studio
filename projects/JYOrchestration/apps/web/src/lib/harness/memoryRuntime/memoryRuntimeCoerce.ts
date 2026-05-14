/**
 * Harness Phase H4 Preparation — **Memory Runtime metadata coercer**.
 *
 * 저장/네트워크에서 받은 unknown raw 값을 안전하게 `MemoryRuntimePlan`로 변환한다.
 * replay/diagnostic 호출부에서 malformed 입력이 들어와도 호출부 shape이 깨지지 않도록 한다.
 */

import {
  coerceNonNegInt,
  trimAndClipString,
} from "@/lib/harness/promptAssembly/internal/harnessPromptAssemblyStrings";
import type {
  MemoryFreshness,
  MemoryRuntimeFinding,
  MemoryRuntimeFindingSeverity,
  MemoryRuntimePlan,
  MemoryRuntimeReference,
  MemoryScopeType,
} from "./memoryRuntimeTypes";

const MEMORY_SCOPE_VALUES: readonly MemoryScopeType[] = [
  "platform",
  "project",
  "role",
  "session",
  "working",
];
const MEMORY_FRESHNESS_VALUES: readonly MemoryFreshness[] = ["fresh", "aging", "stale"];
const MEMORY_FINDING_SEVERITIES: readonly MemoryRuntimeFindingSeverity[] = ["info", "warning"];

const MAX_REFERENCES = 64;
const MAX_FINDINGS = 16;
const MEMORY_ID_MAX = 200;
const SUMMARY_MAX = 240;
const REASON_MAX = 80;
const SELECTED_BY_MAX = 80;
const FINDING_CODE_MAX = 80;
const FINDING_MESSAGE_MAX = 240;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function parseMemoryScope(value: unknown): MemoryScopeType | null {
  const s = typeof value === "string" ? value.trim() : "";
  return (MEMORY_SCOPE_VALUES as readonly string[]).includes(s) ? (s as MemoryScopeType) : null;
}

function parseFreshness(value: unknown): MemoryFreshness | null {
  const s = typeof value === "string" ? value.trim() : "";
  return (MEMORY_FRESHNESS_VALUES as readonly string[]).includes(s) ? (s as MemoryFreshness) : null;
}

function parseSeverity(value: unknown): MemoryRuntimeFindingSeverity | null {
  const s = typeof value === "string" ? value.trim() : "";
  return (MEMORY_FINDING_SEVERITIES as readonly string[]).includes(s)
    ? (s as MemoryRuntimeFindingSeverity)
    : null;
}

function parseReference(value: unknown): MemoryRuntimeReference | null {
  const r = asRecord(value);
  if (!r) return null;
  const memoryId = trimAndClipString(r.memoryId, MEMORY_ID_MAX);
  if (!memoryId) return null;
  const summary = trimAndClipString(r.summary, SUMMARY_MAX);
  if (!summary) return null;
  const selectedReason = trimAndClipString(r.selectedReason, REASON_MAX);
  if (!selectedReason) return null;
  const selectedBy = trimAndClipString(r.selectedBy, SELECTED_BY_MAX);
  if (!selectedBy) return null;
  // H4.5: scope/freshness가 invalid면 보수적 fallback(`working` / `aging`)으로 흡수.
  // → row 전체 drop을 피해 replay 안정성 확보. 실제 값에 영향 없음(planning metadata only).
  const scope = parseMemoryScope(r.scope) ?? "working";
  const freshness = parseFreshness(r.freshness) ?? "aging";
  const estimatedImportance = Math.min(100, coerceNonNegInt(r.estimatedImportance, 0));
  return { memoryId, scope, summary, freshness, selectedReason, selectedBy, estimatedImportance };
}

function parseFinding(value: unknown): MemoryRuntimeFinding | null {
  const r = asRecord(value);
  if (!r) return null;
  const code = trimAndClipString(r.code, FINDING_CODE_MAX);
  if (!code) return null;
  const severity = parseSeverity(r.severity);
  if (!severity) return null;
  const message = trimAndClipString(r.message, FINDING_MESSAGE_MAX);
  if (!message) return null;
  return { code, severity, message };
}

/**
 * unknown raw → `MemoryRuntimePlan | null`.
 *
 * - `mode`는 `"dry_run"`만 허용.
 * - 잘못된 reference/finding은 조용히 drop.
 * - reference/finding 상한을 강제(`MAX_REFERENCES`/`MAX_FINDINGS`).
 */
export function parseMemoryRuntimePlanFromUnknown(raw: unknown): MemoryRuntimePlan | null {
  const r = asRecord(raw);
  if (!r) return null;
  if (r.mode !== "dry_run") return null;
  const refsRaw = Array.isArray(r.references) ? r.references : [];
  const findingsRaw = Array.isArray(r.findings) ? r.findings : [];
  const references: MemoryRuntimeReference[] = [];
  for (const item of refsRaw) {
    const parsed = parseReference(item);
    if (parsed) references.push(parsed);
    if (references.length >= MAX_REFERENCES) break;
  }
  const findings: MemoryRuntimeFinding[] = [];
  for (const item of findingsRaw) {
    const parsed = parseFinding(item);
    if (parsed) findings.push(parsed);
    if (findings.length >= MAX_FINDINGS) break;
  }
  const roleKeyTrimmed = trimAndClipString(r.roleKey, 80);
  return {
    mode: "dry_run",
    roleKey: roleKeyTrimmed.length ? roleKeyTrimmed : null,
    references,
    findings,
  };
}

export type CoercedMemoryRuntimeMetadata = Readonly<{
  memoryRuntimePlan?: MemoryRuntimePlan;
}>;

/**
 * 단일 timeline row의 `memoryRuntimePlan` 필드만 안전하게 coerce.
 * `Object.assign(out, coerceMemoryRuntimeMetadata(row))`로 사용.
 */
export function coerceMemoryRuntimeMetadata(
  raw: Record<string, unknown> | null | undefined
): CoercedMemoryRuntimeMetadata {
  if (!raw || typeof raw !== "object") return {};
  const parsed = parseMemoryRuntimePlanFromUnknown(raw.memoryRuntimePlan);
  return parsed ? { memoryRuntimePlan: parsed } : {};
}
