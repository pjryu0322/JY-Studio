import { describe, expect, it } from "vitest";
import { parsePlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import {
  buildDataStoreFailureSettingsPatch,
  readEffectiveImplementationSchemaStatus,
  readProjectStoreName,
} from "@/lib/planning/planningDataStoreSettingsAdapter";

describe("planningDataStoreSettingsAdapter", () => {
  it("reads implementationSchema.status before legacy persisted fields", () => {
    const settings = parsePlanningDatabaseSettingsV1({
      version: 1,
      usageMode: "ENABLED_JYPROJECTS_SCHEMA",
      enabled: true,
      provider: "POSTGRESQL",
      host: "",
      port: 5432,
      database: "",
      username: "",
      projectDbStatus: "PLANNED",
      implementationSchema: { name: "app_impl_sample", status: "FAILED" },
    })!;
    expect(readEffectiveImplementationSchemaStatus(settings)).toBe("FAILED");
  });

  it("maps legacy projectDbStatus when new fields absent", () => {
    const settings = parsePlanningDatabaseSettingsV1({
      version: 1,
      usageMode: "ENABLED_JYPROJECTS_SCHEMA",
      enabled: true,
      provider: "POSTGRESQL",
      host: "",
      port: 5432,
      database: "",
      username: "",
      connectionStatus: "READY",
      projectDbStatus: "CREATED",
    })!;
    expect(readEffectiveImplementationSchemaStatus(settings)).toBe("CREATED");
  });

  it("writes dataStore and legacy mirror on failure patch", () => {
    const prior = parsePlanningDatabaseSettingsV1({
      version: 1,
      usageMode: "ENABLED_JYPROJECTS_SCHEMA",
      enabled: true,
      provider: "POSTGRESQL",
      host: "",
      port: 5432,
      database: "",
      username: "",
      connectionStatus: "NOT_CONFIGURED",
      databaseStoreName: "myapp",
      implementationSchemaName: "myapp_impl_sample",
    })!;
    const patch = buildDataStoreFailureSettingsPatch({
      prior,
      implementationSchemaName: "myapp_impl_sample",
      failureReason: "CREATE_SCHEMA_PERMISSION_DENIED",
      adminMessage: "permission denied to create schema",
      nowIso: "2026-06-03T00:00:00.000Z",
    });
    expect(patch.dataStoreStatus).toBe("FAILED");
    expect(patch.implementationSchema?.status).toBe("FAILED");
    expect(patch).not.toHaveProperty("projectDbStatus");
    expect(patch).not.toHaveProperty("projectDbFailureReason");
    expect(readProjectStoreName({ ...prior, ...patch })).toBe("myapp");
  });
});
