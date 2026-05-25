import type { ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";
import {
  getImplementationSlotValue,
  patchImplementationSlotsValues,
  type DataPersistenceMode,
  type ImplementationSlotsV1,
} from "@/lib/prototype/implementationSlots";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";

export const IMPLEMENTATION_DB_STRATEGY_VERSION = "implementation_db_strategy_v1" as const;

export const DB_INTEGRATION_REVIEW_CHIP = "DB 연동 필요성 검토";
export const DATA_MODEL_DRAFT_CHIP = "데이터 모델 초안 생성";
export const MOCK_IMPLEMENTATION_CHIP = "Mock 기반 구현 진행";

export type ImplementationDbStrategyV1 = Readonly<{
  version: typeof IMPLEMENTATION_DB_STRATEGY_VERSION;
  dbDecisionRequested: boolean;
  mockModeConfirmed: boolean;
  dataModelDraftRequested: boolean;
  updatedAt: string;
}>;

export function parseImplementationDbStrategyV1(raw: unknown): ImplementationDbStrategyV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (String(o.version ?? "") !== IMPLEMENTATION_DB_STRATEGY_VERSION) return null;
  const updatedAt = String(o.updatedAt ?? "").trim();
  if (!updatedAt) return null;
  return {
    version: IMPLEMENTATION_DB_STRATEGY_VERSION,
    dbDecisionRequested: Boolean(o.dbDecisionRequested),
    mockModeConfirmed: Boolean(o.mockModeConfirmed),
    dataModelDraftRequested: Boolean(o.dataModelDraftRequested),
    updatedAt,
  };
}

export function defaultImplementationDbStrategy(nowIso?: string): ImplementationDbStrategyV1 {
  const now = nowIso ?? new Date().toISOString();
  return {
    version: IMPLEMENTATION_DB_STRATEGY_VERSION,
    dbDecisionRequested: false,
    mockModeConfirmed: false,
    dataModelDraftRequested: false,
    updatedAt: now,
  };
}

function entityList(slots: ImplementationSlotsV1 | null | undefined): readonly string[] {
  const raw = getImplementationSlotValue(slots, "data_entities");
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter(Boolean);
}

export function buildDbIntegrationDecisionMarkdown(input: {
  readonly slots: ImplementationSlotsV1;
  readonly projectArtifacts: readonly ProjectArtifact[];
  readonly plan?: ImplementationTaskPlanV1 | null;
}): string {
  const entities = entityList(input.slots);
  const trigger = String(getImplementationSlotValue(input.slots, "db_trigger_condition") ?? "");
  const security = String(getImplementationSlotValue(input.slots, "data_security_level") ?? "");
  const artifactTitles = input.projectArtifacts.map((a) => a.title).filter(Boolean).slice(0, 8);
  const taskTitles = (input.plan?.items ?? []).map((i) => i.title).filter(Boolean);

  return [
    "# DB 연동 판단서",
    "",
    "## 1. 현재 구현 전략",
    "- Mock 기반 / 정적 프로토타입",
    `- 저장 방식: \`${String(getImplementationSlotValue(input.slots, "data_persistence_mode") ?? "mock")}\``,
    `- 초기 저장: ${String(getImplementationSlotValue(input.slots, "storage_strategy") ?? "Mock JSON / local state")}`,
    "",
    "## 2. 현재 DB 연동 여부",
    `- db_required: ${getImplementationSlotValue(input.slots, "db_required") === true ? "true" : "false"}`,
    "- 현재 단계에서는 DB 연동을 필수로 하지 않음 (Mock 검토 우선)",
    "",
    "## 3. DB 전환이 필요한 조건",
    "- 사용자별 저장 필요",
    "- CRUD 검증 필요",
    "- 검색·조회·필터 필요",
    "- 권한별 데이터 접근 필요",
    "- 장기 보관 필요",
    ...(trigger ? [`- 판단 조건: ${trigger}`] : []),
    "",
    "## 4. 저장 대상 데이터 후보",
    ...(entities.length ? entities.map((e) => `- ${e}`) : ["- (엔티티 후보 미정)"]),
    ...(taskTitles.length ? ["", "### 구현 task 연관", ...taskTitles.map((t) => `- ${t}`)] : []),
    ...(artifactTitles.length ? ["", "### 참조 산출물", ...artifactTitles.map((t) => `- ${t}`)] : []),
    "",
    "## 5. 권장 전환 단계",
    "1. Mock 기반 구현·프로토타입 검토",
    "2. DB 연동 필요성 검토 확정",
    "3. 데이터 모델 초안 → DB 연동 task 생성",
    "4. Code Agent WIP로 schema/API 연동 구현",
    "",
    "## 6. 보안 고려사항",
    ...(security ? [`- ${security}`] : ["- 개인정보·민감정보 가능성 검토"]),
    "- 보존·삭제 정책은 운영 전환 Gate에서 확정",
  ].join("\n");
}

export function buildDataModelDraftMarkdown(input: {
  readonly slots: ImplementationSlotsV1;
  readonly plan?: ImplementationTaskPlanV1 | null;
}): string {
  const entities = entityList(input.slots);
  const primary = entities.slice(0, 8);
  const fieldLines = primary.flatMap((name) => [
    `### ${name}`,
    "- id (후보)",
    "- createdAt / updatedAt (후보)",
    "- projectId / ownerUserId (후보)",
    "",
  ]);

  return [
    "# 데이터 모델 초안",
    "",
    "## 1. 주요 엔티티",
    ...(primary.length ? primary.map((e) => `- ${e}`) : ["- (엔티티 후보 없음 — task·산출물에서 추출 예정)"]),
    "",
    "## 2. 주요 필드 후보",
    ...fieldLines,
    "## 3. 관계 후보",
    "- 프로젝트 1:N 주요 도메인 엔티티",
    "- 사용자·권한 연결은 DB 전환 Gate에서 확정",
    "",
    "## 4. 향후 DB 전환 시 고려사항",
    "- ID 정책 (UUID/cuid)",
    "- 생성·수정 시간",
    "- 사용자/권한 연결",
    "- 파일·첨부 메타데이터",
    `- migration_required: ${getImplementationSlotValue(input.slots, "migration_required") === true}`,
  ].join("\n");
}

export function buildStorageStrategyMarkdown(slots: ImplementationSlotsV1): string {
  const mode = String(getImplementationSlotValue(slots, "data_persistence_mode") ?? "mock") as DataPersistenceMode;
  const strategy = String(getImplementationSlotValue(slots, "storage_strategy") ?? "");
  return [
    "# 저장 전략서",
    "",
    `- data_persistence_mode: \`${mode}\``,
    `- storage_strategy: ${strategy || "—"}`,
    `- db_required: ${getImplementationSlotValue(slots, "db_required") === true}`,
    `- migration_required: ${getImplementationSlotValue(slots, "migration_required") === true}`,
    "",
    "Mock 단계에서는 Local state·샘플 JSON으로 화면·동선을 검증합니다.",
  ].join("\n");
}

export function applyMockImplementationModeSlots(
  slots: ImplementationSlotsV1,
  nowIso?: string,
): ImplementationSlotsV1 {
  return patchImplementationSlotsValues(
    slots,
    [
      {
        key: "data_persistence_mode",
        status: "confirmed",
        value: "mock",
        reason: "Mock 기반 구현 확정",
        source: ["implementation_db_strategy", "mock_mode_cta"],
      },
      {
        key: "db_required",
        status: "confirmed",
        value: false,
        reason: "프로토타입 단계 DB 미연동",
        source: ["implementation_db_strategy", "mock_mode_cta"],
      },
      {
        key: "storage_strategy",
        status: "confirmed",
        value: "Mock JSON / local state",
        reason: "정적·Mock 검토 우선",
        source: ["implementation_db_strategy", "mock_mode_cta"],
      },
      {
        key: "migration_required",
        status: "confirmed",
        value: false,
        source: ["implementation_db_strategy", "mock_mode_cta"],
      },
    ],
    nowIso,
  );
}

export function applyDbIntegrationReviewSlots(
  slots: ImplementationSlotsV1,
  nowIso?: string,
): ImplementationSlotsV1 {
  return patchImplementationSlotsValues(
    slots,
    [
      {
        key: "db_trigger_condition",
        status: "candidate",
        value: "사용자 검토 후 저장·조회·CRUD·권한·장기 보관 필요 시",
        source: ["implementation_db_strategy", "db_review_cta"],
      },
      {
        key: "data_entities",
        status: "candidate",
        value: entityList(slots).length ? entityList(slots) : ["회의", "발화자", "요약", "TODO"],
        source: ["implementation_db_strategy", "db_review_cta"],
      },
      {
        key: "data_security_level",
        status: "partial",
        value: "개인정보·민감정보 가능성 — DB 전환 전 AI보안관 기준 확정",
        source: ["implementation_db_strategy", "db_review_cta"],
      },
      {
        key: "backup_retention_policy",
        status: "candidate",
        value: "운영 전환 전 별도 정의",
        source: ["implementation_db_strategy", "db_review_cta"],
      },
    ],
    nowIso,
  );
}

export function applyDataModelDraftSlots(
  slots: ImplementationSlotsV1,
  entities: readonly string[],
  nowIso?: string,
): ImplementationSlotsV1 {
  const list = entities.length ? entities : entityList(slots);
  return patchImplementationSlotsValues(
    slots,
    [
      {
        key: "data_entities",
        status: "candidate",
        value: list,
        reason: "데이터 모델 초안 생성",
        source: ["implementation_db_strategy", "data_model_draft_cta"],
      },
    ],
    nowIso,
  );
}

export function buildImplementationDbTimelineEntry(input: {
  readonly action:
    | "implementation_db_decision_requested"
    | "implementation_data_model_draft_generated"
    | "implementation_mock_mode_confirmed";
  readonly slots: ImplementationSlotsV1;
  readonly artifactTypes?: readonly string[];
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const mode = String(getImplementationSlotValue(input.slots, "data_persistence_mode") ?? "mock");
  const dbRequired = getImplementationSlotValue(input.slots, "db_required") === true;
  const entities = getImplementationSlotValue(input.slots, "data_entities");
  const dataEntityCount = Array.isArray(entities) ? entities.length : 0;
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: input.action,
    source: "system",
    responseText: [
      `type=${input.action}`,
      "mode=implementation",
      `dataPersistenceMode=${mode}`,
      `dbRequired=${dbRequired}`,
      `dataEntityCount=${dataEntityCount}`,
      `artifactTypes=${(input.artifactTypes ?? []).join("|") || "none"}`,
    ].join(" "),
    createdAt: input.nowIso ?? new Date().toISOString(),
    orchestrationTraceGroup: "implementation_orchestration",
  };
}

export function shouldIncludeDbIntegrationDecisionArtifact(input: {
  readonly slots: ImplementationSlotsV1 | null | undefined;
  readonly dbStrategy: ImplementationDbStrategyV1 | null | undefined;
}): boolean {
  if (input.dbStrategy?.dbDecisionRequested) return true;
  if (getImplementationSlotValue(input.slots, "db_required") === true) return true;
  return false;
}

export function shouldIncludeDataModelDraftArtifact(input: {
  readonly slots: ImplementationSlotsV1 | null | undefined;
  readonly dbStrategy: ImplementationDbStrategyV1 | null | undefined;
}): boolean {
  if (input.dbStrategy?.dataModelDraftRequested) return true;
  if (getImplementationSlotValue(input.slots, "db_required") === true && entityList(input.slots).length > 0) {
    return true;
  }
  return false;
}

export function shouldIncludeStorageStrategyArtifact(input: {
  readonly slots: ImplementationSlotsV1 | null | undefined;
  readonly dbStrategy: ImplementationDbStrategyV1 | null | undefined;
}): boolean {
  if (input.dbStrategy?.mockModeConfirmed) return true;
  const mode = String(getImplementationSlotValue(input.slots, "data_persistence_mode") ?? "");
  return mode === "db" || mode === "external_api";
}
