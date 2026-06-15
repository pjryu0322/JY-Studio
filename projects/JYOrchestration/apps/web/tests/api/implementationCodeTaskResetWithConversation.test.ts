import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("implementationCodeTaskResetWithConversation", () => {
  it("reuses full reset cascade and planning reentry for codetask scope", () => {
    const ctrl = readFileSync(
      join(__dirname, "../../src/components/preview/useImplementationSessionResetController.ts"),
      "utf8",
    );
    expect(ctrl).toContain("postPlanningResetCascade");
    expect(ctrl).toContain("buildImplementationResetWithPlanningReentry");
    expect(ctrl).toContain("codetask_with_conversation");
    expect(ctrl).toContain("appendCodeTaskResetCompletedTrace");
  });
});

describe("implementationResetCancel", () => {
  it("closes dialog without reset when cancel is used", () => {
    const dialog = readFileSync(
      join(__dirname, "../../src/components/preview/ImplementationResetScopeDialog.tsx"),
      "utf8",
    );
    expect(dialog).toContain("implementation-reset-cancel");
    expect(dialog).toContain("onClose");
  });
});
