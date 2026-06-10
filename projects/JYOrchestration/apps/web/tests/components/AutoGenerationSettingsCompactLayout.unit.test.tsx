import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectExecutionEnvironmentModal } from "@/components/project/ProjectExecutionEnvironmentModal";

describe("AutoGenerationSettingsCompactLayout", () => {
  it("does not render visible modal title heading", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectExecutionEnvironmentModal, {
        projectId: "p1",
        project: null,
        canEdit: true,
        open: true,
        onClose: () => {},
      }),
    );
    expect(html).not.toMatch(/font-size:\s*17px[^>]*>[\s\S]*자동 생성 환경설정/);
    expect(html).toContain("project-execution-environment-modal-title");
    expect(html).toContain("기본 연결 상태");
  });
});
