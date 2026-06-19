import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import {
  parsePlanningDataSlotsV1,
  type PlanningDataSlotsV1,
} from "@/lib/planning/planningDataSlotsV1";
import { isPlanningDatabaseReady } from "@/lib/planning/planningDbPersistencePolicy";
import type { DataStoreLifecycleStatus } from "@/lib/planning/stageDataStoreLifecycle";
import {
  buildImplementationSampleStoreCreatedTimelineEntry,
  buildImplementationSampleStoreCreationFailedTimelineEntry,
  buildReviewTestStoreCreatedTimelineEntry,
  buildReviewTestStoreCreationFailedTimelineEntry,
  createPostgresSchemaIfNotExists,
} from "@/lib/planning/stagePostgresSchemaProvisioning";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

function patchStoreLifecycle(
  slots: PlanningDataSlotsV1,
  input: Readonly<{
    readonly target: "implementation" | "review";
    readonly lifecycleStatus: DataStoreLifecycleStatus;
    readonly nowIso: string;
    readonly errorMessage?: string | null;
  }>,
): PlanningDataSlotsV1 {
  const store = input.target === "implementation" ? slots.dataStoreSlot.implementationStore : slots.dataStoreSlot.reviewStore;
  const nextStore = {
    ...store,
    lifecycleStatus: input.lifecycleStatus,
    ...(input.lifecycleStatus === "CREATED" ? { createdAt: input.nowIso, errorMessage: null } : {}),
    ...(input.lifecycleStatus === "FAILED"
      ? { errorMessage: String(input.errorMessage ?? "").trim() || "스키마 생성에 실패했습니다." }
      : {}),
  };
  return {
    ...slots,
    updatedAt: input.nowIso,
    dataStoreSlot: {
      ...slots.dataStoreSlot,
      ...(input.target === "implementation"
        ? { implementationStore: nextStore }
        : { reviewStore: nextStore }),
    },
  };
}

export type StageDataStoreProvisionResult = Readonly<{
  readonly ok: boolean;
  readonly message: string;
  readonly planningDataSlotsV1: PlanningDataSlotsV1 | null;
  readonly timelineEntry: RequirementsPromptTimelineEntry | null;
}>;

export async function provisionImplementationSampleStore(input: Readonly<{
  readonly projectId: string;
  readonly planningDataSlotsV1: PlanningDataSlotsV1 | null | undefined;
  readonly settings: PlanningDatabaseSettingsV1;
  readonly password: string | null;
  readonly nowIso: string;
}>): Promise<StageDataStoreProvisionResult> {
  const slots = input.planningDataSlotsV1;
  if (!slots) {
    return { ok: false, message: "planningDataSlotsV1가 없습니다.", planningDataSlotsV1: null, timelineEntry: null };
  }
  const impl = slots.dataStoreSlot.implementationStore;
  const lifecycle = impl.lifecycleStatus ?? "PLANNED";
  if (lifecycle === "NOT_REQUIRED") {
    return { ok: true, message: "PostgreSQL 저장소가 필요하지 않습니다.", planningDataSlotsV1: slots, timelineEntry: null };
  }
  if (!isPlanningDatabaseReady(input.settings)) {
    return {
      ok: false,
      message: "PostgreSQL 설정이 준비되지 않았습니다.",
      planningDataSlotsV1: slots,
      timelineEntry: null,
    };
  }
  if (lifecycle === "CREATED") {
    return { ok: true, message: "이미 생성된 구현단계 샘플 저장소입니다.", planningDataSlotsV1: slots, timelineEntry: null };
  }
  const schemaName = String(impl.schemaName ?? "").trim();
  if (!schemaName) {
    return { ok: false, message: "구현단계 샘플 저장소명 예정값이 없습니다.", planningDataSlotsV1: slots, timelineEntry: null };
  }

  const creating = patchStoreLifecycle(slots, {
    target: "implementation",
    lifecycleStatus: "CREATING",
    nowIso: input.nowIso,
  });
  const created = await createPostgresSchemaIfNotExists({
    settings: input.settings,
    password: input.password,
    schemaName,
  });
  if (!created.ok) {
    const failedSlots = patchStoreLifecycle(creating, {
      target: "implementation",
      lifecycleStatus: "FAILED",
      nowIso: input.nowIso,
      errorMessage: created.message,
    });
    return {
      ok: false,
      message: created.message,
      planningDataSlotsV1: failedSlots,
      timelineEntry: buildImplementationSampleStoreCreationFailedTimelineEntry({
        projectId: input.projectId,
        schemaName,
        errorMessage: created.message,
        nowIso: input.nowIso,
      }),
    };
  }
  const doneSlots = patchStoreLifecycle(creating, {
    target: "implementation",
    lifecycleStatus: "CREATED",
    nowIso: input.nowIso,
  });
  return {
    ok: true,
    message: created.message,
    planningDataSlotsV1: doneSlots,
    timelineEntry: buildImplementationSampleStoreCreatedTimelineEntry({
      projectId: input.projectId,
      databaseName: input.settings.database.trim(),
      schemaName,
      nowIso: input.nowIso,
    }),
  };
}

export async function provisionReviewTestStore(input: Readonly<{
  readonly projectId: string;
  readonly planningDataSlotsV1: PlanningDataSlotsV1 | null | undefined;
  readonly settings: PlanningDatabaseSettingsV1;
  readonly password: string | null;
  readonly nowIso: string;
}>): Promise<StageDataStoreProvisionResult> {
  const slots = input.planningDataSlotsV1;
  if (!slots) {
    return { ok: false, message: "planningDataSlotsV1가 없습니다.", planningDataSlotsV1: null, timelineEntry: null };
  }
  const review = slots.dataStoreSlot.reviewStore;
  const lifecycle = review.lifecycleStatus ?? "PLANNED";
  if (lifecycle === "NOT_REQUIRED") {
    return { ok: true, message: "PostgreSQL 저장소가 필요하지 않습니다.", planningDataSlotsV1: slots, timelineEntry: null };
  }
  if (!isPlanningDatabaseReady(input.settings)) {
    return {
      ok: false,
      message: "PostgreSQL 설정이 준비되지 않았습니다.",
      planningDataSlotsV1: slots,
      timelineEntry: null,
    };
  }
  if (lifecycle === "CREATED") {
    return { ok: true, message: "이미 생성된 검토단계 테스트 저장소입니다.", planningDataSlotsV1: slots, timelineEntry: null };
  }
  const schemaName = String(review.schemaName ?? "").trim();
  const sourceSchema = String(slots.dataStoreSlot.implementationStore.schemaName ?? "").trim();
  if (!schemaName) {
    return { ok: false, message: "검토단계 테스트 저장소명 예정값이 없습니다.", planningDataSlotsV1: slots, timelineEntry: null };
  }

  const creating = patchStoreLifecycle(slots, {
    target: "review",
    lifecycleStatus: "CREATING",
    nowIso: input.nowIso,
  });
  const created = await createPostgresSchemaIfNotExists({
    settings: input.settings,
    password: input.password,
    schemaName,
  });
  if (!created.ok) {
    const failedSlots = patchStoreLifecycle(creating, {
      target: "review",
      lifecycleStatus: "FAILED",
      nowIso: input.nowIso,
      errorMessage: created.message,
    });
    return {
      ok: false,
      message: created.message,
      planningDataSlotsV1: failedSlots,
      timelineEntry: buildReviewTestStoreCreationFailedTimelineEntry({
        projectId: input.projectId,
        schemaName,
        errorMessage: created.message,
        nowIso: input.nowIso,
      }),
    };
  }
  const doneSlots = patchStoreLifecycle(creating, {
    target: "review",
    lifecycleStatus: "CREATED",
    nowIso: input.nowIso,
  });
  return {
    ok: true,
    message: created.message,
    planningDataSlotsV1: doneSlots,
    timelineEntry: buildReviewTestStoreCreatedTimelineEntry({
      projectId: input.projectId,
      sourceSchemaName: sourceSchema,
      schemaName,
      nowIso: input.nowIso,
    }),
  };
}
