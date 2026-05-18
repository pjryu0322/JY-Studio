import type { IntegrationProvider } from "@prisma/client";
import { maskOpenAiKeyForUi } from "@/lib/executionSetup/openAiKeyMask";

function maskAnthropicKeyForUi(key: string): string {
  const t = String(key ?? "").trim();
  if (!t) return "";
  if (t.length <= 14) return "sk-ant…***";
  return `${t.slice(0, 10)}…${t.slice(-4)}`;
}

function maskGoogleAiKeyForUi(key: string): string {
  const t = String(key ?? "").trim();
  if (!t) return "";
  if (t.length <= 12) return "…***";
  return `${t.slice(0, 6)}…${t.slice(-4)}`;
}

/** UI·저장 직후 미리보기용 — 평문 키 전체를 노출하지 않습니다. */
export function maskedPreviewForSecret(provider: IntegrationProvider, secret: string): string {
  if (provider === "OPENAI") return maskOpenAiKeyForUi(secret);
  if (provider === "ANTHROPIC") return maskAnthropicKeyForUi(secret);
  if (provider === "GOOGLE_AI" || String(provider) === "GEMINI") return maskGoogleAiKeyForUi(secret);
  const t = String(secret).trim();
  if (t.length <= 8) return "…***";
  return `${t.slice(0, 4)}…${t.slice(-3)}`;
}
