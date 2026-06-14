import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { newRequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { resolveImplementationWorkingQueueOperationalSend } from "@/lib/prototype/implementationWorkingQueueOperationalSend";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

describe("no legacy control intent on LLM failure", () => {
  const baseState = {
    implementationSeedV1: { version: "implementation_seed_v1" },
    implementationWorkingQueueV1: {
      version: "implementation_working_queue_v1",
      projectId: "proj-1",
      items: [
        {
          id: "iwq-pending-1",
          title: "Preview 보완",
          status: "pending",
          riskLevel: "medium",
          affectedArea: "ui",
          createdAt: "2026-06-14T00:00:00.000Z",
          updatedAt: "2026-06-14T00:00:00.000Z",
        },
      ],
    },
  } as unknown as RequirementsStateJson;

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { mode?: string };
        if (body.mode === "intent") {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                result: { intent: "approve_pending_work_queue", confidence: "low", reason: "provider_error" },
                trace: { source: "fallback", reason: "NO_PROVIDER" },
              },
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ success: false }), { status: 500 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function baseSend(text: string) {
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
      implementationMode: "ready",
      previewReady: false,
    });
  }

  it("LLM failure + 진행해 → clarification, no queue mutation", async () => {
    const result = await baseSend("진행해");
    expect(result?.kind).toBe("assistant_reply");
    if (result?.kind === "assistant_reply") {
      expect(result.aiMessage.content).toContain("실행 대상을 확정하지 못했습니다");
      expect(result.timelineEntries?.some((e) => e.responseText?.includes("no_rule_based_control_intent"))).toBe(
        true,
      );
    }
    expect(result?.kind).not.toBe("start_implementation_quick_run");
    if (result?.kind === "apply_conversation") {
      expect(result.orchestration?.implementationWorkingQueueV1?.items?.[0]?.status).toBe("pending");
    }
  });

  it("LLM failure + 시작해 → no quick run", async () => {
    const result = await baseSend("시작해");
    expect(result?.kind).toBe("assistant_reply");
    expect(result?.kind).not.toBe("start_implementation_quick_run");
  });

  it("LLM failure + 부탁해 → clarification", async () => {
    const result = await baseSend("부탁해");
    expect(result?.kind).toBe("assistant_reply");
  });
});
