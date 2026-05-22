import { describe, expect, it } from "vitest";
import {
  buildAiPlannerContextBlocksFromTranscript,
  formatAiPlannerContextBlocksForPrompt,
} from "@/lib/requirements/aiPlannerContextBlocks";
import {
  buildAiPlannerSystemPrompt,
  PRE_PROJECT_BRAINSTORM_PLANNER_PROMPT,
  PROJECT_SINGLE_CHAT_PLANNER_PROMPT,
} from "@/lib/requirements/aiPlannerSystemPrompt";
import { shouldInjectDocumentCollaborationContext } from "@/lib/requirements/documentContextInjection";
import { resolveAiPlannerPromptMode } from "@/lib/requirements/plannerPromptMode";
import {
  buildSingleChatPromptTimelineEntry,
  coerceRequirementsPromptTimelineEntry,
} from "@/lib/requirements/requirementsIdeationBootstrapPromptTimeline";

describe("resolveAiPlannerPromptMode", () => {
  it("maps empty projectId to pre_project_brainstorm", () => {
    expect(resolveAiPlannerPromptMode({ projectId: "" })).toBe("pre_project_brainstorm");
    expect(resolveAiPlannerPromptMode({ projectId: null })).toBe("pre_project_brainstorm");
  });

  it("maps projectId to project_single_chat", () => {
    expect(resolveAiPlannerPromptMode({ projectId: "proj-1" })).toBe("project_single_chat");
  });
});

describe("buildAiPlannerSystemPrompt", () => {
  it("pre_project prompt emphasizes brainstorming not early fixation", () => {
    const p = buildAiPlannerSystemPrompt({ mode: "pre_project_brainstorm" });
    expect(p).toContain("브레인스토밍");
    expect(p).toContain("요구사항 목록으로 바로 고정하지 않습니다");
    expect(p).not.toBe(PROJECT_SINGLE_CHAT_PLANNER_PROMPT);
  });

  it("project_single_chat prompt emphasizes structure and deliverables", () => {
    const p = buildAiPlannerSystemPrompt({ mode: "project_single_chat" });
    expect(p).toContain("구조화");
    expect(p).toContain("산출물");
    expect(p).not.toBe(PRE_PROJECT_BRAINSTORM_PLANNER_PROMPT);
  });

  it("two modes produce different prompts", () => {
    const pre = buildAiPlannerSystemPrompt({ mode: "pre_project_brainstorm" });
    const proj = buildAiPlannerSystemPrompt({ mode: "project_single_chat" });
    expect(pre).not.toEqual(proj);
  });
});

describe("shouldInjectDocumentCollaborationContext", () => {
  it("returns false for JSON dashboard / data collection topics", () => {
    expect(
      shouldInjectDocumentCollaborationContext({
        text: "modoo.or.kr에서 JSON 대시보드로 데이터를 보여주고 싶어요",
      })
    ).toBe(false);
    expect(
      shouldInjectDocumentCollaborationContext({
        text: "데이터베이스에 저장하지 말고 JSON 같은 정보로 관리해줘. 로그인 없이 공개 조회.",
      })
    ).toBe(false);
  });

  it("returns true for PDF / document collaboration review", () => {
    expect(
      shouldInjectDocumentCollaborationContext({
        text: "PDF 문서를 같이 검토하고 주석을 달고 싶어요",
      })
    ).toBe(true);
    expect(
      shouldInjectDocumentCollaborationContext({
        text: "문서 협업 시스템에서 파일 업로드 후 검토",
      })
    ).toBe(true);
  });

  it("returns false for standalone documentize request", () => {
    expect(shouldInjectDocumentCollaborationContext({ text: "문서화해줘" })).toBe(false);
  });
});

describe("pre-project context blocks", () => {
  it("uses exploration constraints labels not confirmed requirements", () => {
    const blocks = buildAiPlannerContextBlocksFromTranscript(
      [
        {
          role: "user",
          content: "데이터베이스에 저장하지 말고 JSON으로 관리. 로그인 없이 공개 조회. 필터는 분야와 세분분야만.",
        },
      ],
      "pre_project_brainstorm"
    );
    const text = formatAiPlannerContextBlocksForPrompt(blocks, "pre_project_brainstorm");
    expect(text).toContain("[사용자가 명시한 제약]");
    expect(text).not.toContain("[확정된 프로젝트 방향]");
    expect((blocks.userConstraints ?? []).length).toBeGreaterThan(0);
  });
});

describe("prompt timeline entry metadata", () => {
  it("stores project_single_chat mode on SingleChat entries", () => {
    const entry = buildSingleChatPromptTimelineEntry({
      action: "requirementsChatOrchestration",
      source: "llm",
      timelineStage: "requirements",
      stageGroup: "서비스 기획",
      workspaceScreenKey: "requirements_ideation",
      selectedAgents: [],
      promptText: "[system]\ntest",
      responseText: "ok",
    });
    expect(entry.aiPlannerMode).toBe("project_single_chat");
  });

  it("coerces aiPlannerMode and contextBlocks", () => {
    const coerced = coerceRequirementsPromptTimelineEntry({
      stage: "ideation",
      action: "test",
      source: "llm",
      createdAt: new Date().toISOString(),
      aiPlannerMode: "pre_project_brainstorm",
      roomId: "room-1",
      contextBlocks: { userConstraints: ["JSON only"] },
      domainContextInjected: [],
    });
    expect(coerced?.aiPlannerMode).toBe("pre_project_brainstorm");
    expect(coerced?.roomId).toBe("room-1");
    expect(coerced?.contextBlocks?.userConstraints).toEqual(["JSON only"]);
  });
});
