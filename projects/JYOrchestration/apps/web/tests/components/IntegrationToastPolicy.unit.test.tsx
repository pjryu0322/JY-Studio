import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readImplementationStagePanelSources } from "../helpers/implementationStagePanelSources";

describe("IntegrationToastPolicy", () => {
  it("23. integration click uses preview checking toast not auto generation block", () => {
    const src = readImplementationStagePanelSources();
    expect(src).toContain("INTEGRATION_PREVIEW_PREFLIGHT_CHECKING_USER_MESSAGE");
    expect(src).not.toContain('showToast("자동 생성 기본 연결을 먼저 정상화해 주세요.")');
  });

  it("run-pipeline auto generation message only when resolveAutoGenerationReady fails", () => {
    const src = readFileSync(
      join(__dirname, "../../src/app/api/prototype/integration/run-pipeline/route.ts"),
      "utf8",
    );
    expect(src).toContain("resolveAutoGenerationReadyFromCapabilityJson");
    expect(src).toContain("자동 생성 기본 연결을 먼저 정상화해 주세요.");
  });
});
