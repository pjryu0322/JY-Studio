import type { PlanningHandoffForImplementationV1 } from "@/lib/planning/planningDataSlotsV1";
import { isPlanningHandoffBlockedByDatabase } from "@/lib/planning/planningDbPersistencePolicy";
import { PLANNING_DATABASE_SETUP_LABEL } from "@/lib/requirements/implementationUxLabels";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { ImplementationStageActionRunResult } from "@/lib/prototype/implementationStageActionPipeline";

export const IMPLEMENTATION_DATABASE_REQUIRED_BLOCK_REASON = "DATABASE_REQUIRED" as const;

export function formatImplementationDatabaseRequiredUserNotice(): string {
  return [
    "구현단계를 시작할 수 없습니다.",
    "",
    "이 프로젝트는 구현단계부터 PostgreSQL 샘플 DB를 사용합니다.",
    "기획단계에서 데이터베이스 설정과 연결 테스트를 완료해 주세요.",
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
    message: formatImplementationDatabaseRequiredUserNotice(),
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
