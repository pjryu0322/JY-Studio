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

  it("puts GitHub Pages URL in externalPreviewUrl with external open mode", () => {
    const gh = "https://owner.github.io/my-app/";
    const result = resolveGeneratedAppPreviewUrl({
      projectId: "p1",
      previewScope: scope,
      completedCodeTaskCount: 1,
      externalPreviewUrl: gh,
    });
    expect(result.ok).toBe(true);
    expect(result.externalPreviewUrl).toBe(gh);
    expect(result.openMode).toBe("external_new_window");
    expect(result.renderMode).toBe("external_preview");
    expect(result.internalAppPreviewUrl).toBe(buildInternalGeneratedAppPreviewUrl("p1"));
    expect(result.internalAppPreviewUrl).not.toBe(gh);
  });

  it("uses internal renderer when no external URL", () => {
    const result = resolveGeneratedAppPreviewUrl({
      projectId: "p1",
      previewScope: scope,
      completedCodeTaskCount: 1,
    });
    expect(result.ok).toBe(true);
    expect(result.externalPreviewUrl).toBeNull();
    expect(result.internalAppPreviewUrl).toBe(buildInternalGeneratedAppPreviewUrl("p1"));
    expect(result.openMode).toBe("internal_renderer");
    expect(result.renderMode).toBe("internal_generated_app");
  });

  it("does not put external URL in internalAppPreviewUrl", () => {
    const gh = "https://owner.github.io/repo/";
    const result = resolveGeneratedAppPreviewUrl({
      projectId: "p1",
      previewScope: scope,
      completedCodeTaskCount: 1,
      externalPreviewUrl: gh,
    });
    expect(result.internalAppPreviewUrl).not.toBe(gh);
    expect(String(result.internalAppPreviewUrl)).toContain("/preview/app");
  });

  it("falls back when count is zero", () => {
    const result = resolveGeneratedAppPreviewUrl({
      projectId: "p1",
      previewScope: scope,
      completedCodeTaskCount: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.openMode).toBe("scope_summary_fallback");
    expect(result.renderMode).toBe("scope_summary_fallback");
  });
});
