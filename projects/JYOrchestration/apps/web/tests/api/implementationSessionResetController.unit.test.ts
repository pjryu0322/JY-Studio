import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { IMPLEMENTATION_RESET_CONVERSATION_CONFIRM_MESSAGE } from "@/lib/requirements/resetDerivedImplementationState";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation session reset controller", () => {
  it("documents implementation-only reset confirm copy", () => {
    expect(IMPLEMENTATION_RESET_CONVERSATION_CONFIRM_MESSAGE).toContain("기획 산출물");
    expect(IMPLEMENTATION_RESET_CONVERSATION_CONFIRM_MESSAGE).toContain("구현 단계");
  });

  it("cascades runtime DB and persists buildImplementationConversationResetStateJson", () => {
    const src = readFileSync(join(previewDir, "useImplementationSessionResetController.ts"), "utf8");
    expect(src).toContain("postPlanningResetCascade");
    expect(src).toContain("buildImplementationConversationResetStateJson");
    expect(src).toContain('reason: "manual"');
  });

  it("wires reset into implementation toolbar", () => {
    const toolbar = readFileSync(join(previewDir, "useImplementationToolbarController.tsx"), "utf8");
    expect(toolbar).toContain("onResetImplementationSession");
    expect(toolbar).toContain("구현 단계 초기화");
  });
});
