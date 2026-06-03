import { describe, expect, it } from "vitest";
import {
  buildImplementationPrepCompletedSnapshot,
  buildPseudoImplementationPrepProgress,
} from "@/lib/requirements/implementationPrepProgress";
import {
  buildImplementationPrepProgressChatContent,
  findImplementationPrepProgressMessageIndex,
  isImplementationPrepProgressMessage,
  QUICK_DESIGN_IMPLEMENTATION_PREP_PROGRESS_INTERNAL_TYPE,
  removeImplementationPrepProgressMessages,
  shouldRefreshImplementationPrepProgressMessage,
  upsertImplementationPrepProgressMessage,
} from "@/lib/requirements/implementationPrepProgressChatMessage";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";

const NOW = "2026-06-01T12:00:00.000Z";

function runningAt(elapsedMs: number): RequirementsMessage {
  return upsertImplementationPrepProgressMessage({
    messages: [],
    progressStatus: "running",
    snapshot: buildPseudoImplementationPrepProgress(elapsedMs),
    nowIso: NOW,
  })[0]!;
}

describe("implementationPrepProgressChatMessage", () => {
  it("upserts a single running progress message", () => {
    let messages: RequirementsMessage[] = [];
    const snap10 = buildPseudoImplementationPrepProgress(5_000);
    messages = upsertImplementationPrepProgressMessage({
      messages,
      progressStatus: "running",
      snapshot: snap10,
      nowIso: NOW,
    });
    messages = upsertImplementationPrepProgressMessage({
      messages,
      progressStatus: "running",
      snapshot: buildPseudoImplementationPrepProgress(90_000),
      nowIso: NOW,
    });
    const progressMessages = messages.filter(isImplementationPrepProgressMessage);
    expect(progressMessages).toHaveLength(1);
    expect(progressMessages[0]?.content).toContain("진행률:");
    expect(findImplementationPrepProgressMessageIndex(messages)).toBe(0);
  });

  it("does not expose batch or llm internal jargon in chat content", () => {
    const snapshot = buildPseudoImplementationPrepProgress(90_000);
    const content = buildImplementationPrepProgressChatContent({
      snapshot,
      progressStatus: "running",
    });
    expect(content).toContain("CodeTask 정리");
    expect(content).not.toContain("Batch");
    expect(content).not.toContain("LLM Refinement");
    expect(content).not.toContain("heuristic");
    expect(content).not.toMatch(/llm_partial_refined/i);
  });

  it("completed chat content includes 100 percent progress", () => {
    const content = buildImplementationPrepProgressChatContent({
      snapshot: buildImplementationPrepCompletedSnapshot(),
      progressStatus: "completed",
    });
    expect(content).toContain("진행률: 100%");
    expect(content).toContain("구현준비 완료");
  });

  it("throttles refresh until phase changes or 5 percent delta", () => {
    const first = buildPseudoImplementationPrepProgress(5_000);
    const second = buildPseudoImplementationPrepProgress(8_000);
    const third = buildPseudoImplementationPrepProgress(90_000);
    expect(
      shouldRefreshImplementationPrepProgressMessage({
        previousPercent: first.percent,
        previousPhase: first.phase,
        next: second,
      }),
    ).toBe(false);
    expect(
      shouldRefreshImplementationPrepProgressMessage({
        previousPercent: first.percent,
        previousPhase: first.phase,
        next: third,
      }),
    ).toBe(true);
  });

  it("removes progress messages before completion handoff", () => {
    const messages = [
      runningAt(5_000),
      {
        id: "user-1",
        role: "user",
        speakerType: "USER",
        speakerId: "u1",
        speakerName: "User",
        visibility: "PUBLIC",
        messageType: "STATEMENT",
        content: "hello",
        createdAt: NOW,
        meta: { stage: "REQUIREMENTS" },
      },
    ];
    const cleaned = removeImplementationPrepProgressMessages(messages);
    expect(cleaned.some(isImplementationPrepProgressMessage)).toBe(false);
    expect(cleaned).toHaveLength(1);
  });

  it("failed message offers retry and log chips without internal status names", () => {
    const [failed] = upsertImplementationPrepProgressMessage({
      messages: [],
      progressStatus: "failed",
      nowIso: NOW,
      errorMessage: "network error",
    });
    expect(failed?.meta?.internalType).toBe(QUICK_DESIGN_IMPLEMENTATION_PREP_PROGRESS_INTERNAL_TYPE);
    expect(failed?.meta?.interviewSuggestions).toContain("Quick Design 확정");
    expect(failed?.meta?.interviewSuggestions).toContain("로그 보기");
    expect(failed?.content).not.toContain("llm_partial_refined");
  });
});
