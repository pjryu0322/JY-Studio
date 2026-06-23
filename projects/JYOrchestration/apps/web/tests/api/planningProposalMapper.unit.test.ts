import { describe, expect, it } from "vitest";
import { parseAcceptedProposalSnapshot } from "@/lib/planning-proposal/planningProposalMapper";

const SAMPLE = `예상 서비스 흐름:
1. 사용자가 녹음된 회의 파일을 업로드합니다.
2. AI가 화자별 발언 내용을 스크립트로 정리합니다.

예상 액터·역할:
- 일반 사용자: 녹음 파일 업로드, 스크립트 보정

예상 핵심 기능:
- 회의록 목록 표시
- 화자별 대화 형식 스크립트
- 녹음 파일 드래그 앤 드롭 첨부 기능`;

describe("parseAcceptedProposalSnapshot", () => {
  it("extracts flows, actors, and features from planner proposal text", () => {
    const parsed = parseAcceptedProposalSnapshot(SAMPLE);
    expect(parsed.flows.length).toBeGreaterThanOrEqual(2);
    expect(parsed.actors.some((a) => a.includes("일반 사용자"))).toBe(true);
    expect(parsed.features).toContain("회의록 목록 표시");
    expect(parsed.features).toContain("녹음 파일 드래그 앤 드롭 첨부 기능");
  });
});
