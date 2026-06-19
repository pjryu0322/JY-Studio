import type { PlanningHandoffForImplementationV1 } from "@/lib/planning/planningDataSlotsV1";
import {
  isPlanningHandoffBlockedByDatabase,
  resolveImplementationPrepDatabaseBlockKind,
} from "@/lib/planning/planningDbPersistencePolicy";
import { PLANNING_DATABASE_SETUP_LABEL } from "@/lib/requirements/implementationUxLabels";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { ImplementationStageActionRunResult } from "@/lib/prototype/implementationStageActionPipeline";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";

export const IMPLEMENTATION_DATABASE_REQUIRED_BLOCK_REASON = "DATABASE_REQUIRED" as const;

export function isImplementationBlockedByPlanningDatabase(
  handoff: PlanningHandoffForImplementationV1 | null | undefined,
): boolean {
  return isPlanningHandoffBlockedByDatabase(handoff);
}

export function implementationDatabaseRequiredBlockMessage(
  handoff: PlanningHandoffForImplementationV1 | null | undefined,
): string {
  const detail = handoff?.implementationDataPlan?.blockingReason?.trim();
  if (detail) return detail;
  return "구현단계를 시작하려면 PostgreSQL 데이터베이스 설정과 연결 테스트가 필요합니다.";
}

export function formatImplementationDatabaseRequiredUserNotice(
  handoff?: PlanningHandoffForImplementationV1 | null,
): string {
  const kind = resolveImplementationPrepDatabaseBlockKind(handoff);
  if (kind === "usage_unselected") {
    return [
      "구현단계를 시작할 수 없습니다.",
      "",
      "데이터베이스 사용 여부를 선택해 주세요.",
      "데이터베이스를 사용하지 않으면 JSON 샘플데이터로 구현단계를 진행합니다.",
      "데이터베이스를 사용하면 PostgreSQL 연결 설정과 연결 테스트가 필요합니다.",
      "",
      `[${PLANNING_DATABASE_SETUP_LABEL}]`,
    ].join("\n");
  }
  return [
    "구현단계를 시작할 수 없습니다.",
    "",
    implementationDatabaseRequiredBlockMessage(handoff),
    "",
    `[${PLANNING_DATABASE_SETUP_LABEL}]`,
  ].join("\n");
}

export function evaluateImplementationDatabaseRequiredExecutionBlock(input: {
  readonly planningHandoffForImplementationV1?: PlanningHandoffForImplementationV1 | null;
}):
  | Readonly<{ readonly blocked: false }>
  | Readonly<{
      readonly blocked: true;
      readonly blockReason: typeof IMPLEMENTATION_DATABASE_REQUIRED_BLOCK_REASON;
      readonly message: string;
      readonly actionLabel: typeof PLANNING_DATABASE_SETUP_LABEL;
    }> {
  const handoff = input.planningHandoffForImplementationV1 ?? null;
  if (!isPlanningHandoffBlockedByDatabase(handoff)) {
    return { blocked: false };
  }
  return {
    blocked: true,
    blockReason: IMPLEMENTATION_DATABASE_REQUIRED_BLOCK_REASON,
    message: formatImplementationDatabaseRequiredUserNotice(handoff),
    actionLabel: PLANNING_DATABASE_SETUP_LABEL,
  };
}

export function resolvePlanningHandoffFromRequirementsState(
  state: Pick<RequirementsStateJson, "planningHandoffForImplementationV1"> | null | undefined,
): PlanningHandoffForImplementationV1 | null {
  return state?.planningHandoffForImplementationV1 ?? null;
}

export function buildImplementationDatabaseRequiredRunResult(
  block: Exclude<
    ReturnType<typeof evaluateImplementationDatabaseRequiredExecutionBlock>,
    { readonly blocked: false }
  >,
): ImplementationStageActionRunResult {
  return { outcome: "blocked", message: block.message };
}

export function buildImplementationDatabaseRequiredBlockedTimelineEntry(input: {
  readonly projectId: string;
  readonly handoff?: PlanningHandoffForImplementationV1 | null;
  readonly nowIso?: string;
}) {
  const detail = implementationDatabaseRequiredBlockMessage(input.handoff);
  return buildImplementationExecutionLogTimelineEntry({
    action: "implementation_execution_blocked_database_required",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: {
      projectId: input.projectId.trim(),
      blockReason: IMPLEMENTATION_DATABASE_REQUIRED_BLOCK_REASON,
      detail: `DATABASE_REQUIRED: ${detail}`,
    },
    nowIso: input.nowIso ?? new Date().toISOString(),
  });
}
