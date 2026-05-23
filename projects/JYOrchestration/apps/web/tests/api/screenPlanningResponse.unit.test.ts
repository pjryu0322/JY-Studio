import { describe, expect, it } from "vitest";
import {
  buildScreenPlanningAssistantMessage,
  buildScreenPlanningResponse,
  validateScreenPlanningAssistantMessage,
} from "@/lib/requirements/screenPlanningResponse";
import { createSampleServiceFlow } from "../orchestration/helpers/orchestrationRegressionHarness";

describe("screenPlanningResponse validation", () => {
  it("rejects screen planning response with execution meta", () => {
    const result = validateScreenPlanningAssistantMessage(
      "1. 화면\n- 설명\n\nAPPLY_PROPOSAL 대안 비교 Viewer",
    );
    expect(result.ok).toBe(false);
    expect(result.issues).toContain("screen_planning_contains_execution_meta");
  });

  it("accepts structured screen planning response", () => {
    const result = validateScreenPlanningAssistantMessage(`
앞서 정리한 흐름을 기준으로 화면 구성을 제안합니다.

1. 업로드 화면
- 목적: 파일 등록
- 주요 UI: 업로드 영역, 상태 표시
- 확인 정보: 파일명

2. 결과 확인 화면
- 목적: 변환 결과 검토
- 주요 UI: 발화자별 목록, 요약 카드
- 확인 정보: 누락 발언

3. 검수 화면
- 목적: 수정 및 확정
- 주요 UI: 승인/반려, 변경 이력
- 확인 정보: 최종 회의록
`);
    expect(result.ok).toBe(true);
  });
});

describe("buildScreenPlanningResponse", () => {
  it("falls back to deterministic screen planning when llm fails", async () => {
    const result = await buildScreenPlanningResponse({
      projectName: "회의록",
      flow: createSampleServiceFlow(),
      recentMessages: "",
      userMessage: "화면 구성 해줘",
      runLlm: async () => ({ ok: false, code: "TEST", message: "fail" }),
    });

    expect(result.assistantMessage).toContain("화면 구성을 제안합니다");
    expect(result.source).toBe("fallback");
    expect(result.promptTraceDetail).toContain("[screenPlanning]");
  });

  it("uses llm output when validation passes", async () => {
    const llmText = `
앞서 정리한 흐름을 기준으로 화면 구성을 제안합니다.

1. 업로드 화면
- 목적: 파일 등록
- 주요 UI: 업로드 영역, 상태 표시
- 확인 정보: 파일명

2. 결과 확인 화면
- 목적: 변환 결과 검토
- 주요 UI: 발화자별 목록, 요약 카드
- 확인 정보: 누락 발언

3. 검수 화면
- 목적: 수정 및 확정
- 주요 UI: 승인/반려, 변경 이력
- 확인 정보: 최종 회의록

다음: 이 화면 구성을 기준으로 기능 범위를 정리할 수 있습니다.
`.trim();

    const result = await buildScreenPlanningResponse({
      projectName: "회의록",
      flow: createSampleServiceFlow(),
      recentMessages: "AI: 흐름 정리됨",
      userMessage: "화면 구성 해줘",
      runLlm: async () => ({
        ok: true,
        assistantMessage: llmText,
        model: "test",
        promptText: "prompt",
      }),
    });

    expect(result.source).toBe("llm");
    expect(result.assistantMessage).toContain("업로드 화면");
  });

  it("deterministic fallback meets validation thresholds", () => {
    const body = buildScreenPlanningAssistantMessage({ flow: createSampleServiceFlow() });
    const validation = validateScreenPlanningAssistantMessage(body);
    expect(validation.ok).toBe(true);
  });
});
