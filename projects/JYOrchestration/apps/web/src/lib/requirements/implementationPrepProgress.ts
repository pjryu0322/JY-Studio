/**
 * Quick Design confirm / implementation prep pseudo-progress (client-only).
 *
 * TODO(product): async job + polling for real batch completion counts
 * (POST quick-design/confirm → jobId → GET progress snapshot).
 */

export const IMPLEMENTATION_PREP_DEFAULT_BATCH_CONCURRENCY = 3;

export type ImplementationPrepProgressPhase =
  | "idle"
  | "confirming"
  | "seed_building"
  | "task_list_building"
  | "codetask_refining"
  | "workitem_building"
  | "preflight_checking"
  | "ready"
  | "failed"
  | "database_setup";

export type ImplementationPrepStepStatus = "done" | "active" | "pending";

export type ImplementationPrepStepItem = Readonly<{
  readonly label: string;
  readonly status: ImplementationPrepStepStatus;
}>;

export type ImplementationPrepProgressSnapshot = Readonly<{
  readonly phase: ImplementationPrepProgressPhase;
  readonly percent: number;
  readonly headline: string;
  readonly description: string;
  readonly detailLine?: string;
  readonly metaLines: readonly string[];
  readonly steps: readonly ImplementationPrepStepItem[];
}>;

const PSEUDO_PHASE_THRESHOLDS: readonly Readonly<{
  readonly phase: ImplementationPrepProgressPhase;
  readonly startPercent: number;
  readonly endPercent: number;
}>[] = [
  { phase: "confirming", startPercent: 0, endPercent: 10 },
  { phase: "seed_building", startPercent: 10, endPercent: 25 },
  { phase: "task_list_building", startPercent: 25, endPercent: 40 },
  { phase: "codetask_refining", startPercent: 40, endPercent: 85 },
  { phase: "workitem_building", startPercent: 85, endPercent: 95 },
  { phase: "preflight_checking", startPercent: 95, endPercent: 99 },
];

const STEP_DEFINITIONS: readonly Readonly<{
  readonly phase: ImplementationPrepProgressPhase;
  readonly label: string;
}>[] = [
  { phase: "confirming", label: "Quick Design 확정" },
  { phase: "seed_building", label: "구현 Seed 생성" },
  { phase: "task_list_building", label: "구현 TaskList 생성" },
  { phase: "codetask_refining", label: "CodeTask LLM 정제" },
  { phase: "workitem_building", label: "WorkItem 생성" },
  { phase: "preflight_checking", label: "Preflight 확인" },
];

function resolvePhase(rawPercent: number): ImplementationPrepProgressPhase {
  for (const row of PSEUDO_PHASE_THRESHOLDS) {
    if (rawPercent < row.endPercent) return row.phase;
  }
  return "preflight_checking";
}

function buildSteps(activePhase: ImplementationPrepProgressPhase): readonly ImplementationPrepStepItem[] {
  const activeIndex = STEP_DEFINITIONS.findIndex((s) => s.phase === activePhase);
  return STEP_DEFINITIONS.map((step, index) => {
    if (index < activeIndex || (activeIndex < 0 && step.phase === "confirming")) {
      return { label: step.label, status: "done" as const };
    }
    if (step.phase === activePhase) {
      return { label: step.label, status: "active" as const };
    }
    return { label: step.label, status: "pending" as const };
  });
}

function stepStatusLabel(status: ImplementationPrepStepStatus): string {
  if (status === "done") return "완료";
  if (status === "active") return "진행 중";
  return "대기";
}

/** Monotonic pseudo progress from elapsed time during a single confirm request. */
export function buildPseudoImplementationPrepProgress(
  elapsedMs: number,
  options?: Readonly<{ readonly batchConcurrency?: number }>,
): ImplementationPrepProgressSnapshot {
  const elapsed = Math.max(0, elapsedMs);
  const rampMs = 150_000;
  const rawPercent = Math.min(99, 10 + Math.floor((elapsed / rampMs) * 89));
  const phase = resolvePhase(rawPercent);
  const concurrency = options?.batchConcurrency ?? IMPLEMENTATION_PREP_DEFAULT_BATCH_CONCURRENCY;
  const steps = buildSteps(phase === "confirming" ? "seed_building" : phase);

  const headline =
    phase === "codetask_refining"
      ? "CodeTask LLM 정제를 Batch 기준으로 병렬 처리하고 있습니다."
      : "구현준비 산출물을 순서대로 생성하고 있습니다.";

  const description =
    phase === "codetask_refining"
      ? "기획 내용을 Cursor가 수행하기 좋은 CodeTask 단위로 정리하는 단계입니다."
      : "Quick Design 확정 결과를 바탕으로 구현 준비 산출물을 만드는 중입니다.";

  const detailLine =
    phase === "codetask_refining"
      ? "Batch 기준으로 병렬 처리 중입니다. 완료 수는 API 응답 후 표시됩니다."
      : undefined;

  const metaLines = [
    "전체 CodeTask: 준비 중",
    "Batch: 준비 중",
    `병렬 처리: ${concurrency}개씩`,
    "예상 소요: 약 2~3분",
    "상세 로그: 로그 탭",
  ];

  return {
    phase,
    percent: rawPercent,
    headline,
    description,
    detailLine,
    metaLines,
    steps,
  };
}

/** API 성공 직후 대화에 표시할 최종 스냅샷 (진행 중 pseudo는 99%까지, 100%는 완료 시에만). */
export function buildImplementationPrepCompletedSnapshot(): ImplementationPrepProgressSnapshot {
  const steps = STEP_DEFINITIONS.map((step) => ({
    label: step.label,
    status: "done" as const,
  }));
  return {
    phase: "ready",
    percent: 100,
    headline: "구현준비 산출물 생성이 완료되었습니다.",
    description: "이제 구현단계에서 실행할 CodeTask를 선택할 수 있습니다.",
    metaLines: [
      "전체 CodeTask: 준비 완료",
      "구현준비: 완료",
      "상세 로그: 로그 탭",
    ],
    steps,
  };
}

/** PostgreSQL 미준비로 구현준비가 차단된 경우 (Quick Design 확정은 성공). */
export function buildImplementationPrepDatabaseBlockedSnapshot(): ImplementationPrepProgressSnapshot {
  const steps = STEP_DEFINITIONS.map((step) => ({
    label: step.label,
    status: "pending" as const,
  }));
  return {
    phase: "database_setup",
    percent: 0,
    headline: "구현 준비를 완료할 수 없습니다.",
    description:
      "데이터베이스 사용을 선택했기 때문에 PostgreSQL 연결 설정과 연결 테스트를 완료해야 합니다.",
    metaLines: ["현재 단계: 데이터베이스 설정 필요", "진행률: 대기", "상세 로그: 로그 탭"],
    steps,
  };
}

/** DB 사용 여부 미선택으로 구현준비가 차단된 경우. */
export function buildImplementationPrepDatabaseUsageUnselectedSnapshot(): ImplementationPrepProgressSnapshot {
  const steps = STEP_DEFINITIONS.map((step) => ({
    label: step.label,
    status: "pending" as const,
  }));
  return {
    phase: "database_setup",
    percent: 0,
    headline: "데이터베이스 사용 여부를 선택해 주세요.",
    description:
      "데이터베이스를 사용하지 않으면 JSON 샘플데이터로 구현단계를 진행합니다. 데이터베이스를 사용하면 PostgreSQL 연결 설정과 연결 테스트가 필요합니다.",
    metaLines: ["현재 단계: 데이터베이스 사용 여부 선택", "진행률: 대기", "상세 로그: 로그 탭"],
    steps,
  };
}

export function formatImplementationPrepStepLine(step: ImplementationPrepStepItem): string {
  const suffix = step.status === "done" ? " 완료" : step.status === "active" ? " 중" : " 대기";
  return `${step.label}${suffix}`;
}

/** 대화칩·사용자 요약용 단계명(내부 Batch/LLM 용어 제외) */
export function formatImplementationPrepProgressUserStepLabel(
  phase: ImplementationPrepProgressPhase,
): string {
  switch (phase) {
    case "confirming":
      return "Quick Design 확정";
    case "seed_building":
      return "구현 Seed 생성";
    case "task_list_building":
      return "구현 TaskList 생성";
    case "codetask_refining":
      return "CodeTask 정리";
    case "workitem_building":
      return "WorkItem 생성";
    case "preflight_checking":
      return "실행 전 점검";
    case "ready":
      return "구현준비 완료";
    case "failed":
      return "구현준비 생성 실패";
    case "database_setup":
      return "데이터베이스 설정 필요";
    default:
      return "구현준비 생성";
  }
}

export { stepStatusLabel };
