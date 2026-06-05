import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GeneratedAppPreviewRenderer } from "@/components/preview/GeneratedAppPreviewRenderer";
import { buildImplementationPreviewScopeV1 } from "@/lib/prototype/implementationPreviewScopeV1";

const NOW = "2026-06-03T12:00:00.000Z";

describe("GeneratedAppPreviewRenderer", () => {
  it("renders app shell and input panels from scope", () => {
    const scope = buildImplementationPreviewScopeV1({
      generatedAt: NOW,
      included: [
        { codeTaskId: "CT-SHELL", taskId: "DEV-A", title: "화면 프레임/앱 Shell 구성", commitSha: "a" },
        { codeTaskId: "CT-INPUT", taskId: "DEV-A", title: "입력 화면 화면 구현", commitSha: "b" },
      ],
      excluded: [
        {
          codeTaskId: "CT-OUT",
          taskId: "DEV-A",
          title: "결과 화면 화면 구현",
          status: "prompt_ready",
          reason: "미완료",
        },
      ],
      warnings: [],
    });

    const html = renderToStaticMarkup(
      createElement(GeneratedAppPreviewRenderer, {
        projectId: "p1",
        projectName: "데모",
        previewScope: scope,
      }),
    );

    expect(html).toContain("generated-app-preview-renderer");
    expect(html).toContain("데모");
    expect(html).toContain("입력 화면");
  });
});
