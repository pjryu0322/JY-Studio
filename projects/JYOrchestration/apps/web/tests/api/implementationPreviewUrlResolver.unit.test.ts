import { describe, expect, it } from "vitest";
import {
  resolveActualIntegratedPreviewUrl,
  resolveCodeTaskDiagnosticPreviewUrl,
  resolveActualIntegratedPreviewUrlForOpen,
} from "@/lib/prototype/implementationPreviewUrlResolver";
import { IMPLEMENTATION_PREVIEW_RUNTIME_VERSION } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { IMPLEMENTATION_PREVIEW_SCOPE_VERSION } from "@/lib/prototype/implementationPreviewScopeV1";

describe("implementationPreviewUrlResolver", () => {
  it("1. actual preview URL uses github.io previews path", () => {
    const url = resolveActualIntegratedPreviewUrl({
      owner: "pjryu0322",
      repo: "aiprogect",
      projectId: "cmphxk7y10015unj0wjms1uch",
    });
    expect(url).toBe(
      "https://pjryu0322.github.io/aiprogect/previews/cmphxk7y10015unj0wjms1uch/",
    );
  });

  it("2. diagnostic preview URL is scope=latest", () => {
    expect(resolveCodeTaskDiagnosticPreviewUrl("p1")).toBe("/projects/p1/preview?scope=latest");
  });

  it("3. actual open resolver rejects diagnostic scope URLs", () => {
    const url = resolveActualIntegratedPreviewUrlForOpen({
      projectId: "p1",
      previewRuntime: {
        version: IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
        status: "ready",
        previewUrl: "/projects/p1/preview?scope=latest",
        sourceScopeVersion: IMPLEMENTATION_PREVIEW_SCOPE_VERSION,
        renderMode: "internal_generated_app",
        openMode: "scope_summary_fallback",
        includedCodeTaskIds: [],
        excludedCodeTaskIds: [],
        warnings: [],
      },
    });
    expect(url).toBeNull();
  });

  it("4. diagnostic resolver path does not return GitHub Pages URL", () => {
    const diagnostic = resolveCodeTaskDiagnosticPreviewUrl("p1");
    expect(diagnostic).not.toContain("github.io");
  });
});
