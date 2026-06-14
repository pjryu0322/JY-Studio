import { describe, expect, it } from "vitest";
import { parseWorkingQueueControlIntent } from "@/lib/prototype/implementationWorkingQueueApprovalIntent";
import { isImplementationSupplementRequest } from "@/lib/prototype/implementationWorkingQueueClassifier";
import { enqueueWorkingQueueSupplement, applyWorkingQueueControlIntent } from "@/lib/prototype/implementationWorkingQueueService";
import { readImplementationWorkingQueueFromState } from "@/lib/prototype/implementationWorkingQueueState";

describe("implementation working queue", () => {
  it("detects supplement requests", () => {
    expect(isImplementationSupplementRequest("로그인 버튼을 위로 올려줘")).toBe(true);
    expect(isImplementationSupplementRequest("진행해")).toBe(false);
  });

  it("parses approve and defer intents", () => {
    expect(parseWorkingQueueControlIntent("진행해")).toEqual({ kind: "approve_all" });
    expect(parseWorkingQueueControlIntent("1번만 진행해")).toEqual({ kind: "approve_one", index: 0 });
    expect(parseWorkingQueueControlIntent("보류해")).toEqual({ kind: "defer_all" });
  });

  it("enqueues and approves without mutating pipeline state keys", () => {
    const base = readImplementationWorkingQueueFromState({}, "proj-1");
    const { queue, item } = enqueueWorkingQueueSupplement({
      queue: base,
      rawUserMessage: "메뉴 크기를 키워줘",
    });
    expect(queue.items).toHaveLength(1);
    expect(item.status).toBe("pending");
    const applied = applyWorkingQueueControlIntent({
      queue,
      intent: { kind: "approve_all" },
    });
    expect(applied.approved).toHaveLength(1);
    expect(applied.queue.items[0]?.status).toBe("approved");
  });
});
