import { describe, expect, it } from "vitest";
import {
  formatUserProjectKnowledgeMemoryTimelineBlock,
  formatUserProjectKnowledgeMemoryTimelineLine,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryTimelineUi";

describe("projectKnowledgeUserMemoryTimelineUi", () => {
  it("shows injected count in Korean", () => {
    const line = formatUserProjectKnowledgeMemoryTimelineLine({
      kind: "user_project_knowledge_memory_context",
      agent: "planner",
      itemCount: 2,
      sourceProjectCount: 1,
      injected: true,
    });
    expect(line).toBe("기획자: 2개 참조됨");
  });

  it("shows no reference when not injected", () => {
    const line = formatUserProjectKnowledgeMemoryTimelineLine({
      kind: "user_project_knowledge_memory_context",
      agent: "developer",
      itemCount: 0,
      sourceProjectCount: 0,
      injected: false,
    });
    expect(line).toBe("개발자: 참조 없음");
  });

  it("shows disabled message when enabled=false", () => {
    const block = formatUserProjectKnowledgeMemoryTimelineBlock({ enabled: false });
    expect(block).toBe("User Project Knowledge Memory · 자동 반영 꺼짐");
  });

  it("does not include raw ids in formatter output", () => {
    const block = formatUserProjectKnowledgeMemoryTimelineBlock({
      enabled: true,
      contexts: [
        {
          kind: "user_project_knowledge_memory_context",
          agent: "planner",
          itemCount: 1,
          sourceProjectCount: 1,
          injected: true,
        },
      ],
    });
    expect(block).not.toContain("sourceProjectId");
    expect(block).not.toContain("sourceNodeId");
    expect(block).toMatch(/기획자/);
  });
});
