/**
 * Rule-based document language detection (no LLM).
 */
export type LanguageDetectionResult = {
  language: string | null;
  languageSource: "PROVIDER" | "DOCLING_META" | "RULE_BASED" | "UNKNOWN";
  languageConfidence: number | null;
};

function countScriptChars(text: string) {
  let hangul = 0;
  let latin = 0;
  let hiraganaKatakana = 0;
  let cjk = 0;
  let total = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (/\s/.test(ch)) continue;
    total += 1;
    if (code >= 0xac00 && code <= 0xd7a3) hangul += 1;
    else if ((code >= 0x3040 && code <= 0x30ff) || (code >= 0x31f0 && code <= 0x31ff)) {
      hiraganaKatakana += 1;
    } else if (code >= 0x4e00 && code <= 0x9fff) cjk += 1;
    else if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) latin += 1;
  }
  return { hangul, latin, hiraganaKatakana, cjk, total };
}

export function detectLanguageFromText(text: string): LanguageDetectionResult {
  const sample = text.slice(0, 20_000);
  const counts = countScriptChars(sample);
  if (counts.total < 20) {
    return { language: null, languageSource: "UNKNOWN", languageConfidence: null };
  }
  const hangulRatio = counts.hangul / counts.total;
  const latinRatio = counts.latin / counts.total;
  const jpRatio = counts.hiraganaKatakana / counts.total;
  const cjkRatio = counts.cjk / counts.total;

  if (hangulRatio >= 0.15) {
    return {
      language: "ko",
      languageSource: "RULE_BASED",
      languageConfidence: Math.min(0.99, 0.55 + hangulRatio),
    };
  }
  if (jpRatio >= 0.08) {
    return {
      language: "ja",
      languageSource: "RULE_BASED",
      languageConfidence: Math.min(0.99, 0.5 + jpRatio),
    };
  }
  if (cjkRatio >= 0.2 && hangulRatio < 0.05) {
    return {
      language: "zh",
      languageSource: "RULE_BASED",
      languageConfidence: Math.min(0.99, 0.5 + cjkRatio),
    };
  }
  if (latinRatio >= 0.4) {
    return {
      language: "en",
      languageSource: "RULE_BASED",
      languageConfidence: Math.min(0.99, 0.45 + latinRatio),
    };
  }
  return { language: null, languageSource: "UNKNOWN", languageConfidence: null };
}

export function resolveDocumentLanguage(input: {
  providerLanguage?: string | null;
  doclingLanguage?: string | null;
  textSample?: string | null;
}): LanguageDetectionResult {
  const provider = input.providerLanguage?.trim().toLowerCase();
  if (provider) {
    return {
      language: provider,
      languageSource: "PROVIDER",
      languageConfidence: 1,
    };
  }
  const docling = input.doclingLanguage?.trim().toLowerCase();
  if (docling) {
    return {
      language: docling,
      languageSource: "DOCLING_META",
      languageConfidence: 0.9,
    };
  }
  if (input.textSample?.trim()) {
    return detectLanguageFromText(input.textSample);
  }
  return { language: null, languageSource: "UNKNOWN", languageConfidence: null };
}
