import { describe, expect, it } from "vitest";
import {
  isPlatformInternalPath,
  resolveDefaultAllowedPathGlobsForTargetRepo,
  sanitizeCandidatePathsForTargetRepo,
} from "@/lib/prototype/codeTaskPromptPathPolicy";

describe("codeTaskPromptPathPolicy", () => {
  it("detects platform internal paths and dir: prefix", () => {
    expect(
      isPlatformInternalPath(
        "projects/JYOrchestration/apps/web/src/lib/prototype/implementationTaskPlan.ts",
      ),
    ).toBe(true);
    expect(isPlatformInternalPath("dir:projects/JYOrchestration/apps/web/src/lib")).toBe(true);
    expect(isPlatformInternalPath("../../secrets")).toBe(true);
    expect(isPlatformInternalPath("src/components/App.tsx")).toBe(false);
  });

  it("removes unsafe candidates for generated_project", () => {
    const result = sanitizeCandidatePathsForTargetRepo({
      candidatePaths: [
        "projects/JYOrchestration/apps/web/foo.ts",
        "dir:projects/JYOrchestration/bar",
        "../../other",
        "src/app/page.tsx",
      ],
      targetRepoFullName: "owner/app",
      targetRepoKind: "generated_project",
    });
    expect(result.safeCandidatePaths).toEqual(["src/app/page.tsx"]);
    expect(result.removedCandidatePaths.length).toBe(3);
  });

  it("provides default allowed globs for generated projects", () => {
    const globs = resolveDefaultAllowedPathGlobsForTargetRepo({
      targetRepoFullName: "owner/app",
      targetRepoKind: "generated_project",
    });
    expect(globs).toContain("src/**");
    expect(globs).toContain("app/**");
  });
});
