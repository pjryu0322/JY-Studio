import type { OcrQualitySignal } from "@/lib/chunking/types";

export function estimateOcrQuality(text: string): OcrQualitySignal {
  const raw = text ?? "";
  if (!raw.trim()) {
    return {
      unknownCharRatio: 1,
      symbolNoiseRatio: 1,
      brokenSpacingScore: 1,
    };
  }
  const chars = raw.length;
  const unknownCount =
    (raw.match(/�/g) ?? []).length + (raw.match(/\?{2,}/g) ?? []).join("").length;
  const symbolCount = (raw.match(/[^\p{L}\p{N}\s.,:;!?()[\]{}'"%\-_/]/gu) ?? []).length;
  const brokenSpacingCount = (raw.match(/[가-힣A-Za-z0-9]\s{2,}[가-힣A-Za-z0-9]/g) ?? []).length;
  return {
    unknownCharRatio: Number((unknownCount / chars).toFixed(4)),
    symbolNoiseRatio: Number((symbolCount / chars).toFixed(4)),
    brokenSpacingScore: Number((brokenSpacingCount / Math.max(1, chars / 100)).toFixed(4)),
  };
}

export function ocrWarningsFromQuality(signal: OcrQualitySignal): string[] {
  const warnings: string[] = [];
  const unknown = signal.unknownCharRatio ?? 0;
  const symbol = signal.symbolNoiseRatio ?? 0;
  const spacing = signal.brokenSpacingScore ?? 0;
  if (unknown > 0.02 || spacing > 1.2) warnings.push("OCR_GARBLED");
  if (symbol > 0.12) warnings.push("HIGH_SYMBOL_NOISE");
  if ((signal.avgConfidence ?? 0.8) < 0.55) warnings.push("OCR_LOW_CONF");
  return warnings;
}

