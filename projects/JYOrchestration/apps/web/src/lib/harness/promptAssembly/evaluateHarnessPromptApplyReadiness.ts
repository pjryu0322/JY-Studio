/**
 * Harness Phase H2 — **Apply-readiness Evaluator**.
 *
 * 최근 timeline entries의 Harness preview/diff metadata를 누적 집계해
 * "적용 후보 수준인지"를 진단한다. **read-only / 적용 결정 아님.**
 *
 * 절대 원칙:
 * - 실제 prompt payload, LLM 호출, retrieval, provider, Cursor execution, GitHub
 *   PR/merge 어디에도 영향을 주지 않는다.
 * - level은 후보(`ready_candidate`)까지만 노출하며, 실제 적용은 항상 수동·별도.
 */

import type {
  HarnessPromptAssemblyPreview,
  HarnessPromptPreviewDiff,
} from "./harnessPromptAssemblyTypes";
import {
  emptyHarnessPromptApplyReadinessReport,
  type HarnessPromptApplyReadinessFinding,
  type HarnessPromptApplyReadinessLevel,
  type HarnessPromptApplyReadinessReport,
} from "./harnessPromptApplyReadinessTypes";

/** 샘플 entry 상한(과대 timeline 보호). 기본값. */
export const HARNESS_APPLY_READINESS_DEFAULT_SAMPLE_LIMIT = 10;

/** 한 번에 평가 가능한 최대 entry 수(메모리·CPU 보호). */
export const HARNESS_APPLY_READINESS_MAX_SAMPLE_LIMIT = 50;

/**
 * readiness 판정 임계값. **단일 출처**로 평가 helper / 테스트 / 문서가 공유한다.
 *
 * - `notReady*`: 즉시 not_ready로 떨어뜨리는 임계.
 * - `watch*`: watch로 떨어뜨리는 관찰 임계.
 */
export const HARNESS_APPLY_READINESS_THRESHOLDS = {
  notReadyMissingSectionRate: 0.5,
  notReadyHighOverflowRiskRate: 0.5,
  notReadyWarningRate: 0.7,
  watchMissingSectionRate: 0.2,
  watchHighOverflowRiskRate: 0.2,
  watchWarningRate: 0.3,
} as const;

/** findings 상한(UI/timeline 비대화 방지). */
export const HARNESS_APPLY_READINESS_FINDINGS_MAX = 8;

type ReadinessEntryInput = Readonly<{
  harnessPromptAssemblyPreview?: HarnessPromptAssemblyPreview | null;
  harnessPromptPreviewDiff?: HarnessPromptPreviewDiff | null;
}>;

function clampSampleLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return HARNESS_APPLY_READINESS_DEFAULT_SAMPLE_LIMIT;
  return Math.min(HARNESS_APPLY_READINESS_MAX_SAMPLE_LIMIT, Math.max(1, Math.floor(n)));
}

function safeRate(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  const r = numerator / denominator;
  if (!Number.isFinite(r)) return 0;
  if (r < 0) return 0;
  if (r > 1) return 1;
  // 소수점 4자리에서 안정화(JSON 직렬화·테스트 안정성).
  return Math.round(r * 10_000) / 10_000;
}

function safeAverage(values: readonly number[]): number {
  if (!values.length) return 0;
  let sum = 0;
  let count = 0;
  for (const v of values) {
    if (Number.isFinite(v) && v >= 0) {
      sum += v;
      count += 1;
    }
  }
  if (count === 0) return 0;
  return Math.floor(sum / count);
}

function pickRecentEntries(
  entries: readonly ReadinessEntryInput[] | null | undefined,
  sampleLimit: number
): readonly ReadinessEntryInput[] {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  if (entries.length <= sampleLimit) return entries;
  return entries.slice(entries.length - sampleLimit);
}

/** 단일 임계 기반 finding factory. severity는 watch/notReady에 따라 자동. */
function makeFinding(
  code: string,
  severity: HarnessPromptApplyReadinessFinding["severity"],
  message: string
): HarnessPromptApplyReadinessFinding {
  return { code, severity, message };
}

function deriveLevel(input: {
  readonly sampledEntryCount: number;
  readonly previewEntryCount: number;
  readonly missingSectionRate: number;
  readonly highOverflowRiskRate: number;
  readonly warningRate: number;
}): HarnessPromptApplyReadinessLevel {
  const t = HARNESS_APPLY_READINESS_THRESHOLDS;
  if (input.sampledEntryCount === 0 || input.previewEntryCount === 0) return "not_ready";
  if (
    input.missingSectionRate >= t.notReadyMissingSectionRate ||
    input.highOverflowRiskRate >= t.notReadyHighOverflowRiskRate ||
    input.warningRate >= t.notReadyWarningRate
  ) {
    return "not_ready";
  }
  if (
    input.missingSectionRate >= t.watchMissingSectionRate ||
    input.highOverflowRiskRate >= t.watchHighOverflowRiskRate ||
    input.warningRate >= t.watchWarningRate
  ) {
    return "watch";
  }
  return "ready_candidate";
}

function buildFindings(input: {
  readonly sampledEntryCount: number;
  readonly previewEntryCount: number;
  readonly missingSectionRate: number;
  readonly highOverflowRiskRate: number;
  readonly warningRate: number;
}): readonly HarnessPromptApplyReadinessFinding[] {
  const t = HARNESS_APPLY_READINESS_THRESHOLDS;
  const findings: HarnessPromptApplyReadinessFinding[] = [];
  if (input.sampledEntryCount === 0) {
    findings.push(
      makeFinding(
        "no_sample",
        "warning",
        "최근 timeline에 평가할 항목이 없습니다. AI 응답이 누적되면 다시 평가됩니다."
      )
    );
  }
  if (input.sampledEntryCount > 0 && input.previewEntryCount === 0) {
    findings.push(
      makeFinding(
        "no_preview",
        "warning",
        "샘플 항목에 Harness preview가 기록되지 않아 적용 후보를 판단할 수 없습니다."
      )
    );
  }
  if (input.missingSectionRate >= t.notReadyMissingSectionRate) {
    findings.push(
      makeFinding(
        "missing_section_rate_high",
        "warning",
        "Harness 표준 섹션 누락이 절반 이상에서 발생하고 있습니다."
      )
    );
  } else if (input.missingSectionRate >= t.watchMissingSectionRate) {
    findings.push(
      makeFinding(
        "missing_section_rate_watch",
        "info",
        "Harness 표준 섹션 누락이 관찰 임계를 초과합니다."
      )
    );
  }
  if (input.highOverflowRiskRate >= t.notReadyHighOverflowRiskRate) {
    findings.push(
      makeFinding(
        "overflow_risk_high_rate_high",
        "warning",
        "맥락 과다 위험 '높음'이 절반 이상에서 반복됩니다. 적용 검토 보류."
      )
    );
  } else if (input.highOverflowRiskRate >= t.watchHighOverflowRiskRate) {
    findings.push(
      makeFinding(
        "overflow_risk_high_rate_watch",
        "info",
        "맥락 과다 위험 '높음'이 관찰 임계를 초과합니다."
      )
    );
  }
  if (input.warningRate >= t.notReadyWarningRate) {
    findings.push(
      makeFinding(
        "warning_rate_high",
        "warning",
        "preview 경고가 대부분의 샘플에서 발생하고 있습니다."
      )
    );
  } else if (input.warningRate >= t.watchWarningRate) {
    findings.push(
      makeFinding(
        "warning_rate_watch",
        "info",
        "preview 경고 발생 빈도가 관찰 임계를 초과합니다."
      )
    );
  }
  return findings.slice(0, HARNESS_APPLY_READINESS_FINDINGS_MAX);
}

/**
 * 최근 timeline entries(샘플링 후)의 Harness preview/diff를 누적 집계해 readiness를 판정한다.
 *
 * - `entries`는 가장 오래된 → 가장 최근 순으로 들어온다고 가정한다(샘플은 끝에서 N개를 취함).
 * - `sampleLimit`은 1 ≤ value ≤ `HARNESS_APPLY_READINESS_MAX_SAMPLE_LIMIT`로 정규화된다.
 */
export function evaluateHarnessPromptApplyReadiness(input: {
  readonly entries: readonly ReadinessEntryInput[] | null | undefined;
  readonly sampleLimit?: number;
}): HarnessPromptApplyReadinessReport {
  const sampleLimit = clampSampleLimit(input.sampleLimit ?? HARNESS_APPLY_READINESS_DEFAULT_SAMPLE_LIMIT);
  const sampled = pickRecentEntries(input.entries, sampleLimit);
  const sampledEntryCount = sampled.length;
  if (sampledEntryCount === 0) {
    const empty = emptyHarnessPromptApplyReadinessReport();
    return {
      ...empty,
      findings: buildFindings({
        sampledEntryCount: 0,
        previewEntryCount: 0,
        missingSectionRate: 0,
        highOverflowRiskRate: 0,
        warningRate: 0,
      }),
    };
  }

  let previewEntryCount = 0;
  let missingSectionEntryCount = 0;
  let highOverflowRiskEntryCount = 0;
  let warningEntryCount = 0;
  const existingPromptLengths: number[] = [];
  const previewLengths: number[] = [];

  for (const entry of sampled) {
    const preview = entry.harnessPromptAssemblyPreview ?? null;
    const diff = entry.harnessPromptPreviewDiff ?? null;
    if (preview) {
      previewEntryCount += 1;
      if (preview.overflowRisk === "high") highOverflowRiskEntryCount += 1;
      if ((preview.warnings?.length ?? 0) > 0) warningEntryCount += 1;
    }
    if (diff) {
      if ((diff.missingSectionTypes?.length ?? 0) > 0) missingSectionEntryCount += 1;
      if (Number.isFinite(diff.existingPromptLength)) existingPromptLengths.push(diff.existingPromptLength);
      if (Number.isFinite(diff.previewLength)) previewLengths.push(diff.previewLength);
    }
  }

  const missingSectionRate = safeRate(missingSectionEntryCount, previewEntryCount);
  const highOverflowRiskRate = safeRate(highOverflowRiskEntryCount, previewEntryCount);
  const warningRate = safeRate(warningEntryCount, previewEntryCount);
  const averageExistingPromptLength = safeAverage(existingPromptLengths);
  const averagePreviewLength = safeAverage(previewLengths);

  const summary = {
    sampledEntryCount,
    previewEntryCount,
    missingSectionRate,
    highOverflowRiskRate,
    warningRate,
  };
  const level = deriveLevel(summary);
  const findings = buildFindings(summary);

  return {
    mode: "dry_run_readiness",
    level,
    sampledEntryCount,
    previewEntryCount,
    missingSectionRate,
    highOverflowRiskRate,
    warningRate,
    averageExistingPromptLength,
    averagePreviewLength,
    findings,
  };
}
