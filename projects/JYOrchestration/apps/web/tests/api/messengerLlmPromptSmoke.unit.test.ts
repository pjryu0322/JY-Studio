import { describe, expect, it } from "vitest";
import { classifyConversationIntentFromRules } from "@/lib/conversation-core/conversationIntentClassifier";
import { formatConversationPromptMeta } from "@/lib/conversation-core/conversationPromptMeta";
import {
  buildMessengerSystemBlockForTest,
  resolveMessengerTurnSetupFromRulesForTest,
} from "@/lib/messenger/messengerLlm";

const pre = { scope: "pre_project" as const, participationMode: "planner_only" as const };

describe("messengerLlm prompt smoke (rules only)", () => {
  it("modoo data collection check uses feasibility prompt and no doc context", () => {
    const transcript = [
      {
        role: "user" as const,
        content: "https://www.modoo.or.kr/idea/list\n데이터 수집할 수 있는지 확인해줘",
      },
    ];
    const c = classifyConversationIntentFromRules({ ...pre, transcript });
    const sys = buildMessengerSystemBlockForTest(c);
    expect(c.mode).toBe("feasibility_check");
    expect(c.shouldInjectDocumentContext).toBe(false);
    expect(sys).toContain("가능 여부");
    expect(sys).toContain("단정하지 않습니다");
    expect(sys).toContain("사용자가 요청하지 않은 확장 기능");
    expect(sys).not.toContain("추천 시스템을 붙이면");
    expect(sys).not.toContain("투표 기능을 추가");
  });

  it("resolveMessengerTurnSetupFromRulesForTest includes promptMeta and contextBlocks", () => {
    const setup = resolveMessengerTurnSetupFromRulesForTest({
      logContext: { roomId: "room-smoke", roomTitle: null, projectId: null },
      transcript: [
        {
          role: "user",
          content: "https://www.modoo.or.kr/idea/list 데이터 수집할 수 있는지 확인해줘",
        },
      ],
    });
    expect(setup.classification.mode).toBe("feasibility_check");
    expect(setup.docHint).toBe(false);
    expect(setup.timelineMetaHeader).toContain("[promptMeta]");
    expect(setup.timelineMetaHeader).toContain("mode=feasibility_check");
    expect(setup.contextBlocksText.length).toBeGreaterThan(0);
    const meta = formatConversationPromptMeta(setup.classification, {
      roomId: "room-smoke",
      layout: "free_windowed",
      contextBlocks: "userConstraints=[]",
    });
    expect(meta).toContain("[contextBlocks]");
  });

  it("multiturn URL then check uses feasibility in turn setup", () => {
    const setup = resolveMessengerTurnSetupFromRulesForTest({
      transcript: [
        { role: "user", content: "https://www.modoo.or.kr/idea/list" },
        { role: "user", content: "확인해줘" },
      ],
    });
    expect(setup.classification.mode).toBe("feasibility_check");
    const sys = buildMessengerSystemBlockForTest(setup.classification, setup.contextBlocksText);
    expect(sys).toContain("robots.txt");
    expect(sys).toContain("페이지네이션");
  });
});
