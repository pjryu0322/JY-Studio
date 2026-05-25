import { describe, expect, it } from "vitest";
import {
  buildImplementationBootstrapBundle,
  buildImplementationOrchestrationSummary,
  buildImplementationRoleCheckDetailsMessage,
  buildImplementationRoleCheckSummary,
  hasImplementationOrchestrationBootstrap,
  hasImplementationRoleCheckDetailsShown,
  hasValidImplementationLeadBootstrap,
  IMPLEMENTATION_ORCHESTRATION_BOOTSTRAP_INTERNAL_TYPE,
  implementationEntryChips,
  isLegacyImplementationMemberBootstrapMessage,
  sanitizeImplementationConversationMessages,
} from "@/lib/prototype/implementationOrchestrationSummary";
import { newRequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { IMPLEMENTATION_MODE_PRIMARY_MEMBERS } from "@/lib/requirements/modeOrchestrationConfig";

const baseInput = {
  projectId: "p1",
  env: { git: "ok", github: "needs", cursor: "error", connectionTest: "needs" } as const,
  envOk: false,
  envSettingsHref: "/settings#execution",
  featureDraftTitles: ["업로드", "요약"],
  projectArtifacts: [],
  artifactOrchestrationV1: null,
  designOk: true,
};

describe("implementationOrchestrationSummary", () => {
  it("shows only lead AI developer message on implementation bootstrap", () => {
    const bundle = buildImplementationBootstrapBundle(baseInput);
    expect(bundle.messages.length).toBe(1);
    expect(hasImplementationOrchestrationBootstrap(bundle.messages)).toBe(true);
    expect(bundle.messages[0]?.speakerId).toBe("prototype_build");
    expect(bundle.messages.some((m) => m.speakerId === "prototype_review")).toBe(false);
    expect(bundle.messages.some((m) => m.speakerId === "security_reviewer")).toBe(false);
    expect(bundle.messages.some((m) => m.speakerId === "memo")).toBe(false);
    expect(bundle.timelineEntries.some((e) => e.action === "implementation_bootstrap_lead_developer_summary")).toBe(
      true,
    );
  });

  it("does not put raw env readiness lines in AI developer bootstrap message", () => {
    const [lead] = buildImplementationOrchestrationSummary(baseInput);
    expect(lead?.content).not.toMatch(/Git 저장소:\s*완료/);
    expect(lead?.content).not.toMatch(/AI 개발 도구 연결:/);
    expect(lead?.content).toContain("SCM 점검 결과");
    expect(lead?.content).toContain("역할별 점검 요약");
  });

  it("places Git and Code Agent readiness under SCM role check details", () => {
    const summary = buildImplementationRoleCheckSummary(baseInput);
    expect(summary.scm.envStatus.git).toBe("완료");
    expect(summary.scm.envStatus.codeAgent).toBe("오류");
    const detail = buildImplementationRoleCheckDetailsMessage({ summaryInput: baseInput, roleCheckSummary: summary });
    expect(detail.content).toContain("SCM:");
    expect(detail.content).toContain("코드 에이전트 연결: 오류");
    expect(hasImplementationRoleCheckDetailsShown([detail])).toBe(true);
  });

  it("shows role check details only when built for role check flow", () => {
    const bootstrap = buildImplementationOrchestrationSummary(baseInput);
    expect(hasImplementationRoleCheckDetailsShown(bootstrap)).toBe(false);
    const detail = buildImplementationRoleCheckDetailsMessage({ summaryInput: baseInput });
    expect(hasImplementationRoleCheckDetailsShown([...bootstrap, detail])).toBe(true);
  });

  it("includes role check view chip in bootstrap entry chips", () => {
    expect(implementationEntryChips(baseInput)).toContain("역할별 점검 보기");
    expect(implementationEntryChips(baseInput)).toContain("구현 작업안 확정");
  });

  it("treats only lead developer implementation bootstrap as valid", () => {
    const bundle = buildImplementationBootstrapBundle(baseInput);
    const [lead] = bundle.messages;
    expect(lead?.meta.implementationBootstrapKind).toBe("lead_developer_summary");
    expect(hasValidImplementationLeadBootstrap(bundle.messages)).toBe(true);

    const legacy = newRequirementsMessage({
      role: "ai",
      speakerType: "AI",
      speakerId: "prototype_build",
      speakerName: "AI개발자",
      messageType: "STATEMENT",
      content: "구현 준비",
      meta: {
        internalType: IMPLEMENTATION_ORCHESTRATION_BOOTSTRAP_INTERNAL_TYPE,
        serviceDesignStage: "implementation",
      },
    });
    expect(hasValidImplementationLeadBootstrap([legacy])).toBe(false);
  });

  it("filters legacy implementation member bootstrap messages on restore", () => {
    const bundle = buildImplementationBootstrapBundle(baseInput);
    const legacyReviewer = newRequirementsMessage({
      role: "ai",
      speakerType: "AI",
      speakerId: "prototype_review",
      speakerName: "AI검수자",
      messageType: "STATEMENT",
      content: "기능 정의서와 화면 정의서 기준으로 검수합니다.",
      meta: { serviceDesignStage: "implementation" },
    });
    const sanitized = sanitizeImplementationConversationMessages([legacyReviewer, ...bundle.messages]);
    expect(sanitized).toHaveLength(1);
    expect(sanitized[0]?.speakerId).toBe("prototype_build");
    expect(isLegacyImplementationMemberBootstrapMessage(legacyReviewer)).toBe(true);
  });

  it("shows only one lead developer message on implementation initial entry", () => {
    const bundle = buildImplementationBootstrapBundle(baseInput);
    expect(bundle.messages.filter((m) => m.role === "ai")).toHaveLength(1);
  });

  it("shows reviewer security scm details only after role check chip", () => {
    const bootstrap = buildImplementationOrchestrationSummary(baseInput);
    expect(hasImplementationRoleCheckDetailsShown(bootstrap)).toBe(false);
    const detail = buildImplementationRoleCheckDetailsMessage({ summaryInput: baseInput });
    expect(detail.content).toContain("AI검수자:");
    expect(detail.content).toContain("AI보안관:");
    expect(detail.content).toContain("SCM:");
  });

  it("does not include raw Git or Code Agent readiness lines in lead developer message", () => {
    const [lead] = buildImplementationBootstrapBundle(baseInput).messages;
    expect(lead?.content).not.toContain("Git 저장소:");
    expect(lead?.content).not.toContain("AI 개발 도구 연결:");
    expect(lead?.content).not.toContain("현재 개발 준비 상태:");
  });

  it("uses implementation primary members count for implementation member badge", () => {
    expect(IMPLEMENTATION_MODE_PRIMARY_MEMBERS.length).toBe(4);
  });

  it("does not expose Cursor or Code Agent as SingleChat member", () => {
    expect(IMPLEMENTATION_MODE_PRIMARY_MEMBERS.some((id) => String(id).toLowerCase().includes("cursor"))).toBe(false);
    const [lead] = buildImplementationOrchestrationSummary(baseInput);
    expect(lead?.content).not.toContain("Cursor 멤버");
    expect(lead?.content).not.toContain("Cursor가 제안");
  });
});
