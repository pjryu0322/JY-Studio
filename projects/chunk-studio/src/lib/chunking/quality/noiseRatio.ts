import type { ChunkDTO } from "@/types/job";

const NOISE_PATTERNS: RegExp[] = [
  /^\s*page\s+\d+(\s*\/\s*\d+)?\s*$/im,
  /^\s*\d+\s*\/\s*\d+\s*$/im,
  /^\s*confidential\b.*$/im,
  /^\s*copyright\b.*$/im,
  /^\s*all rights reserved\b.*$/im,
  /^\s*draft\b.*$/im,
];

export function noiseRatio(chunk: ChunkDTO): number {
  const text = chunk.text;
  if (!text.trim()) return 1;

  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const tokens = tokenize(text);
  if (!tokens.length) return 1;

  const noisyLines = lines.filter((line) =>
    NOISE_PATTERNS.some((pattern) => pattern.test(line)),
  ).length;
  const symbols = tokens.filter((token) =>
    /^[^a-zA-Z0-9가-힣]+$/.test(token),
  ).length;
  const shortTokens = tokens.filter(
    (token) => token.length <= 1 && /[a-zA-Z]/.test(token),
  ).length;
  const warningPenalty = chunk.meta.quality.warnings.some(
    (warning) =>
      warning === "HEADER_NOISE" ||
      warning === "OCR_GARBLED" ||
      warning === "HIGH_SYMBOL_NOISE",
  )
    ? 0.15
    : 0;
  const declaredNoise = chunk.meta.noise ? 0.2 : 0;

  const lineNoise = lines.length
    ? noisyLines / lines.length
    : 0;
  const symbolNoise = symbols / tokens.length;
  const shortNoise = shortTokens / tokens.length;

  return clamp01(
    lineNoise * 0.45 +
      symbolNoise * 0.3 +
      shortNoise * 0.1 +
      warningPenalty +
      declaredNoise,
  );
}

function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
