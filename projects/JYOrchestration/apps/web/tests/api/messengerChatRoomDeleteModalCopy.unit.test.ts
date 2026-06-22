import { describe, expect, it } from "vitest";
import { messengerChatRoomDeleteModalCopy } from "@/lib/messenger/messengerChatRoomDeleteModalCopy";

describe("messengerChatRoomDeleteModalCopy", () => {
  it("uses plain delete copy without internal implementation terms", () => {
    const copy = messengerChatRoomDeleteModalCopy("plain");
    expect(copy.title).toContain("대화방");
    expect(copy.confirmLabel).toBe("삭제");
    const blob = `${copy.title} ${copy.body}`;
    expect(blob).not.toMatch(/PostgreSQL|schema|jyprojects/i);
  });

  it("uses linked project warning with bullet list and 모두 삭제", () => {
    const copy = messengerChatRoomDeleteModalCopy("linkedProject");
    expect(copy.confirmLabel).toBe("모두 삭제");
    expect(copy.bullets?.length).toBeGreaterThan(5);
    expect(copy.body).toContain("프로젝트");
    const blob = `${copy.title} ${copy.body} ${(copy.bullets ?? []).join(" ")}`;
    expect(blob).not.toMatch(/PostgreSQL|schema|jyorchestration/i);
  });
});
