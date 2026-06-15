import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

  it("LLM failure + 진행해 → execution guard, no queue mutation", async () => {
    const result = await baseSend("진행해");
    expect(result?.kind).toBe("assistant_reply");
    if (result?.kind === "assistant_reply") {
      expect(result.aiMessage.content).toContain("작업대기에서 [승인] 버튼");
    }
    expect(result?.kind).not.toBe("start_implementation_quick_run");
    if (result?.kind === "apply_conversation") {
      expect(result.orchestration?.implementationWorkingQueueV1?.items?.[0]?.status).toBe("pending");
    }
  });

  it("LLM failure + 시작해 → execution guard, no quick run", async () => {
    const result = await baseSend("시작해");
    expect(result?.kind).toBe("assistant_reply");
    if (result?.kind === "assistant_reply") {
      expect(result.aiMessage.content).toContain("작업대기에서 [승인] 버튼");
    }
    expect(result?.kind).not.toBe("start_implementation_quick_run");
  });

  it("runtime source does not import legacy parser", () => {
    const path = resolve(
      process.cwd(),
      "src/lib/prototype/implementationWorkingQueueOperationalSend.ts",
    );
    const src = readFileSync(path, "utf8");
    expect(src).not.toContain("parseWorkingQueueControlIntent");
    expect(src).not.toContain("legacyWorkingQueueApprovalIntent");
  });
});
