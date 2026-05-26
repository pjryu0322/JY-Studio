import { describe, expect, it } from "vitest";
import { fallbackAnalyzeImplementationUserTurnByRule } from "@/lib/workspace-turn/implementationTurnRuleFallback";
import { implementationModeTurnConfig } from "@/lib/workspace-turn/implementationModeTurnConfig";
import { runWorkspaceTurn } from "@/lib/workspace-turn/workspaceTurnOrchestrator";
import {
  buildImplementationTurnInterviewSuggestions,
  isExplicitImplementationExecutionRequest,
} from "@/lib/prototype/implementationUserFeedback";
import { validateImplementationTurnModelJson } from "@/lib/workspace-turn/workspaceTurnValidation";

const baseContext = { requirementsStateJson: {}, envOk: false };

function analyze(text: string) {
  return fallbackAnalyzeImplementationUserTurnByRule({ userMessage: text, envOk: false });
}

describe("workspace turn orchestrator", () => {
  it("runs workspace turn with mode config and returns validated model result", async () => {
    const config = {
      ...implementationModeTurnConfig,
      fallbackAnalyze: (input: Parameters<typeof implementationModeTurnConfig.fallbackAnalyze>[0]) =>
        implementationModeTurnConfig.fallbackAnalyze(input),
    };

    const result = await runWorkspaceTurn({
      config,
      apiKey: "",
      input: {
        projectId: "p1",
        projectName: "테스트",
        projectDescription: "설명",
        userMessage: "허용파일은 MP3, WAV만 해줘",
        userMessageId: "m1",
        envOk: false,
        context: baseContext,
      },
    });

    expect(result.mode).toBe("implementation");
    expect(result.modelResult.intent).toBe("implementation_requirement");
    expect(result.statePatch.orchestration).toBeDefined();
  });

  it("classifies ambiguous UI preference as candidate requiring clarification", () => {
    const result = analyze("UI는 채팅형이면 좋겠는데");

    expect(result.intent).toBe("implementation_preference");
    expect(result.status).toBe("candidate");
    expect(result.requiresClarification).toBe(true);
    expect(result.assistantMessage).not.toContain("요청하신 구현 기준을 반영했습니다");
  });

  it("answers implementation clarification request with implementation-specific checklist", () => {
    const result = analyze("내가 더 뭘 정의해줘야 하지");

    expect(result.intent).toBe("implementation_question");
    expect(result.assistantMessage).toContain("구현 작업안");
    expect(result.assistantMessage).toContain("채팅형 UI 적용 범위");
    expect(result.assistantMessage).not.toContain("어떤 사용자나 역할을 고려");
  });

  it("extracts concrete file upload policies as confirmed candidate", () => {
    const result = analyze("허용파일은 MP3, WAV만 해줘\n첨부파일은 100MB 이하");

    expect(result.intent).toBe("implementation_requirement");
    expect(result.status).toBe("confirmed_candidate");
    expect(result.extractedRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "허용 파일 형식" }),
        expect.objectContaining({ label: "첨부파일 용량 제한" }),
      ]),
    );
  });

  it("keeps explicit execution request in rule gate path", () => {
    expect(isExplicitImplementationExecutionRequest("작업 계획 생성")).toBe(true);
    const result = analyze("작업 계획 생성");
    expect(result.intent).toBe("execution_request");
    expect(result.status).toBe("blocked");
  });

  it("does not duplicate next question as both body and chip label", () => {
    const model = analyze("내가 더 뭘 정의해줘야 하지");
    const chips = buildImplementationTurnInterviewSuggestions(model);
    for (const chip of chips) {
      expect(model.assistantMessage).not.toContain(chip);
    }
  });

  it("validates implementation turn LLM JSON shape", () => {
    const parsed = validateImplementationTurnModelJson({
      intent: "implementation_preference",
      status: "candidate",
      confidence: "medium",
      responderLabel: "AI 개발자",
      assistantMessage: "후보로 반영했습니다.",
      summary: "pref",
      extractedRules: [],
      targetAreas: ["screen_implementation_items"],
      requiresClarification: true,
      clarifyingQuestion: "범위 정하기",
      nextQuestion: null,
    });
    expect(parsed?.status).toBe("candidate");
  });
});
