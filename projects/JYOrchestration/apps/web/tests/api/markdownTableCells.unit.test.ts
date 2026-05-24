import { describe, expect, it } from "vitest";
import { buildFastPlanAssumptionMarkdownTable } from "@/lib/requirements/markdownTableCells";

describe("markdownTableCells", () => {
  it("keeps assumption table rows on a single line when values contain newlines", () => {
    const table = buildFastPlanAssumptionMarkdownTable([
      {
        key: "serviceIdea",
        label: "서비스 아이디어",
        value: "녹취된 파일을 발화자별로 발언 내용을 정리하고\n주제별로 요약하며, 잔여업무를 TODO로 관리할 수 있는 시스템.",
        confidence: "candidate",
        reason: "대화·후보 슬롯에서 추출(미확정)",
      },
    ]);

    const dataLines = table.split("\n").slice(2);
    expect(dataLines).toHaveLength(1);
    expect(dataLines[0]).toMatch(/^\| 서비스 아이디어 \|/);
    expect(dataLines[0]).not.toContain("\n");
    expect(dataLines[0]).toContain("TODO로 관리할 수 있는 시스템.");
  });
});
