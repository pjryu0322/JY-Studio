import "server-only";

import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import {
  buildServerPlanningDatabaseSettingsForRuntimeDb,
  loadPlatformManagedPostgresConfig,
} from "@/lib/planning/platformManagedPostgresConfig.server";
import {
  projectSchemaStoreFailureUserMessage,
  type ProjectSchemaStoreFailureReason,
} from "@/lib/planning/projectSchemaStoreFailure";
import { isDatabaseUsageEnabledMode, resolveDatabaseUsageMode } from "@/lib/planning/planningDatabaseUsageMode";

export type ResolvedJyprojectsPgConnection = Readonly<
  | {
      readonly ok: true;
      readonly settings: PlanningDatabaseSettingsV1;
      readonly password: string;
    }
  | {
      readonly ok: false;
      readonly failureReason: ProjectSchemaStoreFailureReason;
      readonly userMessage: string;
      readonly adminMessage: string;
    }
>;

function hasPgCredentials(settings: PlanningDatabaseSettingsV1, password: string | null): boolean {
  return Boolean(
    settings.host.trim() &&
      settings.database.trim() &&
      settings.username.trim() &&
      String(password ?? "").trim(),
  );
}

/**
 * Resolves PostgreSQL connection for jyprojects schema provisioning using platform admin config.
 * Does not read per-project host/port/password from user settings when platform config is present.
 */
export function resolveJyprojectsPgConnectionForProvisioning(input: Readonly<{
  readonly planningSettings: PlanningDatabaseSettingsV1;
  readonly passwordOverride?: string | null;
}>): ResolvedJyprojectsPgConnection {
  const usage = resolveDatabaseUsageMode(input.planningSettings);
  if (!isDatabaseUsageEnabledMode(usage)) {
    return {
      ok: false,
      failureReason: "UNKNOWN",
      userMessage: projectSchemaStoreFailureUserMessage("UNKNOWN"),
      adminMessage: "Database usage is not enabled for schema provisioning.",
    };
  }

  const config = loadPlatformManagedPostgresConfig();
  if (config.configured) {
    const settings = buildServerPlanningDatabaseSettingsForRuntimeDb({
      settings: input.planningSettings,
      config,
    });
    const password = String(config.adminPassword ?? "").trim();
    if (!password) {
      return {
        ok: false,
        failureReason: "JYPROJECTS_CONFIG_MISSING",
        userMessage: projectSchemaStoreFailureUserMessage("JYPROJECTS_CONFIG_MISSING"),
        adminMessage: "JYO_PLATFORM_PG_ADMIN_PASSWORD is not set.",
      };
    }
    return { ok: true, settings, password };
  }

  const legacyPassword = String(input.passwordOverride ?? "").trim();
  if (hasPgCredentials(input.planningSettings, legacyPassword)) {
    return {
      ok: true,
      settings: input.planningSettings,
      password: legacyPassword,
    };
  }

  return {
    ok: false,
    failureReason: "JYPROJECTS_CONFIG_MISSING",
    userMessage: projectSchemaStoreFailureUserMessage("JYPROJECTS_CONFIG_MISSING"),
    adminMessage: "Platform PostgreSQL admin config (JYO_PLATFORM_PG_*) is not configured.",
  };
}
