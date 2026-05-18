import { describe, expect, it } from "vitest";

import { filterOverlayRuntimeDiagnosticDataForAudience } from "@/lib/overlay/overlayRuntimeDiagnosticAudienceFilter";

describe("filterOverlayRuntimeDiagnosticDataForAudience", () => {
  it("strips internal keys for user audience", () => {
    const data = {
      overlayRuntimeEnabled: true,
      lastPromptTraceOverlayExtract: { a: 1 },
      workspaceAiMemberOverlayMappings: { b: 2 },
      harnessMaturityBaselineReport: { mode: "read_only_maturity_baseline" },
    };
    const out = filterOverlayRuntimeDiagnosticDataForAudience(data, "user");
    expect(out.lastPromptTraceOverlayExtract).toBeUndefined();
    expect(out.workspaceAiMemberOverlayMappings).toBeUndefined();
    expect(out.harnessMaturityBaselineReport).toBeDefined();
  });

  it("passes through for operator", () => {
    const data = { lastPromptTraceOverlayExtract: { x: 1 } };
    const out = filterOverlayRuntimeDiagnosticDataForAudience(data, "operator");
    expect(out.lastPromptTraceOverlayExtract).toEqual({ x: 1 });
  });
});
