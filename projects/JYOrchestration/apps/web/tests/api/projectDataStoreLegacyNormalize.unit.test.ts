import { describe, expect, it } from "vitest";
import {
  isJyprojectsSchemaPersistenceMode,
  normalizeLegacyDataPersistenceMode,
  normalizeLegacyDatabaseUsageMode,
  normalizeLegacyProjectDbFailureReason,
} from "@/lib/planning/projectDataStoreLegacyNormalize";

describe("projectDataStoreLegacyNormalize", () => {
  it("normalizes legacy usage modes to ENABLED_JYPROJECTS_SCHEMA", () => {
    expect(normalizeLegacyDatabaseUsageMode("ENABLED_PROJECT_DATABASE")).toBe("ENABLED_JYPROJECTS_SCHEMA");
    expect(normalizeLegacyDatabaseUsageMode("ENABLED_POSTGRESQL")).toBe("ENABLED_JYPROJECTS_SCHEMA");
  });

  it("normalizes legacy persistence modes", () => {
    expect(normalizeLegacyDataPersistenceMode("PROJECT_DATABASE")).toBe("JYPROJECTS_SCHEMA");
    expect(normalizeLegacyDataPersistenceMode("POSTGRES_SAMPLE_DB")).toBe("JYPROJECTS_SCHEMA");
    expect(normalizeLegacyDataPersistenceMode("BLOCKED_PROJECT_DATABASE_REQUIRED")).toBe(
      "BLOCKED_SCHEMA_REQUIRED",
    );
  });

  it("normalizes legacy projectDb failure reasons to schema reasons", () => {
    expect(normalizeLegacyProjectDbFailureReason("CREATE_DATABASE_PERMISSION_DENIED")).toBe(
      "CREATE_SCHEMA_PERMISSION_DENIED",
    );
    expect(normalizeLegacyProjectDbFailureReason("POSTGRES_ADMIN_CONFIG_MISSING")).toBe(
      "JYPROJECTS_CONFIG_MISSING",
    );
  });

  it("detects jyprojects schema persistence via normalize", () => {
    expect(isJyprojectsSchemaPersistenceMode("PROJECT_DATABASE")).toBe(true);
    expect(isJyprojectsSchemaPersistenceMode("JSON_SAMPLE_DATA")).toBe(false);
  });
});
