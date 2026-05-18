/**
 * Harness Phase H5.5 — **Execution Routing Safety Evaluator**.
 *
 * `ExecutionRoutingPlan`을 입력으로 dry-run safety report를 산출한다.
 *
 * **절대 원칙(읽기 전용):**
 * - 실제 apply 판단 아님 — `unsafe_to_apply`도 어떤 자동 차단/routing/execution을 발생시키지 않는다.
 * - safety diagnostic only — 결과는 metadata로만 사용. UI는 라벨링·경고 배너로 노출.
 * - 결정론적: 같은 입력은 같은 결과.
 */

import type {
  ExecutionCapability,
  ExecutionRoutingPlan,
  ExecutionRoutingPlanItem,
} from "./executionCapabilityTypes";
import type {
  ExecutionRoutingSafetyFinding,
  ExecutionRoutingSafetyReport,
  ExecutionRoutingSafetyStatus,
} from "./executionRoutingSafetyTypes";
import { emptyExecutionRoutingSafetyReport } from "./executionRoutingSafetyTypes";

/**
 * unsafe rate 임계값. **H5.5 안정화 임계** — 0.5 이상이면 적용 부적합으로 진단.
 *
 * 변경 시 문서(`OVERLAY_ARCHITECTURE_CONTRACTS.md` / `platform-structure-diagnosis.md`)와
 * UI 카피를 함께 갱신해야 한다.
 */
export const EXECUTION_ROUTING_SAFETY_UNSAFE_RATE = 0.5;

/** "민감 capability" — provider가 `unknown`이면 곧바로 unsafe로 진단한다. */
const SENSITIVE_CAPABILITIES_FOR_UNKNOWN_PROVIDER: ReadonlySet<ExecutionCapability> = new Set([
  "cursor_execution",
  "github_operation",
]);

export type EvaluateExecutionRoutingSafetyInput = Readonly<{
  /** H5 builder가 만든 plan(없으면 empty fallback). */
  plan: ExecutionRoutingPlan | null | undefined;
}>;

/**
 * Execution Routing Safety Evaluator. **결정론적·read-only**.
 *
 * 판단 기준:
 * - `unsafe_to_apply`: plan.mode !== "dry_run" / disabled ≥ 50% / warning ≥ 50% /
 *   `unknown` provider + 민감 capability(cursor_execution|github_operation) 동시 존재.
 * - `watch`: disabled ≥ 1 / warning ≥ 1 / hint 기반 unsupported(`provider_hint_unsupported:*`) 존재.
 * - `safe_dry_run`: 그 외.
 */
export function evaluateExecutionRoutingSafety(
  input: EvaluateExecutionRoutingSafetyInput
): ExecutionRoutingSafetyReport {
  const plan = input.plan;
  if (!plan || plan.mode !== "dry_run" || !Array.isArray(plan.items)) {
    const base = emptyExecutionRoutingSafetyReport();
    if (plan && plan.mode !== "dry_run") {
      return {
        ...base,
        status: "unsafe_to_apply",
        findings: [
          {
            code: "MODE_NOT_DRY_RUN",
            severity: "warning",
            message: "Execution Routing Plan의 mode가 dry_run이 아닙니다. 적용 후보로 사용하지 마세요.",
          },
        ],
      };
    }
    return base;
  }

  const items = plan.items;
  const totalItems = items.length;
  const disabledItems = items.filter((i) => !i.enabled);
  const warningItems = items.filter((i) => typeof i.warning === "string" && i.warning.length > 0);
  const unsupportedHintItems = items.filter((i) => i.reason.startsWith("provider_hint_unsupported:"));
  const unknownProviderSensitiveItems = items.filter(
    (i) => i.provider === "unknown" && SENSITIVE_CAPABILITIES_FOR_UNKNOWN_PROVIDER.has(i.capability)
  );
  const providerHintItems = items.filter(
    (i) =>
      i.reason.startsWith("provider_hint_matched:") ||
      i.reason.startsWith("provider_hint_unsupported:")
  );

  const disabledRate = totalItems > 0 ? disabledItems.length / totalItems : 0;
  const warningRate = totalItems > 0 ? warningItems.length / totalItems : 0;

  const findings = buildFindings({
    items,
    disabledItems,
    warningItems,
    unsupportedHintItems,
    unknownProviderSensitiveItems,
    disabledRate,
    warningRate,
  });

  const status = decideStatus({
    disabledRate,
    warningRate,
    disabledItemCount: disabledItems.length,
    warningItemCount: warningItems.length,
    unsupportedHintCount: unsupportedHintItems.length,
    unknownProviderSensitiveCount: unknownProviderSensitiveItems.length,
  });

  return {
    mode: "dry_run_safety",
    status,
    providerSwitchingEnabled: false,
    executionBlockingEnabled: false,
    automaticExecutionEnabled: false,
    unsupportedCapabilityCount: disabledItems.length,
    warningItemCount: warningItems.length,
    providerHintCount: providerHintItems.length,
    totalItems,
    findings,
  };
}

// ── internal helpers ─────────────────────────────────────────────────────

function decideStatus(args: {
  readonly disabledRate: number;
  readonly warningRate: number;
  readonly disabledItemCount: number;
  readonly warningItemCount: number;
  readonly unsupportedHintCount: number;
  readonly unknownProviderSensitiveCount: number;
}): ExecutionRoutingSafetyStatus {
  if (
    args.disabledRate >= EXECUTION_ROUTING_SAFETY_UNSAFE_RATE ||
    args.warningRate >= EXECUTION_ROUTING_SAFETY_UNSAFE_RATE ||
    args.unknownProviderSensitiveCount > 0
  ) {
    return "unsafe_to_apply";
  }
  if (
    args.disabledItemCount > 0 ||
    args.warningItemCount > 0 ||
    args.unsupportedHintCount > 0
  ) {
    return "watch";
  }
  return "safe_dry_run";
}

function buildFindings(args: {
  readonly items: readonly ExecutionRoutingPlanItem[];
  readonly disabledItems: readonly ExecutionRoutingPlanItem[];
  readonly warningItems: readonly ExecutionRoutingPlanItem[];
  readonly unsupportedHintItems: readonly ExecutionRoutingPlanItem[];
  readonly unknownProviderSensitiveItems: readonly ExecutionRoutingPlanItem[];
  readonly disabledRate: number;
  readonly warningRate: number;
}): readonly ExecutionRoutingSafetyFinding[] {
  const out: ExecutionRoutingSafetyFinding[] = [];

  if (args.disabledRate >= EXECUTION_ROUTING_SAFETY_UNSAFE_RATE) {
    out.push({
      code: "HIGH_DISABLED_RATE",
      severity: "warning",
      message: `provider matrix가 지원하지 않는 capability 비율이 ${formatRate(args.disabledRate)}로 높습니다. 적용 후보로 사용하기 전 provider/capability 매핑을 재검토하세요.`,
    });
  } else if (args.disabledItems.length > 0) {
    out.push({
      code: "DISABLED_CAPABILITIES_PRESENT",
      severity: "info",
      message: `지원되지 않는 capability 후보 ${args.disabledItems.length}건이 감지되었습니다(실제 실행에는 영향이 없습니다).`,
    });
  }

  if (args.warningRate >= EXECUTION_ROUTING_SAFETY_UNSAFE_RATE) {
    out.push({
      code: "HIGH_WARNING_RATE",
      severity: "warning",
      message: `warning이 있는 routing 후보 비율이 ${formatRate(args.warningRate)}로 높습니다. 추천 사유를 사용자에게 명확히 노출하세요.`,
    });
  }

  if (args.unsupportedHintItems.length > 0) {
    out.push({
      code: "UNSUPPORTED_PROVIDER_HINT",
      severity: "info",
      message: `외부 provider 힌트와 capability가 일치하지 않는 후보 ${args.unsupportedHintItems.length}건이 감지되었습니다. 추천은 그대로 유지되며 자동 전환되지 않습니다.`,
    });
  }

  if (args.unknownProviderSensitiveItems.length > 0) {
    out.push({
      code: "UNKNOWN_PROVIDER_SENSITIVE_CAPABILITY",
      severity: "warning",
      message: `민감 capability(cursor_execution / github_operation)에 대해 추천 provider가 미지정된 후보 ${args.unknownProviderSensitiveItems.length}건이 감지되었습니다. 실제 실행을 시도하기 전 provider를 확정하세요.`,
    });
  }

  // 항상 노출하는 안전 핀(사용자에게 dry-run임을 재확인).
  out.push({
    code: "DRY_RUN_SAFETY_PIN",
    severity: "info",
    message:
      "이 보고서는 실제 실행 경로가 아니라, 현재 역할 기준으로 고려 가능한 실행 capability 계획에 대한 안전 진단입니다.",
  });

  return out.slice(0, 8);
}

function formatRate(rate: number): string {
  if (!Number.isFinite(rate)) return "0%";
  const pct = Math.round(Math.max(0, Math.min(1, rate)) * 100);
  return `${pct}%`;
}
