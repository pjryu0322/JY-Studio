import "server-only";

import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import {
  buildServerPlanningDatabaseSettingsForRuntimeDb,
  loadPlatformManagedPostgresConfig,
} from "@/lib/planning/platformManagedPostgresConfig.server";
import { isDatabaseUsageEnabledMode, resolveDatabaseUsageMode } from "@/lib/planning/planningDatabaseUsageMode";

/** Server-side PostgreSQL connection to jyprojects (generated project data) + project schemas. */
export async function resolvePlanningPostgresConnectionForProject(input: Readonly<{
  readonly settings: PlanningDatabaseSettingsV1;
}>): Promise<Readonly<{ settings: PlanningDatabaseSettingsV1; password: string | null }>> {
  const config = loadPlatformManagedPostgresConfig();
  const usage = resolveDatabaseUsageMode(input.settings);
  if (isDatabaseUsageEnabledMode(usage) && config.configured) {
    return {
      settings: buildServerPlanningDatabaseSettingsForRuntimeDb({
        settings: input.settings,
        config,
      }),
      password: config.adminPassword || null,
    };
  }
  const legacyPassword = String((input.settings as { readonly _legacyPassword?: string })._legacyPassword ?? "");
  return { settings: input.settings, password: legacyPassword || null };
}

export async function resolvePlanningPostgresPasswordForProject(
  _projectId: string,
  settings: PlanningDatabaseSettingsV1,
  storedProjectPassword: string | null,
): Promise<string | null> {
  const config = loadPlatformManagedPostgresConfig();
  if (isDatabaseUsageEnabledMode(resolveDatabaseUsageMode(settings)) && config.configured) {
    return config.adminPassword || null;
  }
  const stored = String(storedProjectPassword ?? "").trim();
  return stored || null;
}
