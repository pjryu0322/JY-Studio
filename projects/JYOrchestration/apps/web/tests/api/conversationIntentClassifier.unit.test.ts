import { describe, expect, it } from "vitest";
import {
  classifyConversationIntentFromRules,
  enrichClassificationWithRequiredAction,
  extractUrlsFromTranscript,
  mergeConversationDocumentContext,
  mergeConversationIntentWithIdeaIntroductionGuard,
  mergeConversationIntentWithRulesGuard,
} from "@/lib/conversation-core/conversationIntentClassifier";
import { promptPrescribesFeasibilityClosingPhrase } from "@/lib/conversation-core/feasibilityRepetitionGuard";
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

  it("비교안을 만들어줘 → option_comparison", () => {
    expect(classifyLast("비교안을 만들어줘").mode).toBe("option_comparison");
  });

  it("비교표로 정리해줘 → option_comparison", () => {
    expect(classifyLast("MVP안과 확장안을 비교표로 정리해줘").mode).toBe("option_comparison");
  });

  it("장단점 비교해줘 → option_comparison", () => {
    expect(classifyLast("두 가지 접근의 장단점을 비교해줘").mode).toBe("option_comparison");
  });

  it("프로젝트로 만들어줘 remains project_draft", () => {
    expect(classifyLast("프로젝트로 만들어줘").mode).toBe("project_draft");
    expect(classifyLast("비교안을 만들어줘").mode).not.toBe("project_draft");
  });

  it("웹서비스를 만들고 싶어 remains brainstorm", () => {
    expect(classifyLast("녹취파일을 회의록으로 정리하는 웹서비스를 만들고 싶어").mode).toBe("brainstorm");
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

  it("가능한 방향/확장 가능성 wording remains brainstorm", () => {
    expect(classifyLast("가능한 방향을 제안해줘").mode).toBe("brainstorm");
    expect(classifyLast("이 아이디어의 확장 가능성을 브레인스토밍해줘").mode).toBe("brainstorm");
    expect(classifyLast("발전 가능성이 있는 방향을 같이 생각해줘").mode).toBe("brainstorm");
  });

  it("URL without collection/check intent does not force feasibility", () => {
    expect(classifyLast("https://example.com 이걸 참고해서 아이디어를 확장해줘").mode).toBe("brainstorm");
  });

  it("URL + collection/download/access remains feasibility", () => {
    expect(classifyLast("https://example.com 목록 데이터를 수집할 수 있는지 확인해줘").mode).toBe(
      "feasibility_check"
    );
    expect(classifyLast("https://example.com 목록을 다운로드 가능한지 봐줘").mode).toBe("feasibility_check");
    expect(classifyLast("https://example.com 공개 데이터에 접근 가능한지 점검해줘").mode).toBe(
      "feasibility_check"
    );
  });

  it("strict document fallback preserves obvious PDF collaboration context", () => {
    const c = classifyLast("PDF 문서를 같이 검토하고 주석을 달고 싶어");
    expect(c.shouldInjectDocumentContext).toBe(true);
  });

  it("URL in prior turn + bare check in last turn becomes feasibility_check", () => {
    const c = classifyConversationIntentFromRules({
      ...pre,
      transcript: [
        { role: "user", content: "https://www.modoo.or.kr/idea/list" },
        { role: "user", content: "확인해줘" },
      ],
    });
    expect(c.mode).toBe("feasibility_check");
  });

  it("URL in prior turn + brainstorm last remains brainstorm", () => {
    const c = classifyConversationIntentFromRules({
      ...pre,
      transcript: [
        { role: "user", content: "https://example.com" },
        { role: "user", content: "이걸 참고해서 아이디어를 확장해줘" },
      ],
    });
    expect(c.mode).toBe("brainstorm");
    expect(c.requiredAction).toBe("none");
  });

  it("URL + check assigns website_inspection requiredAction", () => {
    const transcript = [
      { role: "user", content: "https://www.modoo.or.kr/idea/list" },
      { role: "user", content: "확인해줘" },
    ] as const;
    const c = classifyConversationIntentFromRules({ ...pre, transcript: [...transcript] });
    expect(c.mode).toBe("feasibility_check");
    expect(c.requiredAction).toBe("website_inspection");
    expect(c.targetUrls).toEqual(["https://www.modoo.or.kr/idea/list"]);
    expect(extractUrlsFromTranscript(transcript)).toEqual(["https://www.modoo.or.kr/idea/list"]);
  });

  it("check without URL has no requiredAction", () => {
    const base = classifyLast("가능한 방향을 제안해줘");
    const c = enrichClassificationWithRequiredAction(
      { ...base, mode: "feasibility_check" },
      [{ role: "user", content: "접근해서 점검해줘" }]
    );
    expect(c.requiredAction).toBe("none");
    expect(c.targetUrls).toEqual([]);
  });
});

describe("mergeConversationDocumentContext", () => {
  it("preserves document context when parsed llm says false but rules strict match", () => {
    const last = "PDF 문서를 같이 검토하고 주석을 달고 싶어";
    const rules = classifyConversationIntentFromRules({
      ...pre,
      transcript: [{ role: "user", content: last }],
    });
    expect(rules.shouldInjectDocumentContext).toBe(true);
    const llmParsed = { ...rules, shouldInjectDocumentContext: false, classifierSource: "llm" as const };
    expect(mergeConversationDocumentContext(rules, llmParsed, last)).toBe(true);
  });

  it("does not inject document context for UX-only wording when llm says true", () => {
    const last = "대시보드 화면 UX를 직관적으로 구성하고 싶어";
    const rules = classifyConversationIntentFromRules({
      ...pre,
      transcript: [{ role: "user", content: last }],
    });
    const llmParsed = { ...rules, shouldInjectDocumentContext: true, classifierSource: "llm" as const };
    expect(mergeConversationDocumentContext(rules, llmParsed, last)).toBe(false);
  });
});

describe("mergeConversationIntentWithIdeaIntroductionGuard", () => {
  it("keeps brainstorm when llm says project_draft for idea introduction", () => {
    const last = "녹취파일을 회의록으로 정리하는 웹서비스를 만들고 싶어";
    const rules = classifyConversationIntentFromRules({
      ...pre,
      transcript: [{ role: "user", content: last }],
    });
    expect(rules.mode).toBe("brainstorm");
    const llmParsed = {
      ...rules,
      mode: "project_draft" as const,
      reason: "llm: create project",
      classifierSource: "llm" as const,
      responsePolicy: defaultResponsePolicyForMode("project_draft"),
    };
    const merged = mergeConversationIntentWithIdeaIntroductionGuard(rules, llmParsed, last);
    expect(merged.mode).toBe("brainstorm");
    expect(merged.reason).toContain("rules_override");
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
    expect(sys).toContain("사용자가 요청하지 않은 확장 기능");
    expect(sys).toContain("추천 시스템");
    expect(c.responsePolicy.mustProvideCheckItems).toBe(true);
  });

  it("feasibility prompt contains concrete website check criteria", () => {
    const c = classifyLast("https://www.modoo.or.kr/idea/list 데이터 수집할 수 있는지 확인해줘");
    const sys = buildMessengerSystemBlockForTest(c);
    expect(sys).toContain("robots.txt");
    expect(sys).toContain("이용약관");
    expect(sys).toContain("페이지네이션");
    expect(sys).toContain("[inspectionResult]");
    expect(promptPrescribesFeasibilityClosingPhrase(sys)).toBe(false);
  });

  it("feasibility prompt includes inspection block when provided", () => {
    const c = classifyLast("https://example.com 데이터 수집 가능한지 확인해줘");
    const sys = buildMessengerSystemBlockForTest(c, "", {
      inspectionPromptText: "[inspectionResult]\nurl=https://example.com\nok=true\nstatus=200",
    });
    expect(sys).toContain("status=200");
  });

  it("promptMeta shows rules_guard override when reason includes rules_override", () => {
    const c = {
      ...classifyLast("https://example.com 데이터 수집 가능한지 확인해줘"),
      reason: "llm: brainstorm / rules_override: 가능 여부·수집·검토 확인 요청",
    };
    const meta = formatConversationPromptMeta(c, { roomId: "room-1", layout: "free_windowed" });
    expect(meta).toContain("modeOverride=rules_guard");
  });

  it("promptMeta block includes mode and scope", () => {
    const c = classifyLast("https://example.com 데이터 수집 가능한지 확인해줘");
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
