import { describe, expect, it } from "vitest";
import {
  buildOverlayPolicyWarnings,
  buildOverlayPolicyWarningsForResolvedRole,
  buildWorkspaceCatalogUnmappedWarnings,
  overlayPolicyExpectationFlagsFromIdentity,
  parseOverlayPolicyWarningsFromUnknown,
  summarizeOverlayPolicyWarnings,
} from "@/lib/overlay/overlayPolicyWarning";
import { resolveAiIdentityContract } from "@/lib/overlay/overlayRuntimeResolver";

describe("overlayPolicyWarning", () => {
  it("emits OVERLAY_ROLE_UNRESOLVED for unknown role key", () => {
    const w = buildOverlayPolicyWarnings({
      roleKey: "__definitely_not_a_contract_role__",
      source: "diagnostic",
    });
    expect(w.some((x) => x.code === "OVERLAY_ROLE_UNRESOLVED")).toBe(true);
    expect(w.every((x) => x.enforcement === "not_applied")).toBe(true);
  });

  it("emits OVERLAY_CURSOR_CAPABILITY_NOT_ALLOWED when cursor requested but policy disallows", () => {
    const w = buildOverlayPolicyWarnings({
      roleKey: "planner",
      source: "singlechat",
      cursorRequested: true,
    });
    expect(w.some((x) => x.code === "OVERLAY_CURSOR_CAPABILITY_NOT_ALLOWED")).toBe(true);
    expect(w.find((x) => x.code === "OVERLAY_CURSOR_CAPABILITY_NOT_ALLOWED")?.severity).toBe("warning");
  });

  it("workspace unmapped catalog produces diagnostic warnings", () => {
    const w = buildWorkspaceCatalogUnmappedWarnings(["fake_catalog_key"]);
    expect(w).toHaveLength(1);
    expect(w[0]?.code).toBe("OVERLAY_WORKSPACE_CATALOG_UNMAPPED");
    expect(w[0]?.source).toBe("diagnostic");
  });

  it("parseOverlayPolicyWarningsFromUnknown drops invalid rows", () => {
    const parsed = parseOverlayPolicyWarningsFromUnknown([
      {
        code: "OK",
        severity: "warning",
        message: "m",
        source: "diagnostic",
        enforcement: "not_applied",
      },
      { code: "", severity: "warning", message: "x", source: "diagnostic", enforcement: "not_applied" },
      { code: "BAD", severity: "nope", message: "x", source: "diagnostic", enforcement: "not_applied" },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.code).toBe("OK");
  });

  it("overlayPolicyExpectationFlagsFromIdentity derives from capabilities", () => {
    const id = resolveAiIdentityContract("domain-expert");
    expect(id).toBeTruthy();
    const f = overlayPolicyExpectationFlagsFromIdentity(id);
    expect(f.knowledgeHintsExpected).toBe(true);
    expect(f.contextAssemblyExpected).toBe(true);
  });

  it("buildOverlayPolicyWarningsForResolvedRole matches manual buildOverlayPolicyWarnings for planner", () => {
    const id = resolveAiIdentityContract("planner");
    const a = buildOverlayPolicyWarningsForResolvedRole({ policyRoleKey: "planner", source: "singlechat", identity: id });
    const flags = overlayPolicyExpectationFlagsFromIdentity(id);
    const b = buildOverlayPolicyWarnings({
      roleKey: "planner",
      source: "singlechat",
      cursorRequested: false,
      knowledgeHintsExpected: flags.knowledgeHintsExpected,
      contextAssemblyExpected: flags.contextAssemblyExpected,
    });
    expect(a.map((x) => x.code).sort()).toEqual(b.map((x) => x.code).sort());
  });

  it("summarizeOverlayPolicyWarnings counts severities", () => {
    const s = summarizeOverlayPolicyWarnings([
      { code: "A", severity: "warning", message: "a", source: "diagnostic", enforcement: "not_applied" },
      { code: "B", severity: "critical", message: "b", source: "diagnostic", enforcement: "not_applied" },
      { code: "C", severity: "info", message: "c", source: "diagnostic", enforcement: "not_applied" },
    ]);
    expect(s.warningCount).toBe(1);
    expect(s.criticalCount).toBe(1);
    expect(s.infoCount).toBe(1);
  });
});
