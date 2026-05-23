import { describe, expect, it } from "vitest";
import { isMessengerProjectConvertRequest } from "@/lib/messenger/messengerProjectConvertIntent";

describe("isMessengerProjectConvertRequest", () => {
  it("detects project conversion chat requests", () => {
    expect(isMessengerProjectConvertRequest("프로젝트로 전환해줘")).toBe(true);
    expect(isMessengerProjectConvertRequest("프로젝트로 만들어줘")).toBe(true);
    expect(isMessengerProjectConvertRequest("현재 대화를 프로젝트로 전환해줘")).toBe(true);
    expect(isMessengerProjectConvertRequest("프로토타입 준비해줘")).toBe(true);
  });

  it("does not match summary-only or normal chat", () => {
    expect(isMessengerProjectConvertRequest("요약해줘")).toBe(false);
    expect(isMessengerProjectConvertRequest("녹취를 회의록으로 정리하는 서비스를 만들고 싶어")).toBe(false);
    expect(isMessengerProjectConvertRequest("")).toBe(false);
  });
});
