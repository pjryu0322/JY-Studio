import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getIntegrationPreviewRemediationGuide } from "@/lib/prototype/integrationPreviewRemediationGuide";

describe("IntegrationPreviewPreflightToast", () => {
  it("14. PrototypePreviewPanel shows checking message on integration click", () => {
    const src = readFileSync(
      join(__dirname, "../../src/components/preview/PrototypePreviewPanel.tsx"),
      "utf8",
    );
    expect(src).toContain("INTEGRATION_PREVIEW_PREFLIGHT_CHECKING_USER_MESSAGE");
  });

  it("16. permission guide includes re-run integration instruction", () => {
    const guide = getIntegrationPreviewRemediationGuide("github_preview_permission_required");
    expect(guide?.actionLines.some((line) => line.includes("통합 및 Preview 준비"))).toBe(true);
  });
});
