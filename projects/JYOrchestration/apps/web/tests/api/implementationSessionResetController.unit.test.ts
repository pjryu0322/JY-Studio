import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { IMPLEMENTATION_RESET_SCOPE_TRACE_ACTIONS } from "@/lib/requirements/implementationResetScope";

describe("implementation session reset controller", () => {
  it("documents scope-based reset flow", () => {
    const src = readFileSync(
      join(__dirname, "../../src/components/preview/useImplementationSessionResetController.ts"),
      "utf8",
    );
    expect(src).toContain("ImplementationResetScope");
    expect(src).toContain("onOpenImplementationResetDialog");
    expect(src).not.toContain("IMPLEMENTATION_RESET_CONVERSATION_CONFIRM_MESSAGE");
  });

  it("wires scope dialog open into implementation toolbar", () => {
    const toolbar = readFileSync(
      join(__dirname, "../../src/components/preview/useImplementationToolbarController.tsx"),
      "utf8",
    );
    expect(toolbar).toContain("onOpenImplementationResetDialog");
    expect(toolbar).toContain("구현 단계 초기화");
  });

  it("audit actions are llm/fallback free scope names only", () => {
    const actions = Object.values(IMPLEMENTATION_RESET_SCOPE_TRACE_ACTIONS);
    expect(actions.some((a) => a.includes("keyword"))).toBe(false);
    expect(actions.some((a) => a.includes("heuristic"))).toBe(false);
  });
});
