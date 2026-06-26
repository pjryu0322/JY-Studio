import { describe, expect, it } from "vitest";
import {
  DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_V1,
  normalizeUserProjectKnowledgeMemoryControlV1,
  parseUserProjectKnowledgeMemoryControlV1,
  patchUserProjectKnowledgeMemoryControlV1,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";

describe("projectKnowledgeUserMemoryControlTypes", () => {
  it("undefined raw defaults to enabled=true", () => {
    const c = normalizeUserProjectKnowledgeMemoryControlV1(undefined);
    expect(c.enabled).toBe(true);
    expect(c.version).toBe(DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_V1.version);
  });

  it("preserves enabled=false", () => {
    const parsed = parseUserProjectKnowledgeMemoryControlV1({
      version: "user_project_knowledge_memory_control_v1",
      enabled: false,
    });
    expect(parsed?.enabled).toBe(false);
  });

  it("trim/dedupe id arrays", () => {
    const parsed = parseUserProjectKnowledgeMemoryControlV1({
      version: "user_project_knowledge_memory_control_v1",
      excludedSourceProjectIds: [" a ", "a", "", "b"],
      ignoredMemoryItemIds: ["x", " x "],
      pinnedMemoryItemIds: ["p1"],
    });
    expect(parsed?.excludedSourceProjectIds).toEqual(["a", "b"]);
    expect(parsed?.ignoredMemoryItemIds).toEqual(["x"]);
    expect(parsed?.pinnedMemoryItemIds).toEqual(["p1"]);
  });

  it("drops empty id entries", () => {
    const parsed = parseUserProjectKnowledgeMemoryControlV1({
      version: "user_project_knowledge_memory_control_v1",
      excludedSourceProjectIds: ["", "  ", "ok"],
    });
    expect(parsed?.excludedSourceProjectIds).toEqual(["ok"]);
  });

  it("patch sets updatedAt", () => {
    const next = patchUserProjectKnowledgeMemoryControlV1(
      DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_V1,
      { enabled: false },
      "2026-06-03T00:00:00.000Z",
    );
    expect(next.enabled).toBe(false);
    expect(next.updatedAt).toBe("2026-06-03T00:00:00.000Z");
  });

  it("agentEnabled keeps boolean fields only", () => {
    const parsed = parseUserProjectKnowledgeMemoryControlV1({
      version: "user_project_knowledge_memory_control_v1",
      agentEnabled: { developer: false, planner: true, analyst: "no" },
    });
    expect(parsed?.agentEnabled).toEqual({ developer: false, planner: true });
  });
});
