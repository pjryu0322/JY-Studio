import { describe, expect, it } from "vitest";
import { reorderWorkNoteMemoIds } from "@/lib/worknote/workNoteMemoRailReorder";

describe("reorderWorkNoteMemoIds", () => {
  it("moves source before target index", () => {
    expect(reorderWorkNoteMemoIds(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
  });

  it("returns null when ids are missing", () => {
    expect(reorderWorkNoteMemoIds(["a", "b"], "x", "a")).toBeNull();
  });
});
