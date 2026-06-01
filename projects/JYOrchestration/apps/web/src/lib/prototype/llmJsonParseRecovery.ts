import { createHash } from "node:crypto";

export type LlmJsonParseRecoveryResult =
  | Readonly<{
      readonly ok: true;
      readonly value: unknown;
      readonly strategy: "direct_json_parse" | "markdown_fence_unwrapped" | "first_json_object_extracted";
      readonly rawLength: number;
    }>
  | Readonly<{
      readonly ok: false;
      readonly errorCode: "empty_response" | "json_parse_failed" | "no_json_object_found";
      readonly rawLength: number;
      readonly previewHash: string;
      readonly previewStart?: string;
      readonly lastParseStrategy?: string;
    }>;

export const CODE_TASK_LLM_JSON_SYSTEM_INSTRUCTIONS = [
  "You refine implementation code task plans for JYOrchestration.",
  "Output JSON only.",
  "Do not use markdown.",
  "Do not wrap the JSON in ```json fences.",
  "Do not include explanation before or after JSON.",
  'The root object must be a JSON object with a "tasks" array.',
  "Every task must include codeTaskId, parentTaskId, and required fields.",
  "Keep scope inside projects/JYOrchestration.",
].join(" ");

export function hashLlmResponsePreview(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function safeLlmResponsePreviewStart(raw: string, maxLen = 100): string {
  const collapsed = raw.trim().replace(/\s+/g, " ");
  if (!collapsed) return "";
  return collapsed.slice(0, maxLen);
}

function tryJsonParse(text: string): unknown | null {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function unwrapMarkdownJsonFence(text: string): string | null {
  const trimmed = text.trim();
  const fullFence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fullFence?.[1]) return fullFence[1].trim();

  const openFence = trimmed.match(/^```(?:json)?\s*([\s\S]*)$/i);
  if (openFence?.[1]) {
    return openFence[1].replace(/```\s*$/i, "").trim();
  }
  return null;
}

export function extractFirstBalancedJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

export function parseLlmJsonObjectWithRecovery(raw: string): LlmJsonParseRecoveryResult {
  const trimmed = String(raw ?? "").trim();
  const rawLength = trimmed.length;
  if (!rawLength) {
    return {
      ok: false,
      errorCode: "empty_response",
      rawLength: 0,
      previewHash: hashLlmResponsePreview(""),
    };
  }

  const previewHash = hashLlmResponsePreview(trimmed);
  const previewStart = safeLlmResponsePreviewStart(trimmed);

  const direct = tryJsonParse(trimmed);
  if (direct !== null && typeof direct === "object") {
    return { ok: true, value: direct, strategy: "direct_json_parse", rawLength };
  }

  const fenced = unwrapMarkdownJsonFence(trimmed);
  if (fenced) {
    const parsed = tryJsonParse(fenced);
    if (parsed !== null && typeof parsed === "object") {
      return {
        ok: true,
        value: parsed,
        strategy: "markdown_fence_unwrapped",
        rawLength,
      };
    }
  }

  const extracted = extractFirstBalancedJsonObject(trimmed);
  if (extracted) {
    const parsed = tryJsonParse(extracted);
    if (parsed !== null && typeof parsed === "object") {
      return {
        ok: true,
        value: parsed,
        strategy: "first_json_object_extracted",
        rawLength,
      };
    }
  }

  return {
    ok: false,
    errorCode: extracted ? "json_parse_failed" : "no_json_object_found",
    rawLength,
    previewHash,
    previewStart: previewStart || undefined,
    lastParseStrategy: extracted ? "first_json_object_extracted" : fenced ? "markdown_fence_unwrapped" : "direct_json_parse",
  };
}

export function classifyLlmProviderFallbackReason(input: {
  readonly message: string;
  readonly providerSource: string;
}): "missing_provider_key" | "llm_timeout_fallback" | "llm_provider_failed_fallback" {
  const providerSource = String(input.providerSource ?? "none");
  if (providerSource === "none") return "missing_provider_key";
  const m = String(input.message ?? "").toLowerCase();
  if (
    m.includes("timeout") ||
    m.includes("timed out") ||
    m.includes("etimedout") ||
    m.includes("abort") ||
    m.includes("deadline")
  ) {
    return "llm_timeout_fallback";
  }
  return "llm_provider_failed_fallback";
}
