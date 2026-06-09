import { describe, expect, it } from "vitest";
import {
  mapArtifactTreePathsToGithubPagesPreview,
  resolveStaticPreviewArtifact,
} from "@/lib/prototype/staticPreviewArtifactResolver";

describe("staticPreviewArtifactResolver", () => {
  it("2. dist/index.html yields artifactPath=dist", () => {
    const r = resolveStaticPreviewArtifact({
      repositoryFiles: ["src/main.ts", "dist/index.html", "dist/assets/app.js"],
    });
    expect(r.ok).toBe(true);
    expect(r.artifactPath).toBe("dist");
  });

  it("3. out/index.html yields artifactPath=out", () => {
    const r = resolveStaticPreviewArtifact({
      repositoryFiles: ["out/index.html"],
    });
    expect(r.ok).toBe(true);
    expect(r.artifactPath).toBe("out");
  });

  it("4. build/index.html yields artifactPath=build", () => {
    const r = resolveStaticPreviewArtifact({
      repositoryFiles: ["build/index.html"],
    });
    expect(r.ok).toBe(true);
    expect(r.artifactPath).toBe("build");
  });

  it("5. missing artifact yields static_artifact_missing", () => {
    const r = resolveStaticPreviewArtifact({ repositoryFiles: ["package.json", "src/index.ts"] });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("static_artifact_missing");
  });

  it("maps artifact files under previews/{projectId}/", () => {
    const mapped = mapArtifactTreePathsToGithubPagesPreview({
      projectId: "proj1",
      artifactPath: "dist",
      treeEntries: [
        { path: "dist/index.html", sha: "a", type: "blob" },
        { path: "dist/assets/x.js", sha: "b", type: "blob" },
        { path: "src/main.ts", sha: "c", type: "blob" },
      ],
    });
    expect(mapped.map((m) => m.path).sort()).toEqual([
      "previews/proj1/assets/x.js",
      "previews/proj1/index.html",
    ]);
  });
});
