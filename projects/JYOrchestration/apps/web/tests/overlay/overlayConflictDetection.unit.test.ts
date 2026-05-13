import { describe, expect, it } from "vitest";
import {
  detectOverlayConflicts,
  parseOverlayConflictWarningsFromUnknown,
  summarizeOverlayConflictWarnings,
} from "@/lib/overlay/overlayConflictDetection";

describe("detectOverlayConflicts", () => {
  it("detects localStorage vs JWT conflict (storage warning)", () => {
    const w = detectOverlayConflicts({
      timelineMessages: ["로그인 토큰은 localStorage에 저장하고 JWT 헤더로 전송"],
    });
    const codes = w.map((x) => x.code);
    expect(codes).toContain("OVERLAY_CONFLICT_LOCALSTORAGE_VS_JWT");
    expect(w.find((x) => x.code === "OVERLAY_CONFLICT_LOCALSTORAGE_VS_JWT")?.severity).toBe("warning");
  });

  it("detects session vs stateless auth conflict (authentication warning)", () => {
    const w = detectOverlayConflicts({
      timelineMessages: ["기본은 세션 기반 인증을 사용하지만, 점진적으로 stateless JWT로 전환"],
    });
    expect(w.find((x) => x.code === "OVERLAY_CONFLICT_SESSION_VS_STATELESS_AUTH")?.category).toBe(
      "authentication"
    );
  });

  it("detects monolith vs microservice as info-level architecture conflict", () => {
    const w = detectOverlayConflicts({
      timelineMessages: ["우선은 monolith로 가지만, 차후 microservice로 분리"],
    });
    expect(w.find((x) => x.code === "OVERLAY_CONFLICT_MONOLITH_VS_MICROSERVICE")?.severity).toBe("info");
    expect(
      w.find((x) => x.code === "OVERLAY_CONFLICT_MONOLITH_VS_MICROSERVICE")?.category
    ).toBe("architecture");
  });

  it("returns [] when no conflicts are mentioned", () => {
    const w = detectOverlayConflicts({
      timelineMessages: ["회원가입 화면을 만든다", "검색을 추가한다"],
    });
    expect(w).toEqual([]);
  });

  it("returns [] for empty input", () => {
    expect(detectOverlayConflicts({ timelineMessages: [] })).toEqual([]);
  });
});

describe("parseOverlayConflictWarningsFromUnknown", () => {
  it("drops rows missing fields and rejects unknown enum values", () => {
    const parsed = parseOverlayConflictWarningsFromUnknown([
      { code: "ok", severity: "info", category: "architecture", message: "m" },
      { code: "", severity: "info", category: "architecture", message: "m" },
      { code: "x", severity: "weird", category: "architecture", message: "m" },
      { code: "x", severity: "info", category: "bogus", message: "m" },
    ]);
    expect(parsed.map((p) => p.code)).toEqual(["ok"]);
  });
});

describe("summarizeOverlayConflictWarnings", () => {
  it("counts severities and categories", () => {
    const w = detectOverlayConflicts({
      timelineMessages: [
        "로그인은 localStorage + JWT 무상태 인증 사용",
        "구조는 monolith에서 microservice로 전환",
      ],
    });
    const s = summarizeOverlayConflictWarnings(w);
    expect(s.warningCount + s.infoCount).toBe(w.length);
    expect(s.byCategory.architecture).toBeGreaterThanOrEqual(1);
  });
});
