import { describe, expect, it } from "vitest";
import {
  classifyConversationIntentFromRules,
  mergeConversationIntentWithRulesGuard,
} from "@/lib/conversation-core/conversationIntentClassifier";
import {
  defaultResponsePolicyForMode,
  messengerBasePromptForMode,
} from "@/lib/conversation-core/conversationResponsePolicy";
import { formatConversationPromptMeta } from "@/lib/conversation-core/conversationPromptMeta";
import { buildMessengerSystemBlockForTest } from "@/lib/messenger/messengerLlm";
import { shouldInjectDocumentCollaborationContextStrictFallback } from "@/lib/requirements/documentContextInjection";

const pre = { scope: "pre_project" as const, participationMode: "planner_only" as const };

function classifyLast(text: string) {
  return classifyConversationIntentFromRules({
    ...pre,
    transcript: [{ role: "user", content: text }],
  });
}

describe("classifyConversationIntentFromRules", () => {
  it("modoo URL + data collection check → feasibility_check", () => {
    const c = classifyLast("https://www.modoo.or.kr/idea/list 데이터 수집할 수 있는지 확인해줘");
    expect(c.mode).toBe("feasibility_check");
    expect(c.shouldInjectDocumentContext).toBe(false);
    expect(c.responsePolicy.avoidBrainstormExpansion).toBe(true);
    expect(c.responsePolicy.mustProvideCheckItems).toBe(true);
  });

  it("expand idea → brainstorm", () => {
    expect(classifyLast("이 아이디어를 좀 더 확장해줘").mode).toBe("brainstorm");
  });

  it("summarize → summary", () => {
    expect(classifyLast("지금까지 정리해줘").mode).toBe("summary");
  });

  it("project draft → project_draft", () => {
    expect(classifyLast("프로젝트로 만들어줘").mode).toBe("project_draft");
  });

  it("PDF review → document context", () => {
    const c = classifyLast("PDF 문서를 같이 검토하고 주석을 달고 싶어");
    expect(c.shouldInjectDocumentContext).toBe(true);
    expect(shouldInjectDocumentCollaborationContextStrictFallback({ text: c.reason })).toBe(false);
    expect(
      shouldInjectDocumentCollaborationContextStrictFallback({
        text: "PDF 문서를 같이 검토하고 주석을 달고 싶어",
      })
    ).toBe(true);
  });

  it("dashboard UX wording → no document context", () => {
    const c = classifyLast("대시보드 화면을 직관적으로 만들고 싶어");
    expect(c.shouldInjectDocumentContext).toBe(false);
    expect(c.mode).not.toBe("feasibility_check");
  });

  it("URL + 봐줘/점검해줘 remains feasibility_check", () => {
    expect(classifyLast("https://www.modoo.or.kr/idea/list 수집 가능한지 봐줘").mode).toBe(
      "feasibility_check"
    );
    expect(classifyLast("https://www.modoo.or.kr/idea/list 데이터 접근 가능한지 점검해줘").mode).toBe(
      "feasibility_check"
    );
  });

  it("document context does not trigger on UX/screen words", () => {
    const c = classifyLast("대시보드 화면 UX를 직관적으로 구성하고 싶어");
    expect(c.shouldInjectDocumentContext).toBe(false);
  });

  it("download availability is feasibility_check", () => {
    const c = classifyLast("이 사이트 목록을 다운로드할 수 있는지 확인해줘");
    expect(c.mode).toBe("feasibility_check");
  });

  it("URL + 수집 확인 beats research wording", () => {
    const c = classifyLast("https://example.com 이 사이트에서 수집 가능한지 검색해서 확인해줘");
    expect(c.mode).toBe("feasibility_check");
    expect(c.mode).not.toBe("research_request");
  });
});

describe("mergeConversationIntentWithRulesGuard", () => {
  it("keeps feasibility when rules say so and last has URL + 수집", () => {
    const last =
      "https://www.modoo.or.kr/idea/list 데이터 수집할 수 있는지 확인해줘";
    const rules = classifyConversationIntentFromRules({
      ...pre,
      transcript: [{ role: "user", content: last }],
    });
    expect(rules.mode).toBe("feasibility_check");
    const llmParsed = {
      ...rules,
      mode: "brainstorm" as const,
      reason: "llm: expand ideas",
      classifierSource: "llm" as const,
      responsePolicy: defaultResponsePolicyForMode("brainstorm"),
    };
    const merged = mergeConversationIntentWithRulesGuard(rules, llmParsed, last);
    expect(merged.mode).toBe("feasibility_check");
    expect(merged.responsePolicy.avoidBrainstormExpansion).toBe(true);
    expect(merged.responsePolicy.mustProvideCheckItems).toBe(true);
  });
});

describe("messenger system prompt by intent", () => {
  it("feasibility_check uses feasibility system without expansion features", () => {
    const c = classifyLast("https://example.com 데이터 수집 가능한지 확인해줘");
    const sys = buildMessengerSystemBlockForTest(c);
    expect(sys).toContain("가능 여부");
    expect(sys).toContain("단정하지 않습니다");
    expect(sys).toContain("요청과 무관한 확장 기능");
    expect(c.responsePolicy.mustProvideCheckItems).toBe(true);
  });

  it("promptMeta block includes mode and scope", () => {
    const c = classifyLast("확인해줘");
    const meta = formatConversationPromptMeta(c, { roomId: "room-1", layout: "free_windowed" });
    expect(meta).toContain("[promptMeta]");
    expect(meta).toContain("mode=feasibility_check");
    expect(meta).toContain("scope=pre_project");
    expect(meta).toContain("participationMode=planner_only");
  });

  it("promptMeta includes contextBlocks section when provided", () => {
    const c = classifyLast("https://example.com 데이터 수집 가능한지 확인해줘");
    const meta = formatConversationPromptMeta(c, {
      roomId: "room-1",
      layout: "free_windowed",
      contextBlocks: "userConstraints=[테스트]",
    });
    expect(meta).toContain("[contextBlocks]");
    expect(meta).toContain("userConstraints=");
  });

  it("brainstorm base prompt differs from feasibility", () => {
    const brain = messengerBasePromptForMode("pre_project", "brainstorm");
    const feas = messengerBasePromptForMode("pre_project", "feasibility_check");
    expect(brain).not.toEqual(feas);
  });
});
