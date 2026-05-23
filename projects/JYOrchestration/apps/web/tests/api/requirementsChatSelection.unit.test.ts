import { describe, expect, it } from "vitest";
import { normalizeRequirementsChatSelectionText } from "@/lib/requirements/requirementsChatSelection";

describe("requirementsChatSelection", () => {
  it("normalizes numbered list selection for composer", () => {
    expect(normalizeRequirementsChatSelectionText("1. 액터부터 정의하기")).toBe("액터부터 정의하기");
  });

  it("collapses whitespace in selection", () => {
    expect(normalizeRequirementsChatSelectionText("  서비스   흐름  ")).toBe("서비스 흐름");
  });
});
