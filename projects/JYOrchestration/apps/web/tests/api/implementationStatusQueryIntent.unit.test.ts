import { describe, expect, it } from "vitest";
import { detectImplementationStatusQueryIntent } from "@/lib/prototype/implementationStatusQueryIntent";
import {
  buildImplementationEnvironmentCheckDetailsMessage,
  buildImplementationRoleCheckSummary,
  buildImplementationScmCheckDetailsMessage,
  buildImplementationStatusQueryMessage,
} from "@/lib/prototype/implementationOrchestrationSummary";

const summaryInput = {
  projectId: "p1",
  env: { git: "ok", github: "ok", cursor: "needs", connectionTest: "needs" },
  envOk: false,
  envSettingsHref: "/settings",
  featureDraftTitles: [],
  projectArtifacts: [],
  artifactOrchestrationV1: null,
  designOk: true,
} as const;

describe("detectImplementationStatusQueryIntent", () => {
  it("detects SCM status query", () => {
    expect(detectImplementationStatusQueryIntent("SCM점검결과 보여줘")).toBe("scm_check_details");
  });

  it("detects environment status query including user claim of readiness", () => {
    expect(
      detectImplementationStatusQueryIntent("환경설정이 필요하다고 해서, 환경설정은 다 정상으로 알고 있는데"),
    ).toBe("environment_check_details");
  });

  it("detects role check query", () => {
    expect(detectImplementationStatusQueryIntent("역할별 점검 보여줘")).toBe("role_check_details");
  });

  it("detects reviewer check query", () => {
    expect(detectImplementationStatusQueryIntent("AI검수자 점검 결과 보여줘")).toBe("reviewer_check_details");
  });

  it("detects security check query", () => {
    expect(detectImplementationStatusQueryIntent("AI보안관 보안 점검 결과 보여줘")).toBe("security_check_details");
  });

  it("does not treat general implementation requirements as status query", () => {
    expect(detectImplementationStatusQueryIntent("업로드 파일은 mp3와 wav만 허용해줘")).toBe("none");
  });
});

describe("buildImplementationStatusQueryMessage", () => {
  it("builds SCM details with env lines and CTA chips", () => {
    const summary = buildImplementationRoleCheckSummary(summaryInput);
    const msg = buildImplementationScmCheckDetailsMessage({ summaryInput, roleCheckSummary: summary });
    expect(msg.content).toContain("SCM 점검 결과입니다.");
    expect(msg.content).toContain("Git 저장소: 완료");
    expect(msg.content).toContain("연결 테스트: 필요");
    expect(msg.meta.interviewSuggestions).toContain("환경설정 점검 결과 보기");
  });

  it("builds environment details explaining platform judgment when envOk is false", () => {
    const summary = buildImplementationRoleCheckSummary(summaryInput);
    const msg = buildImplementationEnvironmentCheckDetailsMessage({ summaryInput, roleCheckSummary: summary });
    expect(msg.content).toContain("환경설정 점검 결과입니다.");
    expect(msg.content).toContain("가능한 원인");
    expect(msg.meta.interviewSuggestions).toContain("환경설정 열기");
  });

  it("routes role check intent to full role details message", () => {
    const msg = buildImplementationStatusQueryMessage({
      intent: "role_check_details",
      summaryInput,
    });
    expect(msg?.content).toContain("역할별 점검 결과입니다.");
    expect(msg?.content).toContain("AI검수자:");
  });
});
