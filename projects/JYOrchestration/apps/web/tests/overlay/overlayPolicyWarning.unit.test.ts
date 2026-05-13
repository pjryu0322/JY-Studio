import { describe, expect, it } from "vitest";
import {
  buildOverlayPolicyWarnings,
  buildOverlayPolicyWarningsForResolvedRole,
  buildWorkspaceCatalogUnmappedWarnings,
  overlayPolicyExpectationFlagsFromIdentity,
  parseOverlayPolicyWarningsFromUnknown,
  summarizeOverlayPolicyWarnings,
} from "@/lib/overlay/overlayPolicyWarning";
import {
  groupOverlayPolicyWarningsByCode,
  groupOverlayPolicyWarningsByRole,
  groupOverlayPolicyWarningsBySource,
} from "@/lib/overlay/overlayPolicyWarningSummary";
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

  it("groupOverlayPolicyWarningsBy* helpers count buckets", () => {
    const ws = [
      { code: "X", severity: "info" as const, message: "m", source: "diagnostic" as const, enforcement: "not_applied" as const, roleKey: "a" },
      { code: "X", severity: "info" as const, message: "m2", source: "diagnostic" as const, enforcement: "not_applied" as const },
    ];
    expect(groupOverlayPolicyWarningsByCode(ws).X).toBe(2);
    expect(groupOverlayPolicyWarningsByRole(ws).a).toBe(1);
    expect(groupOverlayPolicyWarningsByRole(ws)["(none)"]).toBe(1);
    expect(groupOverlayPolicyWarningsBySource(ws).diagnostic).toBe(2);
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
      { code: "BAD", severity: "warning", message: "x", source: "diagnostic", enforcement: "blocked" },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.code).toBe("OK");
  });

  it("parseOverlayPolicyWarningsFromUnknown coerces unknown severity to warning", () => {
    const parsed = parseOverlayPolicyWarningsFromUnknown([
      {
        code: "LEGACY",
        severity: "unknown-sev",
        message: "m",
        source: "diagnostic",
        enforcement: "not_applied",
      },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.severity).toBe("warning");
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

  it("summarizeOverlayPolicyWarnings counts severities and aggregates by code, role, source", () => {
    const s = summarizeOverlayPolicyWarnings([
      { code: "A", severity: "warning", message: "a", source: "diagnostic", enforcement: "not_applied", roleKey: "planner" },
      { code: "B", severity: "critical", message: "b", source: "diagnostic", enforcement: "not_applied" },
      { code: "C", severity: "info", message: "c", source: "singlechat", enforcement: "not_applied", roleKey: null },
    ]);
    expect(s.warningCount).toBe(1);
    expect(s.criticalCount).toBe(1);
    expect(s.infoCount).toBe(1);
    expect(s.byCode.A).toBe(1);
    expect(s.byCode.B).toBe(1);
    expect(s.byRole.planner).toBe(1);
    expect(s.byRole["(none)"]).toBe(2);
    expect(s.bySource.diagnostic).toBe(2);
    expect(s.bySource.singlechat).toBe(1);
  });
});
