import { describe, expect, it } from "vitest";
import {
  QUICK_DESIGN_CONFIRM_WITH_STORE_PREP_FAILURE_SUMMARY,
  classifyProjectSchemaStoreFailure,
  projectSchemaStoreFailureUserMessage,
} from "@/lib/planning/projectSchemaStoreFailure";

describe("classifyProjectSchemaStoreFailure", () => {
  it("maps platform config gaps without legacy insufficient-credentials copy", () => {
    expect(classifyProjectSchemaStoreFailure("JYO_PLATFORM_PG_ADMIN_PASSWORD is not set")).toBe(
      "JYPROJECTS_CONFIG_MISSING",
    );
    expect(classifyProjectSchemaStoreFailure("접속 정보가 부족")).toBe("JYPROJECTS_CONFIG_MISSING");
    expect(projectSchemaStoreFailureUserMessage("JYPROJECTS_CONFIG_MISSING")).not.toMatch(
      /PostgreSQL 접속 정보/,
    );
  });

  it("maps schema permission and connection errors", () => {
    expect(classifyProjectSchemaStoreFailure("permission denied to create schema foo")).toBe(
      "CREATE_SCHEMA_PERMISSION_DENIED",
    );
    expect(classifyProjectSchemaStoreFailure("connect ECONNREFUSED")).toBe("JYPROJECTS_CONNECTION_FAILED");
  });
});

describe("Quick Design confirm store prep copy", () => {
  it("summarizes partial success without failing confirm", () => {
    expect(QUICK_DESIGN_CONFIRM_WITH_STORE_PREP_FAILURE_SUMMARY).toMatch(/확정/);
    expect(QUICK_DESIGN_CONFIRM_WITH_STORE_PREP_FAILURE_SUMMARY).not.toMatch(/실패했습니다/);
  });
});
