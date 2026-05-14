import { describe, expect, it } from "vitest";

import { classifyMemoryRuntimeScope } from "@/lib/harness/memoryRuntime/memoryRuntimeScopeClassifier";

describe("classifyMemoryRuntimeScope", () => {
  it("returns explicit scope when source has the scope token", () => {
    expect(classifyMemoryRuntimeScope({ source: "project-context" })).toBe("project");
    expect(classifyMemoryRuntimeScope({ source: "role-policy" })).toBe("role");
    expect(classifyMemoryRuntimeScope({ source: "session-cache" })).toBe("session");
    expect(classifyMemoryRuntimeScope({ source: "working-set" })).toBe("working");
    expect(classifyMemoryRuntimeScope({ source: "platform-default" })).toBe("platform");
  });

  it("classifies role memory when role token + roleKey is present", () => {
    expect(
      classifyMemoryRuntimeScope({
        source: "rolePolicy:planner",
        roleKey: "planner",
      })
    ).toBe("role");
  });

  it("classifies project memory by domain tokens", () => {
    expect(
      classifyMemoryRuntimeScope({
        source: "requirementsStateJson",
      })
    ).toBe("project");
    expect(
      classifyMemoryRuntimeScope({
        memoryId: "singleChatOrchestrationV1",
      })
    ).toBe("project");
  });

  it("classifies working memory by workspaceScreenKey/working-token", () => {
    expect(
      classifyMemoryRuntimeScope({
        source: "localStorage",
      })
    ).toBe("working");
    expect(
      classifyMemoryRuntimeScope({
        memoryId: "current-input-stage",
        workspaceScreenKey: "current-input-stage",
      })
    ).toBe("working");
  });

  it("classifies session memory for chat-message tokens", () => {
    expect(
      classifyMemoryRuntimeScope({
        source: "ChatMessage",
      })
    ).toBe("session");
    expect(
      classifyMemoryRuntimeScope({
        memoryId: "dialogueExcerpt:abc",
      })
    ).toBe("session");
  });

  it("falls back to working when nothing matches", () => {
    expect(classifyMemoryRuntimeScope({})).toBe("working");
    expect(classifyMemoryRuntimeScope({ source: "unknown-blob" })).toBe("working");
  });

  it("explicit role token via source beats project token in memoryId", () => {
    expect(
      classifyMemoryRuntimeScope({
        source: "role-knowledge",
        memoryId: "projectMember-foo",
      })
    ).toBe("role");
  });
});
