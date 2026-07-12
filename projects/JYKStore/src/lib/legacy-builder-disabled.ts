/** Shared response for frozen internal Builder generation APIs (P28). */

export const LEGACY_BUILDER_DISABLED_ERROR = "LEGACY_BUILDER_DISABLED";

export const LEGACY_BUILDER_DISABLED_MESSAGE =
  "JYKStore 내부 지식 생성 기능은 종료되었습니다.";

/** Developer-facing hint — not required on user-facing UI. */
export const LEGACY_BUILDER_DISABLED_DEV_HINT =
  "외부에서 생성된 Payload 등록 기능은 다음 단계에서 제공됩니다.";

export function legacyBuilderDisabledBody() {
  return {
    error: LEGACY_BUILDER_DISABLED_ERROR,
    message: LEGACY_BUILDER_DISABLED_MESSAGE,
  } as const;
}
