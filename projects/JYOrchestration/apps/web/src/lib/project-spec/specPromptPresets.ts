export type SpecPromptPresetId = "default" | "public-si" | "startup-mvp" | "ai-product";

export const SPEC_PROMPT_PRESET_IDS: SpecPromptPresetId[] = [
  "default",
  "public-si",
  "startup-mvp",
  "ai-product",
];

export const SPEC_PROMPT_PRESET_LABELS: Record<SpecPromptPresetId, string> = {
  default: "Default",
  "public-si": "Public SI",
  "startup-mvp": "Startup MVP",
  "ai-product": "AI Product",
};

export function normalizeSpecPromptPreset(raw: string | null | undefined): SpecPromptPresetId {
  const s = String(raw ?? "").trim() as SpecPromptPresetId;
  return SPEC_PROMPT_PRESET_IDS.includes(s) ? s : "default";
}

/** 프리셋은 톤·강조만 바꾼다(시스템 안전 지시는 OpenAI system 메시지에만 둔다). */
export function specPromptPresetPreamble(preset: SpecPromptPresetId): string {
  switch (preset) {
    case "public-si":
      return (
        "[프리셋: Public SI]\n" +
        "- 문서 톤은 검토·감사에 견디도록 격식 있고 추적 가능하게.\n" +
        "- 요구사항은 ID, 근거, 승인·검수 포인트를 명시.\n" +
        "- 범위·제외·제약을 법·보안·운영 관점에서 빠짐없이.\n"
      );
    case "startup-mvp":
      return (
        "[프리셋: Startup MVP]\n" +
        "- 가장 빠른 검증 경로와 컷라인을 우선.\n" +
        "- P0/P1 구분을 과감히; Out of Scope를 크게 명시.\n" +
        "- 아키텍처는 MVP에 필요한 최소 침습으로.\n"
      );
    case "ai-product":
      return (
        "[프리셋: AI Product]\n" +
        "- 모델·데이터·프롬프트·평가 루프·안전 가드레일을 요구에 반영.\n" +
        "- 유스케이스에 휴먼 인 더 루프·실패 모드 포함.\n" +
        "- 비기능에 비용·지연·품질 지표를 구체화.\n"
      );
    default:
      return "";
  }
}
