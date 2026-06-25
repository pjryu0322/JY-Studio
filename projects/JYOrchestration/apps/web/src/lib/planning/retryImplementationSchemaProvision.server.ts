import "server-only";

import { prisma } from "@/lib/prisma";
import { resolveJyprojectsPgConnectionForProvisioning } from "@/lib/planning/jyprojectsPgConnection.server";
import {
  buildDataStoreFailureSettingsPatch,
  buildDataStoreSuccessSettingsPatch,
} from "@/lib/planning/planningDataStoreSettingsAdapter";
import {
  loadPlanningDatabaseSettingsRawForProject,
  resolvePlanningPostgresPassword,
  executionSetupCreateDefaults,
} from "@/lib/planning/planningDatabaseSettingsService";
import { parsePlanningDataSlotsV1 } from "@/lib/planning/planningDataSlotsV1";
import { provisionImplementationSampleStore } from "@/lib/planning/provisionProjectStageDataStores";
import { provisionQuickDesignImplementationSchemaAndSeed } from "@/lib/planning/provisionQuickDesignImplementationSchemaAndSeed.server";
import {
  classifyProjectSchemaStoreFailure,
  projectSchemaStoreFailureUserMessage,
} from "@/lib/planning/projectSchemaStoreFailure";
import { isDatabaseUsageEnabledMode, resolveDatabaseUsageMode } from "@/lib/planning/planningDatabaseUsageMode";
import { mergeRequirementsStateJson, parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";

export type RetryImplementationSchemaProvisionResult = Readonly<{
  readonly ok: boolean;
  readonly message: string;
  readonly settings: PlanningDatabaseSettingsV1 | null;
}>;

async function persistSettingsPatch(projectId: string, patch: Partial<PlanningDatabaseSettingsV1>): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { requirementsStateJson: true },
  });
  const parsed = parseRequirementsStateJson(project?.requirementsStateJson);
  const merged = mergeRequirementsStateJson(parsed, {
    planningDatabaseSettingsV1: {
      ...(parsed.planningDatabaseSettingsV1 ?? {}),
      ...patch,
    } as PlanningDatabaseSettingsV1,
  });
  await prisma.project.update({
    where: { id: projectId },
    data: { requirementsStateJson: merged as object },
  });
  const setup = await prisma.executionSetup.findUnique({
    where: { projectId },
    select: { planningDatabaseSettingsJson: true },
  });
  const prior =
    setup?.planningDatabaseSettingsJson && typeof setup.planningDatabaseSettingsJson === "object"
      ? (setup.planningDatabaseSettingsJson as Record<string, unknown>)
      : {};
  await prisma.executionSetup.upsert({
    where: { projectId },
    create: {
      ...executionSetupCreateDefaults(projectId),
      planningDatabaseSettingsJson: { ...prior, ...patch },
    },
    update: { planningDatabaseSettingsJson: { ...prior, ...patch } },
  });
}

/** Retries jyprojects implementation schema + optional Quick Design tables/seeds (no CREATE DATABASE). */
export async function retryImplementationSchemaProvision(
  projectId: string,
): Promise<RetryImplementationSchemaProvisionResult> {
  const pid = projectId.trim();
  if (!pid) {
    return { ok: false, message: "projectId가 필요합니다.", settings: null };
  }
  const rawSettings = await loadPlanningDatabaseSettingsRawForProject(pid);
  const usage = resolveDatabaseUsageMode(rawSettings);
  if (!isDatabaseUsageEnabledMode(usage)) {
    return { ok: false, message: "프로젝트 데이터 저장소 사용이 활성화되어 있지 않습니다.", settings: rawSettings };
  }

  const project = await prisma.project.findUnique({
    where: { id: pid },
    select: { requirementsStateJson: true },
  });
  const state = parseRequirementsStateJson(project?.requirementsStateJson);
  const slots = parsePlanningDataSlotsV1(state.planningDataSlotsV1);
  const nowIso = new Date().toISOString();
  const passwordOverride = await resolvePlanningPostgresPassword(pid);
  const connection = resolveJyprojectsPgConnectionForProvisioning({
    planningSettings: rawSettings,
    passwordOverride,
  });
  if (!connection.ok) {
    const patch = buildDataStoreFailureSettingsPatch({
      prior: rawSettings,
      implementationSchemaName: rawSettings.implementationSchemaName ?? null,
      failureReason: connection.failureReason,
      adminMessage: connection.adminMessage,
      nowIso,
    });
    await persistSettingsPatch(pid, patch);
    return { ok: false, message: connection.userMessage, settings: { ...rawSettings, ...patch } };
  }

  const provision = await provisionImplementationSampleStore({
    projectId: pid,
    planningDataSlotsV1: slots,
    settings: connection.settings,
    password: connection.password,
    nowIso,
  });

  const implSchema = String(
    provision.planningDataSlotsV1?.dataStoreSlot?.implementationStore?.schemaName ??
      connection.settings.implementationSchemaName ??
      "",
  ).trim();

  if (!provision.ok) {
    const reason = classifyProjectSchemaStoreFailure(provision.message);
    const patch = buildDataStoreFailureSettingsPatch({
      prior: rawSettings,
      implementationSchemaName: implSchema || null,
      failureReason: reason,
      adminMessage: provision.message,
      nowIso,
    });
    await persistSettingsPatch(pid, patch);
    return { ok: false, message: projectSchemaStoreFailureUserMessage(reason), settings: { ...rawSettings, ...patch } };
  }

  const entities = provision.planningDataSlotsV1?.dataModelSlot?.entities ?? slots?.dataModelSlot?.entities ?? [];
  if (entities.length && implSchema) {
    const structure = await provisionQuickDesignImplementationSchemaAndSeed({
      settings: connection.settings,
      password: connection.password,
      schemaName: implSchema,
      entities,
    });
    if (!structure.ok) {
      const reason = classifyProjectSchemaStoreFailure(structure.message);
      const patch = buildDataStoreFailureSettingsPatch({
        prior: rawSettings,
        implementationSchemaName: implSchema,
        failureReason: reason,
        adminMessage: structure.message,
        nowIso,
      });
      await persistSettingsPatch(pid, patch);
      return { ok: false, message: structure.message, settings: { ...rawSettings, ...patch } };
    }
  }

  if (implSchema) {
    const successPatch = buildDataStoreSuccessSettingsPatch({
      prior: rawSettings,
      implementationSchemaName: implSchema,
      nowIso,
    });
    await persistSettingsPatch(pid, successPatch);
    return {
      ok: true,
      message: "프로젝트 저장소 schema 준비를 완료했습니다.",
      settings: { ...rawSettings, ...successPatch },
    };
  }

  return { ok: false, message: "구현단계 schema 이름을 확인할 수 없습니다.", settings: rawSettings };
}
