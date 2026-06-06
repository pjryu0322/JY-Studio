import { describe, expect, it } from "vitest";
import { getPreviewOpenTarget } from "@/lib/prototype/implementationPreviewOpenTarget";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { IMPLEMENTATION_PREVIEW_RUNTIME_VERSION } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { IMPLEMENTATION_PREVIEW_SCOPE_VERSION } from "@/lib/prototype/implementationPreviewScopeV1";

const base: Omit<ImplementationPreviewRuntimeV1, "openMode" | "renderMode" | "externalPreviewUrl" | "internalAppPreviewUrl" | "appPreviewUrl"> = {
  version: IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
  status: "ready",
  previewUrl: "/projects/p1/preview?scope=latest",
  sourceScopeVersion: IMPLEMENTATION_PREVIEW_SCOPE_VERSION,
  includedCodeTaskIds: ["CT-1"],
  excludedCodeTaskIds: [],
  warnings: [],
};

describe("getPreviewOpenTarget", () => {
  it("opens external URL in new window", () => {
    const target = getPreviewOpenTarget({
      ...base,
      externalPreviewUrl: "https://owner.github.io/app/",
      internalAppPreviewUrl: "/projects/p1/preview/app?scope=latest",
      appPreviewUrl: "https://owner.github.io/app/",
      renderMode: "external_preview",
      openMode: "external_new_window",
    });
    expect(target.mode).toBe("new_window");
    expect(target.url).toBe("https://owner.github.io/app/");
    expect(target.label).toBe("Preview 열기");
  });

  it("uses pre-integration hint when runtime is missing and integration is allowed", () => {
    const target = getPreviewOpenTarget({ runtime: null, canIntegrate: true });
    expect(target.url).toBeNull();
    expect(target.hint).toContain("통합을 실행하면");
  });

  it("opens internal app URL in new window when no external URL", () => {
    const target = getPreviewOpenTarget({
      ...base,
      internalAppPreviewUrl: "/projects/p1/preview/app?scope=latest",
      appPreviewUrl: "/projects/p1/preview/app?scope=latest",
      renderMode: "internal_generated_app",
      openMode: "internal_renderer",
    });
    expect(target.mode).toBe("new_window");
    expect(target.url).toBe("/projects/p1/preview/app?scope=latest");
    expect(target.label).toBe("내부 Preview 보기");
  });
});
