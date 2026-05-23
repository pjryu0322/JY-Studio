import { describe, expect, it } from "vitest";
import { classifyConversationIntentFromRules } from "@/lib/conversation-core/conversationIntentClassifier";
import { promptPrescribesFeasibilityClosingPhrase } from "@/lib/conversation-core/feasibilityRepetitionGuard";
import { formatConversationPromptMeta } from "@/lib/conversation-core/conversationPromptMeta";
import { messengerBasePromptForMode } from "@/lib/conversation-core/conversationResponsePolicy";
import { formatMessengerAiHistoryFilterStats } from "@/lib/messenger/messengerAiHistoryFilter";
import { mergeMessengerHistoryTurns } from "@/lib/messenger/chatMessageToRequirementsMessage";
import {
  applyMessengerAiHistoryFilter,
  buildFreeMessengerOpenAiMessages,
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
    expect(promptPrescribesFeasibilityClosingPhrase(sys)).toBe(false);
    expect(c.requiredAction).toBe("website_inspection");
  });

  it("resolveMessengerTurnSetupFromRulesForTest includes promptMeta and contextBlocks", async () => {
    const setup = await resolveMessengerTurnSetupFromRulesForTest({
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
    expect(setup.timelineMetaHeader).toContain("requiredAction=website_inspection");
    expect(setup.contextBlocksText.length).toBeGreaterThan(0);
    const meta = formatConversationPromptMeta(setup.classification, {
      roomId: "room-smoke",
      layout: "free_windowed",
      contextBlocks: "userConstraints=[]",
      inspection: null,
    });
    expect(meta).toContain("[contextBlocks]");
  });

  it("multiturn URL then check uses feasibility in turn setup", async () => {
    const setup = await resolveMessengerTurnSetupFromRulesForTest({
      transcript: [
        { role: "user", content: "https://www.modoo.or.kr/idea/list" },
        { role: "user", content: "확인해줘" },
      ],
    });
    expect(setup.classification.mode).toBe("feasibility_check");
    expect(setup.classification.requiredAction).toBe("website_inspection");
    const sys = buildMessengerSystemBlockForTest(setup.classification, setup.contextBlocksText, {
      inspectionPromptText: setup.inspectionPromptText,
      transcript: [
        { role: "user", content: "https://www.modoo.or.kr/idea/list" },
        { role: "user", content: "확인해줘" },
      ],
    });
    expect(sys).toContain("robots.txt");
    expect(sys).toContain("페이지네이션");
    expect(promptPrescribesFeasibilityClosingPhrase(sys)).toBe(false);
  });

  it("brainstorm prompt does not prescribe future comparison/draft promise", () => {
    const sys = messengerBasePromptForMode("pre_project", "brainstorm");
    expect(sys).not.toContain("다음에는 제가 비교안/초안/정리안을 만들겠습니다");
    expect(sys).not.toContain("다음 산출물을 제안");
  });

  it("project draft prompt does not promise project promotion or json preparation", () => {
    const sys = messengerBasePromptForMode("pre_project", "project_draft");
    expect(sys).not.toContain("프로젝트 승격 또는 초안 JSON 준비");
    expect(sys).not.toContain("다음 행동을 예고");
  });

  it("option comparison prompt requires current answer to produce comparison", () => {
    const sys = messengerBasePromptForMode("pre_project", "option_comparison");
    expect(sys).toContain("비교안");
    expect(sys).toContain("현재 응답에서 바로 작성");
    expect(sys).toContain("라고 말하지 않습니다");
  });

  it("brainstorm api_messages exclude AI summary and prior project draft artifacts", async () => {
    const transcript = [
      { role: "user" as const, content: "회의록 정리 시스템이 필요해" },
      {
        role: "assistant" as const,
        content: "**프로젝트 초안**\n\n서비스 한 줄 요약\n목표 사용자\n핵심 가치",
      },
      {
        role: "assistant" as const,
        content: "【AI 요약 정리】\n\n현재 아이디어\n- 녹취 정리",
      },
      { role: "user" as const, content: "다국어는 빼고 녹취 정리 중심으로 보자" },
    ];
    const setup = await resolveMessengerTurnSetupFromRulesForTest({
      logContext: { roomId: "room-filter", roomTitle: null, projectId: null },
      transcript,
    });
    expect(setup.classification.mode).toBe("brainstorm");

    const { transcript: filtered, stats } = applyMessengerAiHistoryFilter({
      transcript,
      classification: setup.classification,
    });
    expect(stats.excludedByReason.ai_summary_block).toBe(1);
    expect(stats.excludedByReason.project_draft_artifact_in_brainstorm).toBe(1);
    expect(formatMessengerAiHistoryFilterStats(stats)).toContain("[historyFilter]");

    const apiMessages = buildFreeMessengerOpenAiMessages(filtered, "", setup);
    const nonSystem = apiMessages.filter((m) => m.role !== "system").map((m) => m.content).join("\n");
    expect(nonSystem).not.toContain("【AI 요약 정리】");
    expect(nonSystem).not.toContain("**프로젝트 초안**");
    expect(nonSystem).toContain("다국어는 빼고");
  });

  it("applyMessengerAiHistoryFilter keeps draft artifact in project_draft mode", async () => {
    const transcript = [
      { role: "user" as const, content: "이 내용을 프로젝트로 만들어줘" },
      {
        role: "assistant" as const,
        content: "**프로젝트 초안**\n\n서비스 한 줄 요약\n목표 사용자",
      },
      { role: "user" as const, content: "이 내용을 프로젝트로 만들어줘" },
    ];
    const setup = await resolveMessengerTurnSetupFromRulesForTest({ transcript });
    expect(setup.classification.mode).toBe("project_draft");

    const { transcript: filtered } = applyMessengerAiHistoryFilter({
      transcript,
      classification: setup.classification,
    });
    const merged = mergeMessengerHistoryTurns(
      filtered.map((t) => ({ role: t.role, content: t.content }))
    );
    const bodies = merged.map((m) => m.content).join("\n");
    expect(bodies).toContain("**프로젝트 초안**");
  });
});
