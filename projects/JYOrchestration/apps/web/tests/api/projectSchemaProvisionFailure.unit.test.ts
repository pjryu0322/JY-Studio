import { describe, expect, it } from "vitest";
import {
  classifyProjectSchemaProvisionFailure,
  projectDataStoreActionGuide,
  projectSchemaProvisionFailureUserMessage,
} from "@/lib/planning/projectSchemaProvisionFailure";

describe("classifyProjectSchemaProvisionFailure", () => {
  it("maps schema permission errors from legacy create-database messages", () => {
    expect(
      classifyProjectSchemaProvisionFailure({
        rawError: "permission denied to create database",
      }),
    ).toBe("CREATE_SCHEMA_PERMISSION_DENIED");
    expect(
      classifyProjectSchemaProvisionFailure({
        rawError: "permission denied to create schema foo",
      }),
    ).toBe("CREATE_SCHEMA_PERMISSION_DENIED");
  });
});

describe("project schema provision user copy", () => {
  it("does not mention CREATE DATABASE or CREATEDB", () => {
    const msg = projectSchemaProvisionFailureUserMessage("CREATE_SCHEMA_PERMISSION_DENIED");
    expect(msg).not.toMatch(/CREATE DATABASE|CREATEDB|Project Database/i);
    const guide = projectDataStoreActionGuide({ failureReason: "CREATE_SCHEMA_PERMISSION_DENIED" });
    expect(guide.adminGuide).toMatch(/CREATE SCHEMA/i);
    expect(guide.adminGuide).not.toMatch(/CREATEDB/i);
  });
});
