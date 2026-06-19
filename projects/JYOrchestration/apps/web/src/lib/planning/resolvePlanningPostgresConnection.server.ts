import "server-only";

import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import {
  buildServerPlanningDatabaseSettingsForProjectDb,
  loadPlatformManagedPostgresConfig,
} from "@/lib/planning/platformManagedPostgresConfig.server";
import { resolveDatabaseUsageMode } from "@/lib/planning/planningDatabaseUsageMode";
import { readProjectDatabaseLifecycleStatus } from "@/lib/planning/projectDatabaseLifecycle";

function isProjectDatabaseUsage(settings?: PlanningDatabaseSettingsV1 | null): boolean {
  const usage = resolveDatabaseUsageMode(settings);
  return usage === "ENABLED_POSTGRESQL" || usage === "ENABLED_PROJECT_DATABASE";
}

/** Server-side PostgreSQL connection target for a project (platform-managed credentials). */
export async function resolvePlanningPostgresConnectionForProject(input: Readonly<{
  readonly settings: PlanningDatabaseSettingsV1;
}>): Promise<Readonly<{ settings: PlanningDatabaseSettingsV1; password: string | null }>> {
  const config = loadPlatformManagedPostgresConfig();
  const projectDbName = String(input.settings.projectDbName ?? input.settings.database ?? "").trim();
  const status = readProjectDatabaseLifecycleStatus(input.settings.projectDbStatus);
  if (isProjectDatabaseUsage(input.settings) && config.configured && projectDbName && status === "CREATED") {
    return {
      settings: buildServerPlanningDatabaseSettingsForProjectDb({
        settings: input.settings,
        projectDbName,
        config,
      }),
      password: config.adminPassword || null,
    };
  }
  // Legacy per-project credentials (pre-migration persisted rows)
  const legacyPassword = String((input.settings as { readonly _legacyPassword?: string })._legacyPassword ?? "");
  return { settings: input.settings, password: legacyPassword || null };
}

export async function resolvePlanningPostgresPasswordForProject(
  projectId: string,
  settings: PlanningDatabaseSettingsV1,
  storedProjectPassword: string | null,
): Promise<string | null> {
  const config = loadPlatformManagedPostgresConfig();
  const status = readProjectDatabaseLifecycleStatus(settings.projectDbStatus);
  if (isProjectDatabaseUsage(settings) && config.configured && status === "CREATED") {
    return config.adminPassword || null;
  }
  const stored = String(storedProjectPassword ?? "").trim();
  return stored || null;
}
