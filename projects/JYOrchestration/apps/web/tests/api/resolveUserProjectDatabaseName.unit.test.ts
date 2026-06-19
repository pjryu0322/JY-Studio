import { describe, expect, it } from "vitest";
import { resolveUserProjectDatabaseName } from "@/lib/planning/resolveUserProjectDatabaseName";
import { normalizeRepositoryNameForDb } from "@/lib/planning/projectDataStoreNaming";

describe("resolveUserProjectDatabaseName", () => {
  it("normalizes display name from GitHub repo default", () => {
    expect(
      resolveUserProjectDatabaseName({
        databaseDisplayName: "",
        projectId: "proj1",
        gitRepoName: "pjryu0322/aiproject",
      }),
    ).toBe(normalizeRepositoryNameForDb("aiproject", "proj1"));
  });

  it("normalizes user-entered database name", () => {
    expect(
      resolveUserProjectDatabaseName({
        databaseDisplayName: "doit-meet",
        projectId: "proj1",
        gitRepoName: null,
      }),
    ).toBe(normalizeRepositoryNameForDb("doit-meet", "proj1"));
  });

  it("prefixes numeric-leading names", () => {
    expect(
      resolveUserProjectDatabaseName({
        databaseDisplayName: "123-demo",
        projectId: "x",
        gitRepoName: null,
      }),
    ).toMatch(/^p_123_demo/);
  });
});
