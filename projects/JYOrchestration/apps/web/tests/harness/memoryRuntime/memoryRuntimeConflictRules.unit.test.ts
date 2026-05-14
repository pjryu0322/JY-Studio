import { describe, expect, it } from "vitest";

import {
  classifyMemoryRuntimeConflictCategory,
  detectMemoryRuntimeDirectionalConflict,
  listMemoryRuntimeConflictCategories,
} from "@/lib/harness/memoryRuntime/memoryRuntimeConflictRules";

describe("detectMemoryRuntimeDirectionalConflict", () => {
  it("returns false when directional keywords empty", () => {
    expect(
      detectMemoryRuntimeDirectionalConflict({
        memoryText: "We are using monolith",
        currentDirectionalKeywords: [],
      })
    ).toBe(false);
  });

  it("detects monolith vs microservice conflict (architecture)", () => {
    expect(
      detectMemoryRuntimeDirectionalConflict({
        memoryText: "Legacy monolith server",
        currentDirectionalKeywords: ["microservice"],
      })
    ).toBe(true);
    expect(
      detectMemoryRuntimeDirectionalConflict({
        memoryText: "Now we deploy microservices",
        currentDirectionalKeywords: ["monolith"],
      })
    ).toBe(true);
  });

  it("detects session vs jwt conflict (auth)", () => {
    expect(
      detectMemoryRuntimeDirectionalConflict({
        memoryText: "Session-based auth with cookie",
        currentDirectionalKeywords: ["jwt"],
      })
    ).toBe(true);
  });

  it("detects localStorage vs server DB conflict (storage)", () => {
    expect(
      detectMemoryRuntimeDirectionalConflict({
        memoryText: "User preferences stored in localStorage",
        currentDirectionalKeywords: ["server db"],
      })
    ).toBe(true);
  });

  it("detects on-premise vs cloud conflict (deployment)", () => {
    expect(
      detectMemoryRuntimeDirectionalConflict({
        memoryText: "Currently running on-premise hardware",
        currentDirectionalKeywords: ["cloud"],
      })
    ).toBe(true);
  });

  it("returns false when both sides match the same direction", () => {
    expect(
      detectMemoryRuntimeDirectionalConflict({
        memoryText: "microservice deployment notes",
        currentDirectionalKeywords: ["microservice"],
      })
    ).toBe(false);
  });

  it("ignores empty memory text", () => {
    expect(
      detectMemoryRuntimeDirectionalConflict({
        memoryText: "",
        currentDirectionalKeywords: ["microservice"],
      })
    ).toBe(false);
  });
});

describe("classifyMemoryRuntimeConflictCategory", () => {
  it("returns null for empty input", () => {
    expect(classifyMemoryRuntimeConflictCategory("")).toBeNull();
  });

  it("labels storage keyword", () => {
    expect(classifyMemoryRuntimeConflictCategory("Using SQL primary database")).toBe("storage");
  });

  it("labels auth keyword", () => {
    expect(classifyMemoryRuntimeConflictCategory("Use bearer token for API")).toBe("auth");
  });
});

describe("listMemoryRuntimeConflictCategories", () => {
  it("returns sorted category keys", () => {
    expect(listMemoryRuntimeConflictCategories()).toEqual([
      "architecture",
      "auth",
      "deployment",
      "storage",
    ]);
  });
});
