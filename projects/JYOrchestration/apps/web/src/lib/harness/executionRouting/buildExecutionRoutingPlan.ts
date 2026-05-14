/**
 * Harness Phase H5 — **Execution Routing Plan Builder**.
 *
 * 역할 + provider hint + workspace stage를 입력으로 받아 "어떤 capability를 어느 provider로
 * 처리할지"를 planning metadata로 구성한다.
 *
 * **절대 원칙(읽기 전용):**
 * - 실제 provider switching·execution routing·Cursor execution·GitHub operation 등 어디에도 영향 없음.
 * - 결정론적 정렬: 같은 입력은 같은 items 순서를 생성한다.
 * - 결과는 항상 `mode === "dry_run"` planning metadata.
 */

import { trimAndClipString } from "@/lib/harness/promptAssembly/internal/harnessPromptAssemblyStrings";

import type {
  ExecutionCapability,
  ExecutionProviderType,
  ExecutionRoutingFinding,
  ExecutionRoutingPlan,
  ExecutionRoutingPlanItem,
} from "./executionCapabilityTypes";
import {
  EXECUTION_PROVIDER_KEYS,
} from "./executionCapabilityTypes";
import {
  EXECUTION_ROUTING_DEFAULT_POLICY,
  normalizeExecutionRoutingRoleKey,
  resolveExecutionRoutingRolePolicy,
} from "./executionRoutingRolePolicy";
import {
  providerSupportsCapability,
  resolveRecommendedProviderForCapability,
} from "./providerCapabilityMatrix";

/** plan items 상한(timeline·UI 비대화 방지). */
export const EXECUTION_ROUTING_ITEMS_MAX = 24;
/** findings 상한. */
export const EXECUTION_ROUTING_FINDINGS_MAX = 6;
/** 외부 provider hint 입력 길이 상한(개수). */
const EXECUTION_ROUTING_PROVIDER_HINTS_MAX = 8;

export type BuildExecutionRoutingPlanInput = Readonly<{
  /** 현재 turn의 역할(예: `planner`). 빈 값이면 default 정책(빈 capability) 사용. */
  roleKey?: string | null;
  /** 사용자/오케스트레이션이 제시한 provider 후보(예: ["openai", "cursor"]). 비어 있으면 정책 기반 추천. */
  providerHints?: readonly (string | null | undefined)[] | null;
  /** 프로젝트 단계 키(예: `prototype-build`). 현재는 metadata 전달만; 정책 분기 없음. */
  workspaceStage?: string | null;
}>;

/** Execution Routing Plan 빌더. **결정론적·read-only**. */
export function buildExecutionRoutingPlan(
  input: BuildExecutionRoutingPlanInput
): ExecutionRoutingPlan {
  const normalizedRoleKey = normalizeExecutionRoutingRoleKey(input.roleKey ?? null);
  const roleKeyForPlan = trimAndClipString(input.roleKey, 80) || null;
  const workspaceStage = trimAndClipString(input.workspaceStage, 80) || null;
  const capabilities = resolveExecutionRoutingRolePolicy(input.roleKey ?? null);
  const providerHints = normalizeProviderHints(input.providerHints ?? []);

  const items: ExecutionRoutingPlanItem[] = [];
  const seen = new Set<string>();

  for (const capability of capabilities) {
    const item = buildPlanItem({
      roleKey: roleKeyForPlan ?? normalizedRoleKey,
      capability,
      providerHints,
    });
    const key = `${item.roleKey}|${item.capability}|${item.provider}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
    if (items.length >= EXECUTION_ROUTING_ITEMS_MAX) break;
  }

  // 결정론 정렬: capability asc → provider asc(추가 결정론).
  items.sort((a, b) => {
    if (a.capability !== b.capability) return a.capability < b.capability ? -1 : 1;
    if (a.provider !== b.provider) return a.provider < b.provider ? -1 : 1;
    return 0;
  });

  const findings = buildPlanFindings({
    normalizedRoleKey,
    capabilities,
    items,
    providerHints,
  });

  return {
    mode: "dry_run",
    roleKey: roleKeyForPlan,
    workspaceStage,
    items,
    findings,
  };
}

// ── internal helpers ────────────────────────────────────────────────────────

function normalizeProviderHints(
  values: readonly (string | null | undefined)[]
): readonly ExecutionProviderType[] {
  if (!Array.isArray(values)) return [];
  const out: ExecutionProviderType[] = [];
  const seen = new Set<ExecutionProviderType>();
  for (const v of values) {
    const lower = trimAndClipString(v, 32).toLowerCase();
    if (!lower) continue;
    const candidate = (EXECUTION_PROVIDER_KEYS as readonly string[]).includes(lower)
      ? (lower as ExecutionProviderType)
      : null;
    if (!candidate) continue;
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    out.push(candidate);
    if (out.length >= EXECUTION_ROUTING_PROVIDER_HINTS_MAX) break;
  }
  return out;
}

function buildPlanItem(args: {
  readonly roleKey: string;
  readonly capability: ExecutionCapability;
  readonly providerHints: readonly ExecutionProviderType[];
}): ExecutionRoutingPlanItem {
  const recommended = resolveRecommendedProviderForCapability(args.capability);
  const hintMatch = args.providerHints.find((p) =>
    providerSupportsCapability(p, args.capability)
  );
  // 결정 우선순위(provider 사용자 의도를 존중):
  // 1) hint 중 capability를 지원하는 첫 항목 → 사용 + enabled=true
  // 2) hint는 있으나 어떤 hint도 지원하지 않음 → 첫 hint 채택 + enabled=false + warning (사용자 의도 노출)
  // 3) hint 없음 + 추천 가능 → 추천 사용 + enabled=true
  // 4) 그 외(추천 없음, hint 없음) → "unknown" + enabled=false + warning
  let provider: ExecutionProviderType;
  let reason: string;
  if (hintMatch) {
    provider = hintMatch;
    reason = `provider_hint_matched:${hintMatch}`;
  } else if (args.providerHints.length > 0) {
    provider = args.providerHints[0]!;
    reason = `provider_hint_unsupported:${provider}`;
  } else if (recommended !== "unknown") {
    provider = recommended;
    reason = `role_policy_recommended:${recommended}`;
  } else {
    provider = "unknown";
    reason = "no_provider_recommendation";
  }
  const supported = providerSupportsCapability(provider, args.capability);
  const warning = supported
    ? undefined
    : provider === "unknown"
      ? "Provider 추천이 불명확합니다. matrix에 capability 매핑이 없습니다."
      : `provider '${provider}' does not support capability '${args.capability}'.`;
  return {
    roleKey: args.roleKey,
    capability: args.capability,
    provider,
    enabled: supported,
    reason,
    ...(warning ? { warning } : {}),
  };
}

function buildPlanFindings(args: {
  readonly normalizedRoleKey: string;
  readonly capabilities: readonly ExecutionCapability[];
  readonly items: readonly ExecutionRoutingPlanItem[];
  readonly providerHints: readonly ExecutionProviderType[];
}): readonly ExecutionRoutingFinding[] {
  const findings: ExecutionRoutingFinding[] = [];

  if (args.capabilities === EXECUTION_ROUTING_DEFAULT_POLICY || !args.capabilities.length) {
    findings.push({
      code: "NO_ROLE_POLICY_MATCH",
      severity: "info",
      message: args.normalizedRoleKey
        ? `역할 '${args.normalizedRoleKey}'에 매칭되는 execution capability 정책이 없습니다.`
        : "역할이 비어 있어 capability 정책을 매칭하지 못했습니다.",
    });
  }

  if (args.providerHints.length === 0 && args.items.length > 0) {
    findings.push({
      code: "NO_PROVIDER_HINTS",
      severity: "info",
      message:
        "외부 provider 힌트가 없어 capability별 추천 provider만 사용했습니다(정책 기반 metadata).",
    });
  }

  const unsupported = args.items.filter((i) => !i.enabled);
  if (unsupported.length > 0) {
    findings.push({
      code: "UNSUPPORTED_CAPABILITY",
      severity: "warning",
      message: `provider matrix가 지원하지 않는 capability ${unsupported.length}건이 감지되었습니다.`,
    });
  }

  return findings.slice(0, EXECUTION_ROUTING_FINDINGS_MAX);
}
