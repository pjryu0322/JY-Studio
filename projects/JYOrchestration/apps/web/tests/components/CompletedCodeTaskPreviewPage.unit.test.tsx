import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CompletedCodeTaskPreviewScopeSummaryFallback,
} from "@/components/preview/CompletedCodeTaskPreviewPageClient";
import { ExternalPreviewLaunchPanel } from "@/components/preview/ExternalPreviewLaunchPanel";
import { buildImplementationPreviewScopeV1 } from "@/lib/prototype/implementationPreviewScopeV1";
import { IMPLEMENTATION_PREVIEW_RUNTIME_VERSION } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { IMPLEMENTATION_PREVIEW_SCOPE_VERSION } from "@/lib/prototype/implementationPreviewScopeV1";
import {
  resolveCompletedCodeTaskPreviewMainMode,
  resolveInternalIframeSrc,
} from "@/lib/prototype/completedCodeTaskPreviewView";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";

const NOW = "2026-06-03T12:00:00.000Z";

const scope = buildImplementationPreviewScopeV1({
  generatedAt: NOW,
  included: [{ codeTaskId: "CT-1", taskId: "DEV-A", title: "입력 화면", commitSha: "sha" }],
  excluded: [{ codeTaskId: "CT-2", taskId: "DEV-A", title: "결과", status: "prompt_ready", reason: "미완료" }],
  warnings: [],
});

describe("completedCodeTaskPreviewView", () => {
  it("uses external launch mode for external openMode", () => {
    const runtime: ImplementationPreviewRuntimeV1 = {
      version: IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
      status: "ready",
      previewUrl: "/projects/p1/preview?scope=latest",
      externalPreviewUrl: "https://owner.github.io/app/",
      internalAppPreviewUrl: "/projects/p1/preview/app?scope=latest",
      appPreviewUrl: "https://owner.github.io/app/",
      renderMode: "external_preview",
      openMode: "external_new_window",
      sourceScopeVersion: IMPLEMENTATION_PREVIEW_SCOPE_VERSION,
      includedCodeTaskIds: ["CT-1"],
      excludedCodeTaskIds: ["CT-2"],
      warnings: [],
    };
    expect(resolveCompletedCodeTaskPreviewMainMode(runtime)).toBe("external_launch");
    expect(resolveInternalIframeSrc(runtime)).toBeNull();
  });

  it("uses internal iframe only for internalAppPreviewUrl", () => {
    const runtime: ImplementationPreviewRuntimeV1 = {
      version: IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
      status: "ready",
      previewUrl: "/projects/p1/preview?scope=latest",
      internalAppPreviewUrl: "/projects/p1/preview/app?scope=latest",
      appPreviewUrl: "/projects/p1/preview/app?scope=latest",
      renderMode: "internal_generated_app",
      openMode: "internal_renderer",
      sourceScopeVersion: IMPLEMENTATION_PREVIEW_SCOPE_VERSION,
      includedCodeTaskIds: ["CT-1"],
      excludedCodeTaskIds: ["CT-2"],
      warnings: [],
    };
    expect(resolveCompletedCodeTaskPreviewMainMode(runtime)).toBe("internal_iframe");
    expect(resolveInternalIframeSrc(runtime)).toContain("/preview/app");
  });
});

describe("ExternalPreviewLaunchPanel", () => {
  it("does not render iframe", () => {
    const html = renderToStaticMarkup(
      createElement(ExternalPreviewLaunchPanel, {
        externalPreviewUrl: "https://owner.github.io/app/",
      }),
    );
    expect(html).toContain("completed-codetask-external-preview-launch");
    expect(html).not.toContain("<iframe");
    expect(html).toContain("새 창으로 열기");
  });
});

describe("CompletedCodeTaskPreviewScopeSummaryFallback", () => {
  it("shows fallback notice when requested", () => {
    const html = renderToStaticMarkup(
      createElement(CompletedCodeTaskPreviewScopeSummaryFallback, {
        scope,
        showFallbackNotice: true,
      }),
    );
    expect(html).toContain("실제 앱 Preview URL을 찾지 못해");
  });
});
