import { describe, expect, it } from "vitest";
import {
  buildImplementationBootstrapBundle,
  buildImplementationOrchestrationSummary,
  buildImplementationRoleCheckDetailsMessage,
  buildImplementationRoleCheckSummary,
  hasImplementationOrchestrationBootstrap,
  hasImplementationRoleCheckDetailsShown,
  implementationEntryChips,
} from "@/lib/prototype/implementationOrchestrationSummary";
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

  it("does not expose Cursor or Code Agent as SingleChat member", () => {
    expect(IMPLEMENTATION_MODE_PRIMARY_MEMBERS.some((id) => String(id).toLowerCase().includes("cursor"))).toBe(false);
    const [lead] = buildImplementationOrchestrationSummary(baseInput);
    expect(lead?.content).not.toContain("Cursor 멤버");
    expect(lead?.content).not.toContain("Cursor가 제안");
  });
});
