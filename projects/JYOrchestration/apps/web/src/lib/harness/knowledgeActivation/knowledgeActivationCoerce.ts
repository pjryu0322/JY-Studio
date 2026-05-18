/**
 * Harness Phase H3 — **Knowledge Activation metadata coercer**.
 *
 * 저장/네트워크에서 받은 unknown raw 값을 안전하게 `KnowledgeActivationPlan`로 변환한다.
 * replay/diagnostic 호출부에서 malformed 입력이 들어와도 호출부 shape이 깨지지 않도록 한다.
 */

import {
  coerceNonNegInt,
  trimAndClipString,
} from "@/lib/harness/promptAssembly/internal/harnessPromptAssemblyStrings";

import type {
  KnowledgeActivationFinding,
  KnowledgeActivationFindingSeverity,
  KnowledgeActivationPlan,
  KnowledgeActivationPlanItem,
  KnowledgeActivationPriority,
  KnowledgeActivationReasonType,
} from "./knowledgeActivationPolicyTypes";

const PRIORITY_VALUES: readonly KnowledgeActivationPriority[] = ["required", "recommended", "optional"];
const REASON_TYPE_VALUES: readonly KnowledgeActivationReasonType[] = [
  "role_policy",
  "stage_policy",
  "task_type_policy",
  "project_context",
  "manual_selection",
  "safety_requirement",
  "existing_hint",
];
const FINDING_SEVERITIES: readonly KnowledgeActivationFindingSeverity[] = ["info", "warning"];

const MAX_ITEMS = 64;
const MAX_FINDINGS = 16;
const PACK_ID_MAX = 200;
const REASON_LABEL_MAX = 200;
const FINDING_MESSAGE_MAX = 240;
const FINDING_CODE_MAX = 80;
const CONTEXT_FIELD_MAX = 80;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parsePriority(value: unknown): KnowledgeActivationPriority | null {
  const s = typeof value === "string" ? value.trim() : "";
  return (PRIORITY_VALUES as readonly string[]).includes(s)
    ? (s as KnowledgeActivationPriority)
    : null;
}

function parseReasonType(value: unknown): KnowledgeActivationReasonType | null {
  const s = typeof value === "string" ? value.trim() : "";
  return (REASON_TYPE_VALUES as readonly string[]).includes(s)
    ? (s as KnowledgeActivationReasonType)
    : null;
}

function parseSeverity(value: unknown): KnowledgeActivationFindingSeverity | null {
  const s = typeof value === "string" ? value.trim() : "";
  return (FINDING_SEVERITIES as readonly string[]).includes(s)
    ? (s as KnowledgeActivationFindingSeverity)
    : null;
}

function parseItem(value: unknown): KnowledgeActivationPlanItem | null {
  const r = asRecord(value);
  if (!r) return null;
  const knowledgePackId = trimAndClipString(r.knowledgePackId, PACK_ID_MAX);
  if (!knowledgePackId) return null;
  // priority 잘못된 값은 optional로 fallback(완전 drop이 아니라 안전 demotion).
  const priority = parsePriority(r.priority) ?? "optional";
  // reasonType 잘못된 값은 drop(분류 불명확한 항목은 노출하지 않음).
  const reasonType = parseReasonType(r.reasonType);
  if (!reasonType) return null;
  const reasonLabel = trimAndClipString(r.reasonLabel, REASON_LABEL_MAX);
  if (!reasonLabel) return null;
  const roleKey = trimAndClipString(r.roleKey, CONTEXT_FIELD_MAX);
  const workspaceStage = trimAndClipString(r.workspaceStage, CONTEXT_FIELD_MAX);
  const taskType = trimAndClipString(r.taskType, CONTEXT_FIELD_MAX);
  return {
    knowledgePackId,
    priority,
    reasonType,
    reasonLabel,
    ...(roleKey ? { roleKey } : {}),
    ...(workspaceStage ? { workspaceStage } : {}),
    ...(taskType ? { taskType } : {}),
  };
}

function parseFinding(value: unknown): KnowledgeActivationFinding | null {
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
 * unknown raw → `KnowledgeActivationPlan | null`.
 *
 * - `mode`는 `"dry_run"`만 허용.
 * - 잘못된 item은 drop, priority는 optional로 fallback.
 * - items / findings 상한 강제(`MAX_ITEMS` / `MAX_FINDINGS`).
 */
export function parseKnowledgeActivationPlanFromUnknown(
  raw: unknown
): KnowledgeActivationPlan | null {
  const r = asRecord(raw);
  if (!r) return null;
  if (r.mode !== "dry_run") return null;
  // coerceNonNegInt는 직접 사용처가 없지만 미래 확장(예: priorityWeight) 대비 import 유지.
  void coerceNonNegInt;
  const itemsRaw = Array.isArray(r.items) ? r.items : [];
  const findingsRaw = Array.isArray(r.findings) ? r.findings : [];
  const items: KnowledgeActivationPlanItem[] = [];
  for (const item of itemsRaw) {
    const parsed = parseItem(item);
    if (parsed) items.push(parsed);
    if (items.length >= MAX_ITEMS) break;
  }
  const findings: KnowledgeActivationFinding[] = [];
  for (const item of findingsRaw) {
    const parsed = parseFinding(item);
    if (parsed) findings.push(parsed);
    if (findings.length >= MAX_FINDINGS) break;
  }
  const roleKey = trimAndClipString(r.roleKey, CONTEXT_FIELD_MAX);
  const workspaceStage = trimAndClipString(r.workspaceStage, CONTEXT_FIELD_MAX);
  const taskType = trimAndClipString(r.taskType, CONTEXT_FIELD_MAX);
  return {
    mode: "dry_run",
    roleKey: roleKey.length ? roleKey : null,
    workspaceStage: workspaceStage.length ? workspaceStage : null,
    taskType: taskType.length ? taskType : null,
    items,
    findings,
  };
}

export type CoercedKnowledgeActivationMetadata = Readonly<{
  knowledgeActivationPlan?: KnowledgeActivationPlan;
}>;

/**
 * 단일 timeline row의 `knowledgeActivationPlan` 필드만 안전하게 coerce.
 * `Object.assign(out, coerceKnowledgeActivationMetadata(row))`로 사용.
 */
export function coerceKnowledgeActivationMetadata(
  raw: Record<string, unknown> | null | undefined
): CoercedKnowledgeActivationMetadata {
  if (!raw || typeof raw !== "object") return {};
  const parsed = parseKnowledgeActivationPlanFromUnknown(raw.knowledgeActivationPlan);
  return parsed ? { knowledgeActivationPlan: parsed } : {};
}
