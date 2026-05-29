import { describe, expect, it } from "vitest";
import { validateTargetRepositoryChangedFiles } from "@/lib/prototype/targetRepositoryPathGuard";

describe("validateTargetRepositoryChangedFiles", () => {
  it("src/App.tsx allowed when allowedPathGlobs empty", () => {
    const result = validateTargetRepositoryChangedFiles({
      changedFiles: ["src/App.tsx"],
      allowedPathGlobs: [],
    });
    expect(result.ok).toBe(true);
  });

  it("projects/JYOrchestration path is not specially required", () => {
    const result = validateTargetRepositoryChangedFiles({
      changedFiles: ["src/App.tsx"],
      allowedPathGlobs: [],
    });
    expect(result.ok).toBe(true);
  });

  it("blocks .env changes", () => {
    const result = validateTargetRepositoryChangedFiles({
      changedFiles: [".env"],
      allowedPathGlobs: [],
    });
    expect(result.ok).toBe(false);
  });

  it("blocks .git/config changes", () => {
    const result = validateTargetRepositoryChangedFiles({
      changedFiles: [".git/config"],
      allowedPathGlobs: [],
    });
    expect(result.ok).toBe(false);
  });

  it("blocks node_modules changes", () => {
    const result = validateTargetRepositoryChangedFiles({
      changedFiles: ["node_modules/foo/index.js"],
      allowedPathGlobs: [],
    });
    expect(result.ok).toBe(false);
  });

  it('allowedPathGlobs ["src/**"] rejects README.md', () => {
    const result = validateTargetRepositoryChangedFiles({
      changedFiles: ["README.md"],
      allowedPathGlobs: ["src/**"],
    });
    expect(result.ok).toBe(false);
  });
});
