/**
 * 기획단계 PostgreSQL·Runtime API 데이터 슬롯 — `requirementsStateJson.planningDataSlotsV1`.
 */

import type { SampleDataSpecV1 } from "@/lib/featurePlanning/sampleDataSpecV1";
import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import {
  isPlanningDatabaseReady,
  normalizePlanningDataPersistenceMode,
  resolvePlanningDatabaseBlockingReason,
  resolvePlanningDatabaseBlockingReasonForReadiness,
  resolvePlanningDatabaseReadinessV1,
  resolvePlanningDataPersistenceMode,
  resolvePlanningHandoffStatus,
  planningDatabaseReadinessUserDisplay,
  planningDatabaseSettingsActionLabel,
  type PlanningDataPersistenceMode,
  type PlanningDatabaseReadinessV1,
  type PlanningHandoffStatus,
} from "@/lib/planning/planningDbPersistencePolicy";
import type { ProjectDataStoreNaming } from "@/lib/planning/projectDataStoreNaming";
import { buildProjectDataStoreNaming } from "@/lib/planning/projectDataStoreNaming";
import { findOrchestrationSlotKeysBySuffix, findSlotRow } from "@/lib/requirements/singleChatSlotNextAction";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";

export const PLANNING_DATA_SLOTS_VERSION = 1 as const;

export type PlanningDataSlotStatus =
  | "EMPTY"
  | "AUTO_DRAFTED"
  | "NEEDS_REVIEW"
  | "CONFIRMED"
  | "UPDATED_FROM_CHAT";

export type PlanningDataFieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "text"
  | "json";

export type { PlanningDatabaseReadinessV1 } from "@/lib/planning/planningDbPersistencePolicy";

export type DataStoreSlotV1 = Readonly<{
  readonly status: PlanningDataSlotStatus;
  readonly databaseReadiness: PlanningDatabaseReadinessV1;
  readonly provider: "POSTGRESQL";
  readonly enabled: boolean;
  readonly repositoryName?: string;
  readonly normalizedBaseName?: string;
  readonly implementationStore: Readonly<{
    readonly mode: "SAMPLE_DB";
    readonly displayName: string;
    readonly schemaName?: string;
    readonly description: string;
  }>;
  readonly reviewStore: Readonly<{
    readonly mode: "TEST_DB";
    readonly displayName: string;
    readonly schemaName?: string;
    readonly description: string;
  }>;
  readonly productionStore: Readonly<{
    readonly mode: "NOT_CONFIGURED" | "SEPARATE_PRODUCTION_DB" | "SEPARATE_SCHEMA";
    readonly displayName: string;
    readonly description: string;
  }>;
  readonly runtimeApiRequired: boolean;
  readonly blockingReason?: string | null;
  readonly settingsActionLabel?: string | null;
}>;

export type DataModelEntityV1 = Readonly<{
  readonly name: string;
  readonly label: string;
  readonly description: string;
  readonly fields: readonly Readonly<{
    readonly name: string;
    readonly label: string;
    readonly type: PlanningDataFieldType;
    readonly required: boolean;
    readonly sampleValue?: string;
    readonly description?: string;
  }>[];
  readonly relations?: readonly Readonly<{
    readonly targetEntity: string;
    readonly type: "one_to_one" | "one_to_many" | "many_to_many";
    readonly description: string;
  }>[];
}>;

export type DataModelSlotV1 = Readonly<{
  readonly status: PlanningDataSlotStatus;
  readonly entities: readonly DataModelEntityV1[];
}>;

export type SampleDataSlotV1 = Readonly<{
  readonly status: PlanningDataSlotStatus;
  readonly seedMode: "AI_GENERATED_SAMPLE_DB";
  readonly resettable: boolean;
  readonly entities: readonly Readonly<{
    readonly entityName: string;
    readonly recommendedCount: number;
    readonly qualityRules: readonly string[];
  }>[];
}>;

export type RuntimeApiOperationV1 =
  | "CREATE"
  | "READ"
  | "UPDATE"
  | "DELETE"
  | "SEARCH"
  | "FILTER"
  | "STATUS_CHANGE";

export type RuntimeApiSlotV1 = Readonly<{
  readonly status: PlanningDataSlotStatus;
  readonly required: boolean;
  readonly apiBaseMode: "PLATFORM_DEFAULT" | "CUSTOM";
  readonly endpoints: readonly Readonly<{
    readonly entityName: string;
    readonly operations: readonly RuntimeApiOperationV1[];
  }>[];
}>;

export type FeatureDataActionV1 = Readonly<{
  readonly featureId: string;
  readonly relatedEntities: readonly string[];
  readonly dataActions: readonly RuntimeApiOperationV1[];
}>;

export type PlanningDataSlotsV1 = Readonly<{
  readonly version: typeof PLANNING_DATA_SLOTS_VERSION;
  readonly updatedAt: string;
  readonly dataStoreSlot: DataStoreSlotV1;
  readonly dataModelSlot: DataModelSlotV1;
  readonly sampleDataSlot: SampleDataSlotV1;
  readonly runtimeApiSlot: RuntimeApiSlotV1;
  readonly featureDataActions?: readonly FeatureDataActionV1[];
}>;

function readStatus(v: unknown): PlanningDataSlotStatus {
  const s = String(v ?? "").trim();
  if (
    s === "EMPTY" ||
    s === "AUTO_DRAFTED" ||
    s === "NEEDS_REVIEW" ||
    s === "CONFIRMED" ||
    s === "UPDATED_FROM_CHAT"
  ) {
    return s;
  }
  return "EMPTY";
}

function parseStringArray(raw: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => String(x ?? "").trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function readDatabaseReadiness(v: unknown): PlanningDatabaseReadinessV1 | null {
  const s = String(v ?? "").trim();
  if (
    s === "READY" ||
    s === "CONFIG_REQUIRED" ||
    s === "CONNECTION_TEST_REQUIRED" ||
    s === "CONNECTION_FAILED" ||
    s === "STORE_NAMING_REQUIRED" ||
    s === "BLOCKED_DATABASE_REQUIRED"
  ) {
    return s;
  }
  return null;
}

export function parsePlanningDataSlotsV1(raw: unknown): PlanningDataSlotsV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== PLANNING_DATA_SLOTS_VERSION) return null;
  const updatedAt = String(o.updatedAt ?? "").trim();
  if (!updatedAt) return null;

  const storeRaw = o.dataStoreSlot && typeof o.dataStoreSlot === "object" ? (o.dataStoreSlot as Record<string, unknown>) : {};
  const modelRaw = o.dataModelSlot && typeof o.dataModelSlot === "object" ? (o.dataModelSlot as Record<string, unknown>) : {};
  const sampleRaw = o.sampleDataSlot && typeof o.sampleDataSlot === "object" ? (o.sampleDataSlot as Record<string, unknown>) : {};
  const runtimeRaw = o.runtimeApiSlot && typeof o.runtimeApiSlot === "object" ? (o.runtimeApiSlot as Record<string, unknown>) : {};

  const implRaw =
    storeRaw.implementationStore && typeof storeRaw.implementationStore === "object"
      ? (storeRaw.implementationStore as Record<string, unknown>)
      : {};
  const reviewRaw =
    storeRaw.reviewStore && typeof storeRaw.reviewStore === "object"
      ? (storeRaw.reviewStore as Record<string, unknown>)
      : {};
  const prodRaw =
    storeRaw.productionStore && typeof storeRaw.productionStore === "object"
      ? (storeRaw.productionStore as Record<string, unknown>)
      : {};

  const entities: DataModelEntityV1[] = [];
  if (Array.isArray(modelRaw.entities)) {
    for (const row of modelRaw.entities.slice(0, 32)) {
      if (!row || typeof row !== "object") continue;
      const er = row as Record<string, unknown>;
      const name = String(er.name ?? "").trim().slice(0, 80);
      if (!name) continue;
      const fields: DataModelEntityV1["fields"][number][] = [];
      if (Array.isArray(er.fields)) {
        for (const f of er.fields.slice(0, 48)) {
          if (!f || typeof f !== "object") continue;
          const fr = f as Record<string, unknown>;
          const fn = String(fr.name ?? "").trim().slice(0, 80);
          if (!fn) continue;
          const ft = String(fr.type ?? "string").trim();
          const fieldType: PlanningDataFieldType =
            ft === "number" ||
            ft === "boolean" ||
            ft === "date" ||
            ft === "datetime" ||
            ft === "text" ||
            ft === "json"
              ? ft
              : "string";
          fields.push({
            name: fn,
            label: String(fr.label ?? fn).trim().slice(0, 120),
            type: fieldType,
            required: Boolean(fr.required),
            ...(String(fr.sampleValue ?? "").trim()
              ? { sampleValue: String(fr.sampleValue).trim().slice(0, 200) }
              : {}),
            ...(String(fr.description ?? "").trim()
              ? { description: String(fr.description).trim().slice(0, 400) }
              : {}),
          });
        }
      }
      entities.push({
        name,
        label: String(er.label ?? name).trim().slice(0, 120),
        description: String(er.description ?? "").trim().slice(0, 500),
        fields,
      });
    }
  }

  const sampleEntities: SampleDataSlotV1["entities"][number][] = [];
  if (Array.isArray(sampleRaw.entities)) {
    for (const row of sampleRaw.entities.slice(0, 32)) {
      if (!row || typeof row !== "object") continue;
      const sr = row as Record<string, unknown>;
      const entityName = String(sr.entityName ?? "").trim().slice(0, 80);
      if (!entityName) continue;
      sampleEntities.push({
        entityName,
        recommendedCount: Math.max(0, Math.min(10000, Number(sr.recommendedCount) || 0)),
        qualityRules: parseStringArray(sr.qualityRules, 12, 300),
      });
    }
  }

  const endpoints: RuntimeApiSlotV1["endpoints"][number][] = [];
  if (Array.isArray(runtimeRaw.endpoints)) {
    for (const row of runtimeRaw.endpoints.slice(0, 32)) {
      if (!row || typeof row !== "object") continue;
      const er = row as Record<string, unknown>;
      const entityName = String(er.entityName ?? "").trim().slice(0, 80);
      if (!entityName) continue;
      const ops = parseStringArray(er.operations, 12, 40).filter((op): op is RuntimeApiOperationV1 =>
        ["CREATE", "READ", "UPDATE", "DELETE", "SEARCH", "FILTER", "STATUS_CHANGE"].includes(op),
      );
      endpoints.push({ entityName, operations: ops });
    }
  }

  const parsedReadiness = readDatabaseReadiness(storeRaw.databaseReadiness);

  return {
    version: PLANNING_DATA_SLOTS_VERSION,
    updatedAt,
    dataStoreSlot: {
      status: readStatus(storeRaw.status),
      databaseReadiness: parsedReadiness ?? "BLOCKED_DATABASE_REQUIRED",
      provider: "POSTGRESQL",
      enabled: Boolean(storeRaw.enabled),
      ...(String(storeRaw.repositoryName ?? "").trim()
        ? { repositoryName: String(storeRaw.repositoryName).trim().slice(0, 200) }
        : {}),
      ...(String(storeRaw.normalizedBaseName ?? "").trim()
        ? { normalizedBaseName: String(storeRaw.normalizedBaseName).trim().slice(0, 80) }
        : {}),
      implementationStore: {
        mode: "SAMPLE_DB",
        displayName: String(implRaw.displayName ?? "구현단계 샘플 데이터 저장소").trim().slice(0, 200),
        ...(String(implRaw.schemaName ?? "").trim()
          ? { schemaName: String(implRaw.schemaName).trim().slice(0, 80) }
          : {}),
        description: String(implRaw.description ?? "").trim().slice(0, 500),
      },
      reviewStore: {
        mode: "TEST_DB",
        displayName: String(reviewRaw.displayName ?? "검토단계 테스트 데이터 저장소").trim().slice(0, 200),
        ...(String(reviewRaw.schemaName ?? "").trim()
          ? { schemaName: String(reviewRaw.schemaName).trim().slice(0, 80) }
          : {}),
        description: String(reviewRaw.description ?? "").trim().slice(0, 500),
      },
      productionStore: {
        mode:
          prodRaw.mode === "SEPARATE_PRODUCTION_DB" || prodRaw.mode === "SEPARATE_SCHEMA"
            ? prodRaw.mode
            : "NOT_CONFIGURED",
        displayName: String(prodRaw.displayName ?? "운영 데이터 저장소").trim().slice(0, 200),
        description: String(prodRaw.description ?? "").trim().slice(0, 500),
      },
      runtimeApiRequired: storeRaw.runtimeApiRequired !== false,
      ...(String(storeRaw.blockingReason ?? "").trim()
        ? { blockingReason: String(storeRaw.blockingReason).trim().slice(0, 500) }
        : {}),
      ...(String(storeRaw.settingsActionLabel ?? "").trim()
        ? { settingsActionLabel: String(storeRaw.settingsActionLabel).trim().slice(0, 80) }
        : {}),
    },
    dataModelSlot: {
      status: readStatus(modelRaw.status),
      entities,
    },
    sampleDataSlot: {
      status: readStatus(sampleRaw.status),
      seedMode: "AI_GENERATED_SAMPLE_DB",
      resettable: sampleRaw.resettable !== false,
      entities: sampleEntities,
    },
    runtimeApiSlot: {
      status: readStatus(runtimeRaw.status),
      required: runtimeRaw.required !== false,
      apiBaseMode: runtimeRaw.apiBaseMode === "CUSTOM" ? "CUSTOM" : "PLATFORM_DEFAULT",
      endpoints,
    },
    ...(Array.isArray(o.featureDataActions)
      ? {
          featureDataActions: o.featureDataActions
            .slice(0, 48)
            .map((row) => {
              if (!row || typeof row !== "object") return null;
              const fr = row as Record<string, unknown>;
              const featureId = String(fr.featureId ?? "").trim().slice(0, 120);
              if (!featureId) return null;
              const dataActions = parseStringArray(fr.dataActions, 12, 40).filter(
                (op): op is RuntimeApiOperationV1 =>
                  ["CREATE", "READ", "UPDATE", "DELETE", "SEARCH", "FILTER", "STATUS_CHANGE"].includes(op),
              );
              return {
                featureId,
                relatedEntities: parseStringArray(fr.relatedEntities, 12, 80),
                dataActions,
              };
            })
            .filter((x): x is FeatureDataActionV1 => Boolean(x)),
        }
      : {}),
  };
}

function parseBulletLines(text: string): string[] {
  return String(text ?? "")
    .split(/\n|[,;、]/u)
    .map((s) => s.replace(/^[\s\-*•\d.)]+/u, "").trim())
    .filter(Boolean);
}

function inferEntityLabel(name: string): string {
  const n = name.trim();
  if (!n) return "데이터";
  return n;
}

function defaultFieldsForEntity(entityName: string): DataModelEntityV1["fields"] {
  const key = entityName.toLowerCase();
  if (/meeting|회의/.test(key)) {
    return [
      { name: "title", label: "제목", type: "string", required: true },
      { name: "scheduledAt", label: "일시", type: "datetime", required: true },
      { name: "status", label: "상태", type: "string", required: true },
      { name: "summary", label: "요약문", type: "text", required: false },
    ];
  }
  if (/participant|참석|attendee/.test(key)) {
    return [
      { name: "name", label: "이름", type: "string", required: true },
      { name: "role", label: "역할", type: "string", required: false },
    ];
  }
  if (/utter|발화|transcript|speech/.test(key)) {
    return [
      { name: "speaker", label: "발화자", type: "string", required: true },
      { name: "content", label: "발화 내용", type: "text", required: true },
      { name: "spokenAt", label: "발화 시간", type: "datetime", required: false },
    ];
  }
  return [
    { name: "name", label: "이름", type: "string", required: true },
    { name: "description", label: "설명", type: "text", required: false },
  ];
}

function buildEntitiesFromOrchestration(input: Readonly<{
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly sampleDataSpecV1?: SampleDataSpecV1 | null;
}>): readonly DataModelEntityV1[] {
  const dataKeys = findOrchestrationSlotKeysBySuffix(input.definitions, ".design.dataEntities");
  const dataRow = dataKeys.length ? findSlotRow(input.orchestration, dataKeys[0]!) : null;
  const lines = parseBulletLines(String(dataRow?.value ?? ""));
  const fromSpec =
    input.sampleDataSpecV1?.entities?.map((e) => String(e.name ?? e.key ?? "").trim()).filter(Boolean) ?? [];
  const names = [...new Set([...lines, ...fromSpec])].slice(0, 24);
  if (!names.length) return [];
  return names.map((name) => ({
    name: name.replace(/\s+/g, "_").slice(0, 80),
    label: inferEntityLabel(name),
    description: `${name} 데이터 묶음`,
    fields: defaultFieldsForEntity(name),
  }));
}

function defaultRuntimeOperations(): readonly RuntimeApiOperationV1[] {
  return ["CREATE", "READ", "UPDATE", "DELETE", "SEARCH", "FILTER", "STATUS_CHANGE"];
}

function buildRuntimeEndpoints(entities: readonly DataModelEntityV1[]): RuntimeApiSlotV1["endpoints"] {
  return entities.slice(0, 16).map((e) => ({
    entityName: e.label || e.name,
    operations: defaultRuntimeOperations(),
  }));
}

function buildSampleEntities(
  entities: readonly DataModelEntityV1[],
  sampleDataSpecV1?: SampleDataSpecV1 | null,
): SampleDataSlotV1["entities"] {
  if (sampleDataSpecV1?.entities?.length) {
    return sampleDataSpecV1.entities.slice(0, 24).map((e) => ({
      entityName: String(e.name ?? e.key ?? "").trim() || String(e.key ?? ""),
      recommendedCount: Math.max(1, Number(e.minimumCount) || 5),
      qualityRules: e.description
        ? [String(e.description).trim().slice(0, 300)]
        : ["목록·상세·검색 화면을 확인할 수 있을 만큼 생성"],
    }));
  }
  return entities.map((e, i) => ({
    entityName: e.label || e.name,
    recommendedCount: i === 0 ? 10 : i === 1 ? 30 : 50,
    qualityRules: [
      "상태값은 대기/진행/완료 등 주요 값이 모두 포함되어야 함",
      "목록/상세/검색/필터 화면을 확인할 수 있을 만큼 충분히 생성",
    ],
  }));
}

function slotStatusFromContent(hasContent: boolean, prior?: PlanningDataSlotStatus): PlanningDataSlotStatus {
  if (prior === "CONFIRMED") return prior;
  if (!hasContent) return prior ?? "EMPTY";
  return prior === "UPDATED_FROM_CHAT" ? "UPDATED_FROM_CHAT" : "AUTO_DRAFTED";
}

export function buildPlanningDataSlotsDraft(input: Readonly<{
  readonly repositoryName: string;
  readonly projectId?: string | null;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly sampleDataSpecV1?: SampleDataSpecV1 | null;
  readonly prior?: PlanningDataSlotsV1 | null;
  readonly planningDatabaseSettings?: PlanningDatabaseSettingsV1 | null;
  readonly nowIso?: string;
}>): PlanningDataSlotsV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const naming = buildProjectDataStoreNaming({
    repositoryName: input.repositoryName || "project",
    projectId: input.projectId ?? null,
  });
  const entities = buildEntitiesFromOrchestration(input);
  const hasEntities = entities.length > 0;
  const prior = input.prior ?? null;
  const settings = input.planningDatabaseSettings ?? null;
  const dbReady = isPlanningDatabaseReady(settings);
  const databaseReadiness = resolvePlanningDatabaseReadinessV1(settings, naming);
  const blockingReason = dbReady
    ? null
    : resolvePlanningDatabaseBlockingReasonForReadiness(databaseReadiness, settings);
  const settingsActionLabel = planningDatabaseSettingsActionLabel(databaseReadiness);

  const dataStoreSlot: DataStoreSlotV1 = {
    status: dbReady ? "CONFIRMED" : "NEEDS_REVIEW",
    databaseReadiness,
    provider: "POSTGRESQL",
    enabled: dbReady,
    repositoryName: naming.repositoryName,
    normalizedBaseName: naming.normalizedBaseName,
    implementationStore: {
      mode: "SAMPLE_DB",
      displayName: "구현단계 샘플 데이터 저장소",
      schemaName: naming.implementationSchemaName,
      description: "구현단계에서는 샘플 데이터 저장소를 사용합니다. Preview에서 등록·조회·수정·삭제를 확인합니다.",
    },
    reviewStore: {
      mode: "TEST_DB",
      displayName: "검토단계 테스트 데이터 저장소",
      schemaName: naming.reviewSchemaName,
      description: "검토단계에서는 테스트 데이터 저장소를 사용합니다.",
    },
    productionStore: {
      mode: "NOT_CONFIGURED",
      displayName: "운영 데이터 저장소",
      description: "운영 배포 단계에서 별도로 구성합니다.",
    },
    runtimeApiRequired: dbReady,
    ...(blockingReason ? { blockingReason } : {}),
    ...(settingsActionLabel ? { settingsActionLabel } : {}),
  };

  const dataModelSlot: DataModelSlotV1 = {
    status: slotStatusFromContent(hasEntities, prior?.dataModelSlot.status),
    entities: hasEntities ? entities : (prior?.dataModelSlot.entities ?? []),
  };

  const sampleEntities = buildSampleEntities(dataModelSlot.entities, input.sampleDataSpecV1);
  const sampleDataSlot: SampleDataSlotV1 = {
    status: slotStatusFromContent(sampleEntities.length > 0, prior?.sampleDataSlot.status),
    seedMode: "AI_GENERATED_SAMPLE_DB",
    resettable: true,
    entities: sampleEntities.length ? sampleEntities : (prior?.sampleDataSlot.entities ?? []),
  };

  const endpoints = buildRuntimeEndpoints(dataModelSlot.entities);
  const runtimeApiSlot: RuntimeApiSlotV1 = {
    status: slotStatusFromContent(endpoints.length > 0, prior?.runtimeApiSlot.status),
    required: dbReady,
    apiBaseMode: "PLATFORM_DEFAULT",
    endpoints: endpoints.length ? endpoints : (prior?.runtimeApiSlot.endpoints ?? []),
  };

  return {
    version: PLANNING_DATA_SLOTS_VERSION,
    updatedAt: now,
    dataStoreSlot,
    dataModelSlot,
    sampleDataSlot,
    runtimeApiSlot,
    ...(prior?.featureDataActions?.length ? { featureDataActions: prior.featureDataActions } : {}),
  };
}

export type PlanningHandoffForImplementationV1 = Readonly<{
  readonly version: 1;
  readonly projectId: string;
  readonly status: PlanningHandoffStatus;
  readonly repositoryName: string;
  readonly dataStoreSlot: DataStoreSlotV1;
  readonly dataModelSlot: DataModelSlotV1;
  readonly sampleDataSlot: SampleDataSlotV1;
  readonly runtimeApiSlot: RuntimeApiSlotV1;
  readonly implementationDataPlan: Readonly<{
    readonly provider: "POSTGRESQL";
    readonly dataPersistenceMode: PlanningDataPersistenceMode;
    readonly repositoryBasedStoreName: string;
    readonly implementationSchemaName: string;
    readonly reviewSchemaName: string;
    readonly useSampleDb: boolean;
    readonly useRuntimeApi: boolean;
    readonly blocked: boolean;
    readonly blockingReason: string | null;
  }>;
  readonly implementationDefaults: Readonly<{
    readonly previewHost: "GITHUB_PAGES";
    readonly dataPersistenceMode: PlanningDataPersistenceMode;
    readonly runtimeApiRequired: boolean;
  }>;
}>;

export function buildPlanningHandoffForImplementation(input: Readonly<{
  readonly projectId: string;
  readonly repositoryName: string;
  readonly planningDataSlots: PlanningDataSlotsV1;
  readonly planningDatabaseSettings?: PlanningDatabaseSettingsV1 | null;
}>): PlanningHandoffForImplementationV1 {
  const naming = buildProjectDataStoreNaming({
    repositoryName: input.repositoryName,
    projectId: input.projectId,
  });
  const dataPersistenceMode = resolvePlanningDataPersistenceMode({
    planningDatabaseSettings: input.planningDatabaseSettings,
  });
  const status = resolvePlanningHandoffStatus(dataPersistenceMode);
  const useSampleDb = dataPersistenceMode === "POSTGRES_SAMPLE_DB";
  const useRuntimeApi = useSampleDb;
  const settings = input.planningDatabaseSettings;
  const implementationSchemaName =
    String(settings?.implementationSchemaName ?? "").trim() || naming.implementationSchemaName;
  const reviewSchemaName = String(settings?.reviewSchemaName ?? "").trim() || naming.reviewSchemaName;
  const repositoryBasedStoreName =
    String(settings?.databaseStoreName ?? "").trim() || naming.normalizedBaseName;
  const blockingReason = useSampleDb ? null : resolvePlanningDatabaseBlockingReason(settings);
  return {
    version: 1,
    projectId: input.projectId.trim(),
    status,
    repositoryName: naming.repositoryName,
    dataStoreSlot: input.planningDataSlots.dataStoreSlot,
    dataModelSlot: input.planningDataSlots.dataModelSlot,
    sampleDataSlot: input.planningDataSlots.sampleDataSlot,
    runtimeApiSlot: input.planningDataSlots.runtimeApiSlot,
    implementationDataPlan: {
      provider: "POSTGRESQL",
      dataPersistenceMode,
      repositoryBasedStoreName,
      implementationSchemaName,
      reviewSchemaName,
      useSampleDb,
      useRuntimeApi,
      blocked: !useSampleDb,
      blockingReason,
    },
    implementationDefaults: {
      previewHost: "GITHUB_PAGES",
      dataPersistenceMode,
      runtimeApiRequired: useRuntimeApi,
    },
  };
}

export function parsePlanningHandoffForImplementationV1(raw: unknown): PlanningHandoffForImplementationV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  const projectId = String(o.projectId ?? "").trim();
  if (!projectId) return null;
  const slots = parsePlanningDataSlotsV1({
    version: PLANNING_DATA_SLOTS_VERSION,
    updatedAt: String(o.updatedAt ?? new Date().toISOString()),
    dataStoreSlot: o.dataStoreSlot,
    dataModelSlot: o.dataModelSlot,
    sampleDataSlot: o.sampleDataSlot,
    runtimeApiSlot: o.runtimeApiSlot,
  });
  if (!slots) return null;
  const planRaw =
    o.implementationDataPlan && typeof o.implementationDataPlan === "object"
      ? (o.implementationDataPlan as Record<string, unknown>)
      : null;
  const normalizedMode = normalizePlanningDataPersistenceMode(String(planRaw?.dataPersistenceMode ?? ""));
  const rawStatus = String(o.status ?? "").trim();
  const status: PlanningHandoffStatus =
    rawStatus === "READY" && normalizedMode === "POSTGRES_SAMPLE_DB"
      ? "READY"
      : "BLOCKED_DATABASE_REQUIRED";
  const useSampleDb =
    typeof planRaw?.useSampleDb === "boolean" ? planRaw.useSampleDb : normalizedMode === "POSTGRES_SAMPLE_DB";
  const useRuntimeApi =
    typeof planRaw?.useRuntimeApi === "boolean" ? planRaw.useRuntimeApi : normalizedMode === "POSTGRES_SAMPLE_DB";
  const blocked =
    typeof planRaw?.blocked === "boolean" ? planRaw.blocked : normalizedMode === "BLOCKED_DATABASE_REQUIRED";
  const repositoryName = String(o.repositoryName ?? slots.dataStoreSlot.repositoryName ?? "project").trim();
  const naming = buildProjectDataStoreNaming({
    repositoryName,
    projectId,
  });
  const implementationSchemaName =
    String(planRaw?.implementationSchemaName ?? "").trim() || naming.implementationSchemaName;
  const reviewSchemaName = String(planRaw?.reviewSchemaName ?? "").trim() || naming.reviewSchemaName;
  const repositoryBasedStoreName =
    String(planRaw?.repositoryBasedStoreName ?? planRaw?.databaseStoreName ?? "").trim() ||
    naming.normalizedBaseName;
  const blockingReason =
    typeof planRaw?.blockingReason === "string" && planRaw.blockingReason.trim()
      ? planRaw.blockingReason.trim().slice(0, 500)
      : blocked
        ? resolvePlanningDatabaseBlockingReason(null)
        : null;
  const defaultsRaw =
    o.implementationDefaults && typeof o.implementationDefaults === "object"
      ? (o.implementationDefaults as Record<string, unknown>)
      : null;
  const defaultMode = normalizePlanningDataPersistenceMode(
    String(defaultsRaw?.dataPersistenceMode ?? planRaw?.dataPersistenceMode ?? ""),
  );
  const runtimeApiRequired =
    typeof defaultsRaw?.runtimeApiRequired === "boolean" ? defaultsRaw.runtimeApiRequired : useRuntimeApi;

  return {
    version: 1,
    projectId,
    status,
    repositoryName,
    dataStoreSlot: slots.dataStoreSlot,
    dataModelSlot: slots.dataModelSlot,
    sampleDataSlot: slots.sampleDataSlot,
    runtimeApiSlot: slots.runtimeApiSlot,
    implementationDataPlan: {
      provider: "POSTGRESQL",
      dataPersistenceMode: normalizedMode,
      repositoryBasedStoreName,
      implementationSchemaName,
      reviewSchemaName,
      useSampleDb,
      useRuntimeApi,
      blocked,
      blockingReason,
    },
    implementationDefaults: {
      previewHost: "GITHUB_PAGES",
      dataPersistenceMode: defaultMode,
      runtimeApiRequired,
    },
  };
}

export function planningDataSlotSummaryRows(
  slots: PlanningDataSlotsV1 | null | undefined,
): readonly { readonly label: string; readonly level: "filled" | "partial" | "empty" }[] {
  if (!slots) {
    return [
      { label: "데이터 저장소", level: "empty" },
      { label: "데이터 구조", level: "empty" },
      { label: "샘플데이터 기준", level: "empty" },
      { label: "데이터 연결 방식", level: "empty" },
    ];
  }
  const level = (status: PlanningDataSlotStatus): "filled" | "partial" | "empty" => {
    if (status === "CONFIRMED") return "filled";
    if (status === "AUTO_DRAFTED" || status === "NEEDS_REVIEW" || status === "UPDATED_FROM_CHAT") return "partial";
    return "empty";
  };
  const storeDisplay = planningDatabaseReadinessUserDisplay(slots.dataStoreSlot.databaseReadiness);
  return [
    { label: `${storeDisplay.title} — ${storeDisplay.detail}`, level: storeDisplay.level },
    { label: "데이터 구조", level: level(slots.dataModelSlot.status) },
    { label: "샘플데이터 기준", level: level(slots.sampleDataSlot.status) },
    { label: "데이터 연결 방식", level: level(slots.runtimeApiSlot.status) },
  ];
}

export function mergePlanningDataSlotsPatch(input: Readonly<{
  readonly repositoryName: string;
  readonly projectId: string;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly sampleDataSpecV1?: SampleDataSpecV1 | null;
  readonly planningDatabaseSettings?: PlanningDatabaseSettingsV1 | null;
  readonly prior?: PlanningDataSlotsV1 | null;
  readonly nowIso?: string;
}>): PlanningDataSlotsV1 {
  return buildPlanningDataSlotsDraft(input);
}

export function planningDatabaseRequiredMessage(
  handoff?: PlanningHandoffForImplementationV1 | null,
): string {
  return (
    handoff?.implementationDataPlan?.blockingReason?.trim() ||
    "PostgreSQL 데이터베이스 설정과 연결 테스트가 필요합니다."
  );
}
