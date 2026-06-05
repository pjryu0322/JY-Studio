import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CompletedCodeTaskPreviewPageClient,
  CompletedCodeTaskPreviewScopeSummaryFallback,
} from "@/components/preview/CompletedCodeTaskPreviewPageClient";
import { buildImplementationPreviewScopeV1 } from "@/lib/prototype/implementationPreviewScopeV1";
import { IMPLEMENTATION_PREVIEW_RUNTIME_VERSION } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { IMPLEMENTATION_PREVIEW_SCOPE_VERSION } from "@/lib/prototype/implementationPreviewScopeV1";
import { resolveCompletedCodeTaskPreviewMainMode } from "@/lib/prototype/completedCodeTaskPreviewView";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";

const NOW = "2026-06-03T12:00:00.000Z";

const scope = buildImplementationPreviewScopeV1({
  generatedAt: NOW,
  included: [{ codeTaskId: "CT-1", taskId: "DEV-A", title: "입력 화면", commitSha: "sha" }],
  excluded: [{ codeTaskId: "CT-2", taskId: "DEV-A", title: "결과", status: "prompt_ready", reason: "미완료" }],
  warnings: [],
});

describe("completedCodeTaskPreviewView", () => {
  it("uses iframe mode when appPreviewUrl is ready", () => {
    const runtime: ImplementationPreviewRuntimeV1 = {
      version: IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
      status: "ready",
      previewUrl: "/projects/p1/preview?scope=latest",
      appPreviewUrl: "/projects/p1/preview/app?scope=latest",
      renderMode: "generated_app_iframe",
      sourceScopeVersion: IMPLEMENTATION_PREVIEW_SCOPE_VERSION,
      includedCodeTaskIds: ["CT-1"],
      excludedCodeTaskIds: ["CT-2"],
      warnings: [],
    };
    expect(resolveCompletedCodeTaskPreviewMainMode(runtime)).toBe("iframe");
  });

  it("uses scope summary fallback mode when renderMode says so", () => {
    const runtime: ImplementationPreviewRuntimeV1 = {
      version: IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
      status: "ready",
      previewUrl: "/projects/p1/preview?scope=latest",
      appPreviewUrl: null,
      renderMode: "scope_summary_fallback",
      sourceScopeVersion: IMPLEMENTATION_PREVIEW_SCOPE_VERSION,
      includedCodeTaskIds: ["CT-1"],
      excludedCodeTaskIds: ["CT-2"],
      warnings: [],
    };
    expect(resolveCompletedCodeTaskPreviewMainMode(runtime)).toBe("scope_summary_fallback");
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
    expect(html).toContain("completed-codetask-preview-scope-fallback");
    expect(html).toContain("실제 앱 Preview URL을 찾지 못해");
    expect(html).toContain("입력 화면");
  });
});

describe("CompletedCodeTaskPreviewPageClient export", () => {
  it("exports client component", () => {
    expect(typeof CompletedCodeTaskPreviewPageClient).toBe("function");
  });
});
