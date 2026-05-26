import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectRailRecommendationButton } from "@/components/layout/platformTopNav/ProjectRailRecommendationButton";
import { RecommendationEvidencePanel } from "@/components/recommendation/RecommendationEvidencePanel";
import { RequirementsMessageExplainability } from "@/components/requirements/RequirementsMessageExplainability";
import {
  buildRecommendationEvidenceItems,
  buildUserFacingTimelineSummary,
  findSourceUserInputsForTimeline,
  isInternalRecommendationText,
  showInlineMessageExplainability,
  summarizeRecommendationEvidenceCounts,
} from "@/lib/recommendation/recommendationEvidence";
import { toggleRecommendationPanelOpen } from "@/lib/recommendation/recommendationPanelEvents";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

const now = "2026-05-19T12:00:00.000Z";
const before = "2026-05-19T11:00:00.000Z";

const userMsg: RequirementsMessage = {
  id: "u1",
  role: "user",
  speakerType: "USER",
  speakerId: "user-1",
  speakerName: "사용자",
  visibility: "PUBLIC",
  messageType: "QUESTION",
  content: "회의록 자동화 서비스 만들고 싶어",
  createdAt: before,
  meta: { stage: "REQUIREMENTS" },
};

describe("buildRecommendationEvidenceItems", () => {
  it("builds recommendation evidence items from prompt timeline and artifact orchestration metadata", () => {
    const state: RequirementsStateJson = {
      promptTimeline: [
        {
          stage: "ideation",
          action: "quick_design_confirmed",
          source: "llm",
          aiMember: "AI 기획자",
          createdAt: now,
          responseText: "녹취 기반 회의록 자동 정리와 빠른 프로토타입 범위를 제안했습니다.",
        },
      ],
      projectArtifacts: [
        {
          id: "a1",
          type: "fast_prototype_plan",
          title: "프로토타입 기획안",
          createdAt: now,
          createdBy: "ai",
          sourceStage: "IDEATION",
          content: "# 기획안\n\n본문",
          orchestration: {
            reason: "사용자가 빠른 프로토타입을 우선한다고 명시했습니다.",
            required: true,
            confidence: 0.9,
            sourceRoles: ["planner"],
            sourceSlotKeys: ["scope.mvp"],
            trace: [],
            completenessScore: 0.85,
            hubReadinessLabel: "생성완료",
            plannedAt: now,
          },
        },
      ],
    };
    const items = buildRecommendationEvidenceItems({
      requirementsStateJson: state,
      messages: [userMsg],
    });
    expect(items.length).toBeGreaterThanOrEqual(2);
    const qd = items.find((i) => i.title.includes("Quick Design"));
    expect(qd?.stage).toBe("planning");
    expect(qd?.status).toBe("confirmed");
    expect(qd?.summary).toContain("Quick Design");
    expect(qd?.sourceInputs).toContain("회의록 자동화 서비스 만들고 싶어");
  });

  it("filters internal prompt assembly metadata from recommendation evidence", () => {
    const state: RequirementsStateJson = {
      promptTimeline: [
        {
          stage: "ideation",
          action: "quick_design_requested",
          source: "llm",
          createdAt: now,
          responseText: "참조 맥락 후보 7건 · 조립 계획 단계 6건 · 맥락 예산 압축 정책",
        },
      ],
    };
    const items = buildRecommendationEvidenceItems({ requirementsStateJson: state });
    const blob = JSON.stringify(items);
    expect(isInternalRecommendationText("맥락 예산")).toBe(true);
    expect(blob).not.toMatch(/맥락 예산/);
    expect(blob).not.toMatch(/압축 정책/);
    expect(blob).not.toMatch(/조립 계획/);
    expect(blob).not.toMatch(/참조 맥락 후보/);
    expect(blob).not.toMatch(/rawPrompt/i);
    expect(blob).not.toMatch(/\btoken\b/i);
  });

  it("links recommendation evidence to nearby user messages", () => {
    const state: RequirementsStateJson = {
      promptTimeline: [
        {
          stage: "ideation",
          action: "quick_design_draft_created",
          source: "llm",
          createdAt: now,
        },
      ],
    };
    const items = buildRecommendationEvidenceItems({
      requirementsStateJson: state,
      messages: [userMsg],
    });
    const item = items.find((i) => i.title === "Quick Design 초안");
    expect(item?.sourceInputs).toContain("회의록 자동화 서비스 만들고 싶어");
  });

  it("uses user-facing summary for known timeline actions", () => {
    const entry = {
      stage: "ideation",
      action: "quick_design_confirmed_implementation_seed_auto_built",
      source: "system",
      createdAt: now,
    };
    expect(buildUserFacingTimelineSummary(entry)).toBe(
      "기획 산출물을 기준으로 구현 준비정보를 자동 정리했습니다.",
    );
    const items = buildRecommendationEvidenceItems({
      requirementsStateJson: { promptTimeline: [entry] },
    });
    const seed = items.find((i) => i.title.includes("구현 준비정보"));
    expect(seed?.summary).toContain("구현 준비정보");
    expect(seed?.summary).not.toContain("quick_design_confirmed_implementation_seed_auto_built");
  });
});

describe("findSourceUserInputsForTimeline", () => {
  it("prefers explicit source message ids when present", () => {
    const inputs = findSourceUserInputsForTimeline({
      entry: {
        stage: "ideation",
        action: "quick_design_requested",
        source: "llm",
        createdAt: now,
        userMessageId: "u1",
      },
      messages: [userMsg],
    });
    expect(inputs).toEqual(["회의록 자동화 서비스 만들고 싶어"]);
  });
});

describe("summarizeRecommendationEvidenceCounts", () => {
  it("includes confirmed and deferred counts", () => {
    const counts = summarizeRecommendationEvidenceCounts([
      { status: "confirmed" } as never,
      { status: "candidate" } as never,
      { status: "needs_review" } as never,
      { status: "deferred" } as never,
    ]);
    expect(counts).toEqual({
      total: 4,
      confirmed: 1,
      candidate: 1,
      needsReview: 1,
      deferred: 1,
    });
  });
});

describe("ProjectRailRecommendationButton", () => {
  it("shows recommendation rail item with toggle affordance", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectRailRecommendationButton, { effectiveProjectId: "p1" }),
    );
    expect(html).toContain("추천");
    expect(html).toContain('data-testid="platform-recommendation-rail-project"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('type="button"');
    expect(html).not.toContain("href=");
  });
});

describe("recommendation panel toggle", () => {
  it("inverts open flag when toggling recommendation drawer", () => {
    expect(toggleRecommendationPanelOpen("p1", false)).toBeUndefined();
    expect(toggleRecommendationPanelOpen("p1", true)).toBeUndefined();
  });
});

describe("RecommendationEvidencePanel", () => {
  it("renders recommendation evidence panel when items are provided", () => {
    const html = renderToStaticMarkup(
      createElement(RecommendationEvidencePanel, {
        items: [
          {
            id: "1",
            title: "Quick Design 추천안",
            stage: "planning",
            status: "candidate",
            aiMemberLabel: "AI 기획자",
            createdAt: now,
            summary: "MVP 범위를 제안했습니다.",
            reasons: ["사용자가 빠른 프로토타입을 요청함"],
            sourceInputs: ["회의록 자동화 요청"],
            referencedArtifacts: ["프로토타입 기획안"],
            unresolvedItems: ["파일 업로드 제한"],
            nextActions: ["확인"],
            sourceTraceIds: ["quick_design"],
          },
        ],
      }),
    );
    expect(html).toContain("AI 추천근거");
    expect(html).toContain("Quick Design 추천안");
    expect(html).toContain("사용자 입력");
    expect(html).toContain("확인 필요");
    expect(html).not.toMatch(/맥락 예산/);
  });
});

describe("RequirementsMessageExplainability inline visibility", () => {
  it("does not render inline AI decision summary when explainability debug is disabled", () => {
    expect(showInlineMessageExplainability()).toBe(false);
    const html = renderToStaticMarkup(
      createElement(RequirementsMessageExplainability, {
        message: {
          id: "m1",
          role: "ai",
          speakerType: "AI",
          speakerId: "ai",
          speakerName: "AI",
          visibility: "PUBLIC",
          messageType: "ANSWER",
          content: "테스트",
          createdAt: now,
          meta: {
            stage: "REQUIREMENTS",
            messageOverlayExplainability: {
              overlayIdentity: { roleKey: "planner", perspective: "기획", provider: "p", capabilities: [] },
            },
          },
        },
      }),
    );
    expect(html).toBe("");
    expect(html).not.toContain("AI 판단 보기");
  });
});

