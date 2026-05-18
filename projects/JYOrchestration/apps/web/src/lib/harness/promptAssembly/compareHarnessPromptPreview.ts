/**
 * Harness Phase H1 — **Preview ↔ existing prompt diff helper**.
 *
 * **read-only / 진단용.** 이 헬퍼는 prompt payload를 바꾸지 않으며, 실제 적용 여부를
 * 결정하지도 않는다. 단지 "Harness preview vs 기존 prompt 본문"의 거시적 차이를
 * metadata로 노출한다(길이·section 누락/추가·warning).
 *
 * 결과(`HarnessPromptPreviewDiff`)는 timeline replay와 diagnostic API에 함께 흐른다.
 */

import {
  HARNESS_PROMPT_PREVIEW_WARNINGS_MAX,
  HARNESS_PROMPT_SECTION_ORDER,
  type HarnessPromptAssemblyPreview,
  type HarnessPromptPreviewDiff,
  type HarnessPromptSectionType,
} from "./harnessPromptAssemblyTypes";

/**
 * Harness 표준 set — preview에 포함되어 있어야 운영자가 일관성을 신뢰할 수 있는 section type.
 *
 * `diagnostic`은 표준 set에 포함하지 않는다(부가 정보용).
 */
const HARNESS_PROMPT_STANDARD_SECTION_TYPES: readonly HarnessPromptSectionType[] = [
  "role_contract",
  "project_context",
  "memory_context",
  "knowledge_context",
  "current_request",
  "constraints",
];

/** preview에 포함되는 section content를 단순 concat한 텍스트 길이. */
function totalPreviewLength(preview: HarnessPromptAssemblyPreview): number {
  let len = 0;
  for (const s of preview.sections) len += typeof s.content === "string" ? s.content.length : 0;
  return len;
}

function safeExistingLength(existing: string | null | undefined): number {
  if (typeof existing !== "string") return 0;
  return existing.length;
}

/** 길이 차이가 의미 있는지 판정(휴리스틱; 강한 enforcement 아님). */
function buildLengthDeltaWarning(existing: number, preview: number): string | null {
  if (existing === 0 && preview === 0) return null;
  if (existing === 0 && preview > 0) {
    return "기존 prompt가 비어 있어 Harness preview와 직접 비교가 어렵습니다.";
  }
  if (preview === 0 && existing > 0) {
    return "Harness preview가 비어 있어 기존 prompt와 직접 비교가 어렵습니다.";
  }
  const ratio = preview / Math.max(1, existing);
  if (ratio >= 1.5 || ratio <= 0.5) {
    return `기존 prompt 대비 Harness preview 길이가 큰 폭(${(ratio * 100).toFixed(0)}%)으로 차이가 있습니다.`;
  }
  return null;
}

/**
 * `existingPromptText`와 `HarnessPromptAssemblyPreview`의 거시적 diff를 계산한다.
 *
 * - missing: 표준 set 중 preview에 빠진 type(role_contract, knowledge_context 등).
 * - extra: 표준 set 외부에서 등장한 type(예: `diagnostic`).
 * - warnings: 길이/누락 경고. 모두 진단 metadata(차단 없음).
 */
export function compareHarnessPromptPreview(input: {
  readonly existingPromptText: string | null | undefined;
  readonly preview: HarnessPromptAssemblyPreview;
}): HarnessPromptPreviewDiff {
  const { existingPromptText, preview } = input;
  const previewSectionTypes = new Set<HarnessPromptSectionType>();
  for (const s of preview.sections) previewSectionTypes.add(s.type);

  const missing: HarnessPromptSectionType[] = [];
  for (const t of HARNESS_PROMPT_STANDARD_SECTION_TYPES) {
    if (!previewSectionTypes.has(t)) missing.push(t);
  }
  // standard set 외부에서 등장한 type만 extra로 분류 → diagnostic 같은 부가 type 분리.
  const standardSet = new Set<HarnessPromptSectionType>(HARNESS_PROMPT_STANDARD_SECTION_TYPES);
  const extra: HarnessPromptSectionType[] = [];
  for (const t of previewSectionTypes) {
    if (!standardSet.has(t)) extra.push(t);
  }
  // 결정적 순서로 정렬(표준 set 순서, 그 외 type은 알파벳 순).
  const missingOrdered = HARNESS_PROMPT_SECTION_ORDER.filter((t) => missing.includes(t));
  extra.sort();

  const existingLen = safeExistingLength(existingPromptText);
  const previewLen = totalPreviewLength(preview);

  const warnings: string[] = [];
  if (missingOrdered.length > 0) {
    warnings.push(
      `Harness 표준 섹션 ${missingOrdered.length}개가 미리보기에 누락되었습니다: ${missingOrdered.join(", ")}`
    );
  }
  const lengthWarning = buildLengthDeltaWarning(existingLen, previewLen);
  if (lengthWarning) warnings.push(lengthWarning);

  return {
    existingPromptLength: existingLen,
    previewLength: previewLen,
    sectionCount: preview.sections.length,
    missingSectionTypes: missingOrdered,
    extraSectionTypes: extra,
    warnings: warnings.slice(0, HARNESS_PROMPT_PREVIEW_WARNINGS_MAX),
  };
}
