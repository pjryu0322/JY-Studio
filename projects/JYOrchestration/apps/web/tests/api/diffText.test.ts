import { describe, expect, it } from "vitest";
import { diffText } from "@/lib/diffText";

describe("diffText", () => {
  it("marks added and deleted lines", () => {
    const d = diffText("a\nb", "a\nc");
    expect(d.some((x) => x.kind === "del" && x.text === "b")).toBe(true);
    expect(d.some((x) => x.kind === "add" && x.text === "c")).toBe(true);
    expect(d.some((x) => x.kind === "equal" && x.text === "a")).toBe(true);
  });
});
