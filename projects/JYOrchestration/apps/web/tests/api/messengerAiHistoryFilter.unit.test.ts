import { describe, expect, it } from "vitest";
import type { ConversationIntentClassification } from "@/lib/conversation-core/conversationIntentTypes";
import {
  filterMessengerHistoryTurnsForAiHistoryWithStats,
  formatMessengerAiHistoryFilterStats,
  shouldIncludeMessageForMessengerAiHistory,
  shouldIncludeTurnForMessengerAiHistory,
  type MessengerAiHistoryTurn,
} from "@/lib/messenger/messengerAiHistoryFilter";
import { newRequirementsMessage } from "@/lib/requirements/requirementsMessage";

const brainstorm = {
  mode: "brainstorm",
} as ConversationIntentClassification;

const projectDraft = {
  mode: "project_draft",
} as ConversationIntentClassification;

function message(
  input: Partial<Parameters<typeof newRequirementsMessage>[0]> & {
    role: "user" | "ai" | "system";
    content: string;
  }
) {
  const role = input.role;
  return newRequirementsMessage({
    role,
    speakerType: role === "user" ? "USER" : role === "system" ? "SYSTEM" : "AI",
    speakerId: role === "user" ? "u1" : "ai",
    speakerName: role === "user" ? "나" : "AI 기획자",
    messageType: role === "user" ? "STATEMENT" : "ANSWER",
    content: input.content,
    meta: input.meta,
  });
}

function turn(input: MessengerAiHistoryTurn): MessengerAiHistoryTurn {
  return input;
}

describe("shouldIncludeMessageForMessengerAiHistory", () => {
  it("excludes AI summary blocks from messenger AI history", () => {
    const msg = message({
      role: "ai",
      content: "【AI 요약 정리】\n\n현재 아이디어\n- A",
      meta: { internalType: "ai_work_note_summary" },
    });
    expect(shouldIncludeMessageForMessengerAiHistory(msg, brainstorm).include).toBe(false);
    expect(shouldIncludeMessageForMessengerAiHistory(msg, brainstorm).reason).toBe("ai_summary_block");
  });

  it("excludes auto reply system notice", () => {
    const msg = message({
      role: "system",
      content: "AI 기획자가 메시지에 자동으로 응답합니다.",
    });
    expect(shouldIncludeMessageForMessengerAiHistory(msg, brainstorm).include).toBe(false);
    expect(shouldIncludeMessageForMessengerAiHistory(msg, brainstorm).reason).toBe(
      "system_auto_reply_notice"
    );
  });

  it("excludes prior project draft artifact when current mode is brainstorm", () => {
    const msg = message({
      role: "ai",
      content: "**프로젝트 초안**\n\n서비스 한 줄 요약...\n목표 사용자\n핵심 가치",
    });
    expect(shouldIncludeMessageForMessengerAiHistory(msg, brainstorm).include).toBe(false);
    expect(shouldIncludeMessageForMessengerAiHistory(msg, brainstorm).reason).toBe(
      "project_draft_artifact_in_brainstorm"
    );
  });

  it("keeps project draft artifact when current mode is project_draft", () => {
    const msg = message({
      role: "ai",
      content: "**프로젝트 초안**\n\n서비스 한 줄 요약...",
    });
    expect(shouldIncludeMessageForMessengerAiHistory(msg, projectDraft).include).toBe(true);
  });

  it("keeps user idea messages", () => {
    const msg = message({
      role: "user",
      content: "녹취 파일을 회의록으로 정리하는 시스템이 필요해",
    });
    expect(shouldIncludeMessageForMessengerAiHistory(msg, brainstorm).include).toBe(true);
  });
});

describe("filterMessengerHistoryTurnsForAiHistoryWithStats", () => {
  it("formats history filter stats", () => {
    const { stats } = filterMessengerHistoryTurnsForAiHistoryWithStats(
      [
        turn({ role: "user", content: "아이디어" }),
        turn({
          role: "assistant",
          content: "【AI 요약 정리】\n\n현재 아이디어\n- A",
          meta: { internalType: "ai_work_note_summary" },
        }),
      ],
      brainstorm
    );
    const formatted = formatMessengerAiHistoryFilterStats(stats);
    expect(formatted).toContain("[historyFilter]");
    expect(formatted).toContain("ai_summary_block=1");
    expect(stats.includedMessages).toBe(1);
  });

  it("excludes prompt timeline meta messages", () => {
    const decision = shouldIncludeTurnForMessengerAiHistory(
      turn({ role: "assistant", content: "[api_messages]\n[user]\nhello" }),
      brainstorm
    );
    expect(decision.include).toBe(false);
    expect(decision.reason).toBe("prompt_timeline_or_meta");
  });
});
