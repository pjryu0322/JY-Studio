import { describe, expect, it } from "vitest";
import {
  buildInternalGeneratedAppPreviewUrl,
  resolveGeneratedAppPreviewUrl,
} from "@/lib/prototype/generatedAppPreviewUrlResolver";
import { buildImplementationPreviewScopeV1 } from "@/lib/prototype/implementationPreviewScopeV1";

const NOW = "2026-06-03T12:00:00.000Z";

describe("resolveGeneratedAppPreviewUrl", () => {
  const scope = buildImplementationPreviewScopeV1({
    generatedAt: NOW,
    included: [{ codeTaskId: "CT-1", taskId: "DEV-A", title: "Shell", commitSha: "sha" }],
    excluded: [],
    warnings: [],
  });

  it("uses external preview URL when provided", () => {
    const result = resolveGeneratedAppPreviewUrl({
      projectId: "p1",
      previewScope: scope,
      completedCodeTaskCount: 1,
      externalPreviewUrl: "https://example.github.io/app/",
    });
    expect(result.ok).toBe(true);
    expect(result.renderMode).toBe("generated_app_iframe");
    expect(result.appPreviewUrl).toBe("https://example.github.io/app/");
  });

  it("uses internal app preview route when no external URL", () => {
    const result = resolveGeneratedAppPreviewUrl({
      projectId: "p1",
      previewScope: scope,
      completedCodeTaskCount: 1,
    });
    expect(result.ok).toBe(true);
    expect(result.renderMode).toBe("generated_app_iframe");
    expect(result.appPreviewUrl).toBe(buildInternalGeneratedAppPreviewUrl("p1"));
  });

  it("falls back to scope summary mode when count is zero", () => {
    const result = resolveGeneratedAppPreviewUrl({
      projectId: "p1",
      previewScope: scope,
      completedCodeTaskCount: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.renderMode).toBe("scope_summary_fallback");
    expect(result.appPreviewUrl).toBeNull();
  });
});
