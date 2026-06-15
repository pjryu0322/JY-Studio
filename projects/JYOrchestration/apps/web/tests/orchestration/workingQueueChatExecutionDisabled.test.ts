import { describe, expect, it } from "vitest";
import {
  CHAT_EXECUTION_REQUIRES_WORKING_QUEUE_BUTTON_MESSAGE,
  isChatExecutionLikeText,
} from "@/lib/prototype/implementationWorkingQueueChatExecutionGuard";
import { resolveImplementationWorkingQueueOperationalSend } from "@/lib/prototype/implementationWorkingQueueOperationalSend";
import { newRequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

describe("working queue chat execution disabled", () => {
  const baseState = {
    implementationSeedV1: { version: "implementation_seed_v1" },
    implementationWorkingQueueV1: {
      version: "implementation_working_queue_v1",
      projectId: "proj-1",
      items: [
        {
          id: "iwq-pending-1",
          projectId: "proj-1",
          title: "Preview 보완",
          description: "스크롤 없게",
          rawUserMessage: "스크롤 없게",
          status: "pending",
          riskLevel: "medium",
          affectedArea: "ui",
          createdAt: "2026-06-14T00:00:00.000Z",
          updatedAt: "2026-06-14T00:00:00.000Z",
        },
      ],
      updatedAt: "2026-06-14T00:00:00.000Z",
    },
  } as unknown as RequirementsStateJson;

  async function send(text: string) {
    const userMsg = newRequirementsMessage({
      id: "u-1",
      role: "user",
      speakerType: "USER",
      messageType: "STATEMENT",
      content: text,
      createdAt: "2026-06-14T00:00:00.000Z",
    });
    return resolveImplementationWorkingQueueOperationalSend({
      text,
      userMsg,
      projectId: "proj-1",
      requirementsStateJson: baseState,
      isDraftGenerationComplete: false,
      parsedRequirementsState: baseState,
      implementationBootstrapInput: null,
      hasRunnableCodeTasks: true,
    });
  }

  it("blocks 진행해 before LLM", async () => {
    expect(isChatExecutionLikeText("진행해")).toBe(true);
    const result = await send("진행해");
    expect(result?.kind).toBe("assistant_reply");
    if (result?.kind === "assistant_reply") {
      expect(result.aiMessage.content).toBe(CHAT_EXECUTION_REQUIRES_WORKING_QUEUE_BUTTON_MESSAGE);
    }
  });

  it("blocks 부탁해 and keeps queue pending", async () => {
    const result = await send("부탁해");
    expect(result?.kind).toBe("assistant_reply");
    expect(result?.kind).not.toBe("apply_conversation");
  });
});
