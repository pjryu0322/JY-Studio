/**
 * Harness Phase H2 — **Apply-readiness UI adapter**.
 *
 * `HarnessPromptApplyReadinessReport` → 사용자 표현 VM. 순수 함수, read-only display.
 *
 * 사용자에게 "적용 가능"이라는 단정 표현을 노출하지 않는다 — `ready_candidate`는
 * **적용 후보**로 표기하며, 실제 적용은 항상 별도 단계.
 */

import { HARNESS_APPLY_READINESS_THRESHOLDS } from "@/lib/harness/promptAssembly/evaluateHarnessPromptApplyReadiness";
import type {
  HarnessPromptApplyReadinessFinding,
  HarnessPromptApplyReadinessLevel,
  HarnessPromptApplyReadinessReport,
} from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import {
  OVERLAY_UI_MISSING_RATE,
  formatKoreanInt,
  formatRateLabel,
} from "@/lib/overlay-ui/overlayUiFormat";
import type { OverlayUiBadgeTone } from "@/lib/overlay-ui/overlayUiLabel";

/** 적용 후보 UI 표기는 항상 "후보". 단정 표현 금지. */
const LEVEL_LABEL: Readonly<Record<HarnessPromptApplyReadinessLevel, string>> = {
  not_ready: "준비 부족",
  watch: "관찰 필요",
  ready_candidate: "적용 후보",
};

const LEVEL_TONE: Readonly<Record<HarnessPromptApplyReadinessLevel, OverlayUiBadgeTone>> = {
  not_ready: "warning",
  watch: "info",
  ready_candidate: "positive",
};

const SEVERITY_LABEL: Readonly<Record<HarnessPromptApplyReadinessFinding["severity"], string>> = {
  info: "안내",
  warning: "주의",
};

/**
 * "실제 적용 전 진단"임을 노출하는 공식 안내 문구.
 * UI 상단/툴팁에 고정 노출되어야 한다.
 */
export const HARNESS_PROMPT_APPLY_READINESS_DISCLAIMER =
  "이 표시는 실제 적용 결과가 아니라, 최근 기록을 기준으로 한 Harness 적용 준비도 진단입니다.";

export function harnessPromptApplyReadinessLevelLabel(level: HarnessPromptApplyReadinessLevel): string {
  return LEVEL_LABEL[level] ?? "ㅡ";
}

export function harnessPromptApplyReadinessLevelTone(
  level: HarnessPromptApplyReadinessLevel
): OverlayUiBadgeTone {
  return LEVEL_TONE[level] ?? "neutral";
}

export function harnessPromptApplyReadinessSeverityLabel(
  severity: HarnessPromptApplyReadinessFinding["severity"]
): string {
  return SEVERITY_LABEL[severity] ?? "안내";
}

export type HarnessPromptApplyReadinessFindingRowVM = Readonly<{
  code: string;
  severity: HarnessPromptApplyReadinessFinding["severity"];
  severityLabel: string;
  message: string;
}>;

export type HarnessPromptApplyReadinessUiVM = Readonly<{
  /** report가 존재하고 `sampledEntryCount > 0`이면 true. */
  hasData: boolean;
  disclaimer: string;
  levelLabel: string;
  levelTone: OverlayUiBadgeTone;
  /** 한 줄 헤더 요약(`샘플: N / Preview: M / 누락 …% / 위험 …% / 경고 …%`). */
  summaryText: string;
  sampledEntryCountLabel: string;
  previewEntryCountLabel: string;
  missingSectionRateLabel: string;
  highOverflowRiskRateLabel: string;
  warningRateLabel: string;
  averageExistingPromptLengthLabel: string;
  averagePreviewLengthLabel: string;
  findings: readonly HarnessPromptApplyReadinessFindingRowVM[];
  /** 사용자에게 보여줄 임계 정보(헬프 텍스트). */
  thresholdsHelpText: string;
}>;

function buildThresholdsHelpText(): string {
  const t = HARNESS_APPLY_READINESS_THRESHOLDS;
  const notReady = `누락 ${formatRateLabel(t.notReadyMissingSectionRate)} · 위험 ${formatRateLabel(
    t.notReadyHighOverflowRiskRate
  )} · 경고 ${formatRateLabel(t.notReadyWarningRate)}`;
  const watch = `누락 ${formatRateLabel(t.watchMissingSectionRate)} · 위험 ${formatRateLabel(
    t.watchHighOverflowRiskRate
  )} · 경고 ${formatRateLabel(t.watchWarningRate)}`;
  return `준비 부족 임계: ${notReady} / 관찰 임계: ${watch}`;
}

function buildSummaryText(
  level: HarnessPromptApplyReadinessLevel,
  sampledEntryCount: number,
  previewEntryCount: number,
  missingSectionRate: number,
  highOverflowRiskRate: number,
  warningRate: number
): string {
  return [
    `Harness 적용 준비도: ${harnessPromptApplyReadinessLevelLabel(level)}`,
    `샘플 ${formatKoreanInt(sampledEntryCount)}개 / Preview ${formatKoreanInt(previewEntryCount)}개`,
    `누락 ${formatRateLabel(missingSectionRate)} · 위험 ${formatRateLabel(
      highOverflowRiskRate
    )} · 경고 ${formatRateLabel(warningRate)}`,
  ].join(" · ");
}

function buildFindingRows(
  findings: readonly HarnessPromptApplyReadinessFinding[]
): readonly HarnessPromptApplyReadinessFindingRowVM[] {
  return findings.map((f) => ({
    code: f.code,
    severity: f.severity,
    severityLabel: harnessPromptApplyReadinessSeverityLabel(f.severity),
    message: f.message,
  }));
}

/**
 * `HarnessPromptApplyReadinessReport` → UI VM.
 *
 * - report가 null/undefined거나 mode가 잘못된 경우 hasData=false로 안전 fallback.
 * - `sampleLimit` 등 평가 입력은 별도로 가져오지 않는다(report.sampledEntryCount로 충분).
 */
export function buildHarnessPromptApplyReadinessVM(
  report: HarnessPromptApplyReadinessReport | null | undefined
): HarnessPromptApplyReadinessUiVM {
  const safe = report && report.mode === "dry_run_readiness" ? report : null;
  if (!safe) {
    return {
      hasData: false,
      disclaimer: HARNESS_PROMPT_APPLY_READINESS_DISCLAIMER,
      levelLabel: harnessPromptApplyReadinessLevelLabel("not_ready"),
      levelTone: harnessPromptApplyReadinessLevelTone("not_ready"),
      summaryText: `Harness 적용 준비도: ${harnessPromptApplyReadinessLevelLabel("not_ready")}`,
      sampledEntryCountLabel: "0개",
      previewEntryCountLabel: "0개",
      missingSectionRateLabel: OVERLAY_UI_MISSING_RATE,
      highOverflowRiskRateLabel: OVERLAY_UI_MISSING_RATE,
      warningRateLabel: OVERLAY_UI_MISSING_RATE,
      averageExistingPromptLengthLabel: OVERLAY_UI_MISSING_RATE,
      averagePreviewLengthLabel: OVERLAY_UI_MISSING_RATE,
      findings: [],
      thresholdsHelpText: buildThresholdsHelpText(),
    };
  }
  return {
    hasData: safe.sampledEntryCount > 0,
    disclaimer: HARNESS_PROMPT_APPLY_READINESS_DISCLAIMER,
    levelLabel: harnessPromptApplyReadinessLevelLabel(safe.level),
    levelTone: harnessPromptApplyReadinessLevelTone(safe.level),
    summaryText: buildSummaryText(
      safe.level,
      safe.sampledEntryCount,
      safe.previewEntryCount,
      safe.missingSectionRate,
      safe.highOverflowRiskRate,
      safe.warningRate
    ),
    sampledEntryCountLabel: `${formatKoreanInt(safe.sampledEntryCount)}개`,
    previewEntryCountLabel: `${formatKoreanInt(safe.previewEntryCount)}개`,
    missingSectionRateLabel: formatRateLabel(safe.missingSectionRate),
    highOverflowRiskRateLabel: formatRateLabel(safe.highOverflowRiskRate),
    warningRateLabel: formatRateLabel(safe.warningRate),
    averageExistingPromptLengthLabel: safe.averageExistingPromptLength
      ? `${formatKoreanInt(safe.averageExistingPromptLength)}자`
      : OVERLAY_UI_MISSING_RATE,
    averagePreviewLengthLabel: safe.averagePreviewLength
      ? `${formatKoreanInt(safe.averagePreviewLength)}자`
      : OVERLAY_UI_MISSING_RATE,
    findings: buildFindingRows(safe.findings),
    thresholdsHelpText: buildThresholdsHelpText(),
  };
}
