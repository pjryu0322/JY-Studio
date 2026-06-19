import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("provisionQuickDesignImplementationSchemaAndSeed", () => {
  it("ensures CREATE SCHEMA IF NOT EXISTS before table/seed", () => {
    const filePath = resolve(
      process.cwd(),
      "src/lib/planning/provisionQuickDesignImplementationSchemaAndSeed.server.ts",
    );
    const source = readFileSync(filePath, "utf8");
    expect(source).toMatch(/CREATE SCHEMA IF NOT EXISTS/);
    expect(source).toMatch(/CREATE TABLE IF NOT EXISTS/);
    expect(source).toMatch(/TRUNCATE.*RESTART IDENTITY/);
  });
});
