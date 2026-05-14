/**
 * Harness Phase H5 — **Execution Routing metadata coercer**.
 *
 * 저장/네트워크에서 받은 unknown raw 값을 안전하게 `ExecutionRoutingPlan`로 변환한다.
 * replay/diagnostic 호출부에서 malformed 입력이 들어와도 호출부 shape이 깨지지 않도록 한다.
 */

import { trimAndClipString } from "@/lib/harness/promptAssembly/internal/harnessPromptAssemblyStrings";

import {
  EXECUTION_CAPABILITY_KEYS,
  EXECUTION_PROVIDER_KEYS,
  type ExecutionCapability,
  type ExecutionProviderType,
  type ExecutionRoutingFinding,
  type ExecutionRoutingFindingSeverity,
  type ExecutionRoutingPlan,
  type ExecutionRoutingPlanItem,
} from "./executionCapabilityTypes";

const MAX_ITEMS = 64;
const MAX_FINDINGS = 16;
const ROLE_KEY_MAX = 80;
const STAGE_MAX = 80;
const REASON_MAX = 120;
const WARNING_MAX = 200;
const FINDING_CODE_MAX = 80;
const FINDING_MESSAGE_MAX = 240;

const SEVERITY_VALUES: readonly ExecutionRoutingFindingSeverity[] = ["info", "warning"];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function parseCapability(value: unknown): ExecutionCapability | null {
  const s = typeof value === "string" ? value.trim() : "";
  return (EXECUTION_CAPABILITY_KEYS as readonly string[]).includes(s)
    ? (s as ExecutionCapability)
    : null;
}

function parseProvider(value: unknown): ExecutionProviderType | null {
  const s = typeof value === "string" ? value.trim() : "";
  return (EXECUTION_PROVIDER_KEYS as readonly string[]).includes(s)
    ? (s as ExecutionProviderType)
    : null;
}

function parseSeverity(value: unknown): ExecutionRoutingFindingSeverity | null {
  const s = typeof value === "string" ? value.trim() : "";
  return (SEVERITY_VALUES as readonly string[]).includes(s)
    ? (s as ExecutionRoutingFindingSeverity)
    : null;
}

function parseItem(value: unknown): ExecutionRoutingPlanItem | null {
  const r = asRecord(value);
  if (!r) return null;
  const roleKey = trimAndClipString(r.roleKey, ROLE_KEY_MAX);
  if (!roleKey) return null;
  const capability = parseCapability(r.capability);
  if (!capability) return null;
  const reason = trimAndClipString(r.reason, REASON_MAX);
  if (!reason) return null;
  // invalid provider → "unknown" fallback(replay 안정성). Row 자체 drop은 capability/role 누락 시에만.
  const provider = parseProvider(r.provider) ?? "unknown";
  const enabled = r.enabled === true;
  const warningRaw = trimAndClipString(r.warning, WARNING_MAX);
  return {
    roleKey,
    capability,
    provider,
    enabled,
    reason,
    ...(warningRaw ? { warning: warningRaw } : {}),
  };
}

function parseFinding(value: unknown): ExecutionRoutingFinding | null {
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
 * unknown raw → `ExecutionRoutingPlan | null`.
 *
 * - `mode`는 `"dry_run"`만 허용. 그 외(예: `apply`)는 null.
 * - 필수 필드(roleKey/capability/reason) 누락 row는 drop.
 * - invalid provider는 `"unknown"` fallback. invalid severity는 finding drop.
 * - items/findings 상한 cap.
 */
export function parseExecutionRoutingPlanFromUnknown(raw: unknown): ExecutionRoutingPlan | null {
  const r = asRecord(raw);
  if (!r) return null;
  if (r.mode !== "dry_run") return null;
  const itemsRaw = Array.isArray(r.items) ? r.items : [];
  const findingsRaw = Array.isArray(r.findings) ? r.findings : [];

  const items: ExecutionRoutingPlanItem[] = [];
  for (const item of itemsRaw) {
    const parsed = parseItem(item);
    if (parsed) items.push(parsed);
    if (items.length >= MAX_ITEMS) break;
  }
  const findings: ExecutionRoutingFinding[] = [];
  for (const item of findingsRaw) {
    const parsed = parseFinding(item);
    if (parsed) findings.push(parsed);
    if (findings.length >= MAX_FINDINGS) break;
  }

  const roleKey = trimAndClipString(r.roleKey, ROLE_KEY_MAX);
  const workspaceStage = trimAndClipString(r.workspaceStage, STAGE_MAX);
  return {
    mode: "dry_run",
    roleKey: roleKey.length ? roleKey : null,
    workspaceStage: workspaceStage.length ? workspaceStage : null,
    items,
    findings,
  };
}

export type CoercedExecutionRoutingMetadata = Readonly<{
  executionRoutingPlan?: ExecutionRoutingPlan;
}>;

/**
 * 단일 timeline row의 `executionRoutingPlan` 필드만 안전하게 coerce.
 * `Object.assign(out, coerceExecutionRoutingMetadata(row))`로 사용.
 */
export function coerceExecutionRoutingMetadata(
  raw: Record<string, unknown> | null | undefined
): CoercedExecutionRoutingMetadata {
  if (!raw || typeof raw !== "object") return {};
  const parsed = parseExecutionRoutingPlanFromUnknown(raw.executionRoutingPlan);
  return parsed ? { executionRoutingPlan: parsed } : {};
}
