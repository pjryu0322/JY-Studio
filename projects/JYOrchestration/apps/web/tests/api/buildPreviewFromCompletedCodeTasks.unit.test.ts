import { describe, expect, it } from "vitest";
import { buildPreviewFromCompletedCodeTasks } from "@/lib/prototype/buildPreviewFromCompletedCodeTasks";
import { buildImplementationPreviewScopeV1 } from "@/lib/prototype/implementationPreviewScopeV1";

const NOW = "2026-06-03T12:00:00.000Z";

describe("buildPreviewFromCompletedCodeTasks", () => {
  it("returns ready runtime and previewUrl when included tasks exist", () => {
    const previewScope = buildImplementationPreviewScopeV1({
      generatedAt: NOW,
      included: [
        {
          codeTaskId: "CT-1",
          taskId: "DEV-A",
          title: "Shell",
          commitSha: "sha",
        },
      ],
      excluded: [
        {
          codeTaskId: "CT-2",
          taskId: "DEV-A",
          title: "Pending",
          status: "prompt_ready",
          reason: "미완료",
        },
      ],
      warnings: ["shell warning"],
    });

    const result = buildPreviewFromCompletedCodeTasks({
      projectId: "p1",
      previewScope,
      nowIso: NOW,
    });

    expect(result.ok).toBe(true);
    expect(result.runtime.status).toBe("ready");
    expect(result.previewUrl).toBe("/projects/p1/preview?scope=latest");
    expect(result.runtime.appPreviewUrl).toBe("/projects/p1/preview/app?scope=latest");
    expect(result.runtime.internalAppPreviewUrl).toBe("/projects/p1/preview/app?scope=latest");
    expect(result.runtime.renderMode).toBe("internal_generated_app");
    expect(result.runtime.openMode).toBe("internal_renderer");
    expect(result.runtime.includedCodeTaskIds).toEqual(["CT-1"]);
    expect(result.runtime.excludedCodeTaskIds).toEqual(["CT-2"]);
    expect(result.runtime.warnings).toEqual(["shell warning"]);
  });

  it("uses external preview URL when provided", () => {
    const previewScope = buildImplementationPreviewScopeV1({
      generatedAt: NOW,
      included: [
        {
          codeTaskId: "CT-1",
          taskId: "DEV-A",
          title: "Shell",
          commitSha: "sha",
        },
      ],
      excluded: [],
      warnings: [],
    });

    const result = buildPreviewFromCompletedCodeTasks({
      projectId: "p1",
      previewScope,
      nowIso: NOW,
      externalPreviewUrl: "https://demo.example/app",
    });

    expect(result.runtime.appPreviewUrl).toBe("https://demo.example/app");
    expect(result.runtime.externalPreviewUrl).toBe("https://demo.example/app");
    expect(result.runtime.renderMode).toBe("external_preview");
    expect(result.runtime.openMode).toBe("external_new_window");
  });

  it("returns failed when no included tasks", () => {
    const previewScope = buildImplementationPreviewScopeV1({
      generatedAt: NOW,
      included: [],
      excluded: [],
      warnings: [],
    });

    const result = buildPreviewFromCompletedCodeTasks({
      projectId: "p1",
      previewScope,
      nowIso: NOW,
    });

    expect(result.ok).toBe(false);
    expect(result.runtime.status).toBe("failed");
    expect(result.previewUrl).toBeNull();
    expect(result.errorMessage).toMatch(/완료된 CodeTask/);
  });
});
