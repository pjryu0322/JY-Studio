import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AutoGenerationSplitPreflightPanel } from "@/components/settings/AutoGenerationSplitPreflightPanel";
import { normalizeAutoGenerationConnectionTestResult } from "@/lib/prototype/autoGenerationConnectionTestNormalizer";

describe("AutoGenerationSettingsSectionSummaries", () => {
  it("renders three section summary cards", () => {
    const connectionTest = normalizeAutoGenerationConnectionTestResult({
      checkedAt: "2026-06-01T00:00:00.000Z",
    });
    const html = renderToStaticMarkup(
      createElement(AutoGenerationSplitPreflightPanel, {
        connectionTest,
        connectionTestAttempted: true,
      }),
    );
    expect(html).toContain("auto-gen-split-status-messages");
    expect(html).toContain("기본 연결 상태:");
    expect(html).toContain("자동 생성 기본 점검:");
    expect(html).toContain("Preview 배포 사전점검:");
  });

  it("does not render raw operator messages in summary cards", () => {
    const connectionTest = normalizeAutoGenerationConnectionTestResult({
      thrownError: new Error("HttpError: 403 forbidden at internal/api"),
      checkedAt: "2026-06-01T00:00:00.000Z",
    });
    const html = renderToStaticMarkup(
      createElement(AutoGenerationSplitPreflightPanel, {
        connectionTest,
        connectionTestAttempted: true,
      }),
    );
    expect(html).not.toContain("internal/api");
    expect(html).not.toContain("403 forbidden");
  });
});
