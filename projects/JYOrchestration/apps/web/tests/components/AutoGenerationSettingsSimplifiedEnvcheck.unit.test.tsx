import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AutoGenerationSplitPreflightPanel } from "@/components/settings/AutoGenerationSplitPreflightPanel";
import { normalizeAutoGenerationConnectionTestResult } from "@/lib/prototype/autoGenerationConnectionTestNormalizer";

describe("AutoGenerationSettingsSimplifiedEnvcheck", () => {
  it("shows only envcheck section without preview preflight UI", () => {
    const html = renderToStaticMarkup(
      createElement(AutoGenerationSplitPreflightPanel, {
        connectionTest: normalizeAutoGenerationConnectionTestResult({
          checkedAt: new Date().toISOString(),
          settingsConnectionTestOnly: true,
        }),
        connectionTestAttempted: true,
      }),
    );
    expect(html).toContain('data-testid="auto-gen-envcheck"');
    expect(html).not.toContain("auto-gen-preview-preflight");
    expect(html).not.toContain("고급 Preview");
    expect(html).not.toContain("통합 및 Preview 준비");
  });
});
