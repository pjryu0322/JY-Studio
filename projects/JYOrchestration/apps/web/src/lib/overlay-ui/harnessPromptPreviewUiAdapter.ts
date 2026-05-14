/**
 * Harness Phase H1 — Prompt Timeline Overlay UI **adapter**.
 *
 * `HarnessPromptAssemblyPreview` + `HarnessPromptPreviewDiff` (replay metadata)을
 * UI-friendly ViewModel로 변환한다. **순수 함수, read-only display.**
 *
 * 내부 enum/code는 사용자 표현으로 변환된다.
 */

import type {
  HarnessPromptAssemblyPreview,
  HarnessPromptPreviewDiff,
  HarnessPromptSection,
  HarnessPromptSectionType,
} from "@/lib/harness/promptAssembly/harnessPromptAssemblyTypes";
import { harnessPromptSectionTitle } from "@/lib/harness/promptAssembly/harnessPromptAssemblyTypes";
import { formatKoreanInt } from "@/lib/overlay-ui/overlayUiFormat";
import {
  overlayUiOverflowRiskLabel,
  overlayUiOverflowRiskTone,
  type OverlayUiBadgeTone,
} from "@/lib/overlay-ui/overlayUiLabel";

/**
 * "이 미리보기는 실제 LLM 호출에 사용된 프롬프트가 아니라, Harness 기준으로 조립했을 때의 예시입니다."
 * — preview UI 상단에 항상 노출되는 공식 안내.
 */
export const HARNESS_PROMPT_PREVIEW_DISCLAIMER =
  "이 미리보기는 실제 LLM 호출에 사용된 프롬프트가 아니라, Harness 기준으로 조립했을 때의 예시입니다.";

/**
 * 사용자 표현 라벨은 `harnessPromptAssemblyTypes.harnessPromptSectionTitle`을 단일 출처로 재사용한다.
 * (builder의 section title과 동일 결과 보장)
 */
export function harnessPromptSectionTypeLabel(value: HarnessPromptSectionType): string {
  return harnessPromptSectionTitle(value);
}

export type HarnessPromptPreviewSectionRowVM = Readonly<{
  id: string;
  type: HarnessPromptSectionType;
  typeLabel: string;
  title: string;
  source: string;
  includeReason: string;
  estimatedCostLabel: string;
  contentPreview: string;
}>;

export type HarnessPromptPreviewDiffVM = Readonly<{
  hasData: boolean;
  existingPromptLengthLabel: string;
  previewLengthLabel: string;
  sectionCountLabel: string;
  missingSectionLabels: readonly string[];
  extraSectionLabels: readonly string[];
  warnings: readonly string[];
}>;

export type HarnessPromptPreviewVM = Readonly<{
  hasData: boolean;
  disclaimer: string;
  modeLabel: string;
  sectionRows: readonly HarnessPromptPreviewSectionRowVM[];
  sectionCountLabel: string;
  totalEstimatedCostLabel: string;
  overflowRiskLabel: string;
  overflowRiskTone: OverlayUiBadgeTone;
  warnings: readonly string[];
  diff: HarnessPromptPreviewDiffVM;
}>;

const CONTENT_PREVIEW_MAX = 200;

function clipContentPreview(content: string): string {
  if (content.length <= CONTENT_PREVIEW_MAX) return content;
  return `${content.slice(0, CONTENT_PREVIEW_MAX - 1)}…`;
}

function buildSectionRow(section: HarnessPromptSection): HarnessPromptPreviewSectionRowVM {
  return {
    id: section.id,
    type: section.type,
    typeLabel: harnessPromptSectionTypeLabel(section.type),
    title: section.title,
    source: section.source,
    includeReason: section.includeReason,
    estimatedCostLabel: `추정 비용 ~${formatKoreanInt(section.estimatedCost)}`,
    contentPreview: clipContentPreview(section.content),
  };
}

function buildDiffVM(
  diff: HarnessPromptPreviewDiff | null | undefined
): HarnessPromptPreviewDiffVM {
  if (!diff) {
    return {
      hasData: false,
      existingPromptLengthLabel: "ㅡ",
      previewLengthLabel: "ㅡ",
      sectionCountLabel: "ㅡ",
      missingSectionLabels: [],
      extraSectionLabels: [],
      warnings: [],
    };
  }
  return {
    hasData: true,
    existingPromptLengthLabel: `${formatKoreanInt(diff.existingPromptLength)}자`,
    previewLengthLabel: `${formatKoreanInt(diff.previewLength)}자`,
    sectionCountLabel: `${formatKoreanInt(diff.sectionCount)}개`,
    missingSectionLabels: diff.missingSectionTypes.map(harnessPromptSectionTypeLabel),
    extraSectionLabels: diff.extraSectionTypes.map(harnessPromptSectionTypeLabel),
    warnings: diff.warnings,
  };
}

/**
 * `HarnessPromptAssemblyPreview` (+ optional `HarnessPromptPreviewDiff`) → UI VM.
 *
 * preview가 없거나 sections가 0이면 `hasData=false`로 떨어져 UI는 empty hint를 노출.
 */
export function buildHarnessPromptPreviewVM(input: {
  readonly preview: HarnessPromptAssemblyPreview | null | undefined;
  readonly diff?: HarnessPromptPreviewDiff | null | undefined;
}): HarnessPromptPreviewVM {
  const { preview, diff } = input;
  if (!preview) {
    return {
      hasData: false,
      disclaimer: HARNESS_PROMPT_PREVIEW_DISCLAIMER,
      modeLabel: "dry-run",
      sectionRows: [],
      sectionCountLabel: "0개",
      totalEstimatedCostLabel: "ㅡ",
      overflowRiskLabel: "ㅡ",
      overflowRiskTone: "neutral",
      warnings: [],
      diff: buildDiffVM(diff ?? null),
    };
  }
  return {
    hasData: preview.sections.length > 0,
    disclaimer: HARNESS_PROMPT_PREVIEW_DISCLAIMER,
    modeLabel: "dry-run",
    sectionRows: preview.sections.map(buildSectionRow),
    sectionCountLabel: `${formatKoreanInt(preview.sections.length)}개`,
    totalEstimatedCostLabel: `~${formatKoreanInt(preview.totalEstimatedCost)}`,
    overflowRiskLabel: overlayUiOverflowRiskLabel(preview.overflowRisk),
    overflowRiskTone: overlayUiOverflowRiskTone(preview.overflowRisk),
    warnings: preview.warnings,
    diff: buildDiffVM(diff ?? null),
  };
}
