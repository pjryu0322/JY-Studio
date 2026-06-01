import { createHash } from "node:crypto";

export type LlmJsonParseStrategy =
  | "direct_json_parse"
  | "markdown_fence_unwrapped"
  | "first_json_object_extracted";

export type LlmJsonParseAttemptOutcome =
  | "success"
  | "syntax_error"
  | "not_object"
  | "skipped_no_fence"
  | "skipped_no_json_object"
  | "unbalanced_json_object"
  | "extract_syntax_error";

export type LlmJsonParseAttemptTrace = Readonly<{
  readonly strategy: LlmJsonParseStrategy;
  readonly outcome: LlmJsonParseAttemptOutcome;
  readonly detail?: string;
}>;

export type LlmJsonParseRecoveryResult =
  | Readonly<{
      readonly ok: true;
      readonly value: unknown;
      readonly strategy: LlmJsonParseStrategy;
      readonly rawLength: number;
      readonly attempts: readonly LlmJsonParseAttemptTrace[];
    }>
  | Readonly<{
      readonly ok: false;
      readonly errorCode: "empty_response" | "json_parse_failed" | "no_json_object_found";
      readonly rawLength: number;
      readonly previewHash: string;
      readonly previewStart?: string;
      readonly attempts: readonly LlmJsonParseAttemptTrace[];
      readonly extractFailureReason?: string;
    }>;

export type LlmCodeTaskPlanNormalizeResult = Readonly<{
  /** Payload shaped as `{ tasks: unknown[] }` for downstream parsing. */
  readonly value: Readonly<{ readonly tasks: readonly unknown[] }>;
  readonly normalizeSource: string;
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

const DEV_PREVIEW_MAX_LEN = 100;

export function hashLlmResponsePreview(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function safeLlmResponsePreviewStart(raw: string, maxLen = DEV_PREVIEW_MAX_LEN): string {
  const collapsed = raw.trim().replace(/\s+/g, " ");
  if (!collapsed) return "";
  return collapsed.slice(0, maxLen);
}

/** Dev-only diagnostic log — never includes API keys; not written to prompt timeline. */
export function logLlmCodeTaskJsonDevPreview(input: Readonly<Record<string, string | number | boolean>>): void {
  if (String(process.env.NODE_ENV ?? "").trim() === "production") return;
  console.info("[implementation_code_task_llm_json]", input);
}

function tryJsonParse(text: string): Readonly<{ readonly ok: true; readonly value: unknown } | { readonly ok: false }> {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
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

export function extractFirstBalancedJsonObject(text: string): Readonly<
  | { readonly kind: "found"; readonly json: string }
  | { readonly kind: "no_open_brace" }
  | { readonly kind: "unbalanced" }
> {
  const start = text.indexOf("{");
  if (start < 0) return { kind: "no_open_brace" };

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
        return { kind: "found", json: text.slice(start, i + 1) };
      }
    }
  }
  return { kind: "unbalanced" };
}

function tasksPayloadFromRecord(
  record: Record<string, unknown>,
): Readonly<{ readonly tasks: readonly unknown[]; readonly field: "tasks" | "codeTasks" }> | null {
  if (Array.isArray(record.tasks)) {
    return { tasks: record.tasks, field: "tasks" };
  }
  if (Array.isArray(record.codeTasks)) {
    return { tasks: record.codeTasks, field: "codeTasks" };
  }
  return null;
}

/** Accept alternate LLM root shapes and normalize to `{ tasks: [...] }`. */
export function normalizeLlmCodeTaskPlanRoot(raw: unknown): LlmCodeTaskPlanNormalizeResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const rootPayload = tasksPayloadFromRecord(o);
  if (rootPayload) {
    return {
      value: { tasks: rootPayload.tasks },
      normalizeSource: `root.${rootPayload.field}`,
    };
  }

  for (const key of ["plan", "data", "implementationCodeTaskPlan", "codeTaskPlan", "payload"] as const) {
    const nested = o[key];
    if (!nested || typeof nested !== "object") continue;
    const nestedPayload = tasksPayloadFromRecord(nested as Record<string, unknown>);
    if (nestedPayload) {
      return {
        value: { tasks: nestedPayload.tasks },
        normalizeSource: `root.${key}.${nestedPayload.field}`,
      };
    }
  }

  return null;
}

export function formatLlmParseAttemptsForTimeline(
  attempts: readonly LlmJsonParseAttemptTrace[],
): string {
  return attempts
    .map((a) => `${a.strategy}:${a.outcome}${a.detail ? `(${a.detail.slice(0, 40)})` : ""}`)
    .join("|");
}

export function parseLlmJsonObjectWithRecovery(raw: string): LlmJsonParseRecoveryResult {
  const trimmed = String(raw ?? "").trim();
  const rawLength = trimmed.length;
  const attempts: LlmJsonParseAttemptTrace[] = [];

  if (!rawLength) {
    return {
      ok: false,
      errorCode: "empty_response",
      rawLength: 0,
      previewHash: hashLlmResponsePreview(""),
      attempts,
    };
  }

  const previewHash = hashLlmResponsePreview(trimmed);
  const previewStart = safeLlmResponsePreviewStart(trimmed);

  const directParsed = tryJsonParse(trimmed);
  if (directParsed.ok) {
    if (directParsed.value !== null && typeof directParsed.value === "object") {
      attempts.push({ strategy: "direct_json_parse", outcome: "success" });
      return {
        ok: true,
        value: directParsed.value,
        strategy: "direct_json_parse",
        rawLength,
        attempts,
      };
    }
    attempts.push({
      strategy: "direct_json_parse",
      outcome: "not_object",
      detail: typeof directParsed.value,
    });
  } else {
    attempts.push({ strategy: "direct_json_parse", outcome: "syntax_error" });
  }

  const fenced = unwrapMarkdownJsonFence(trimmed);
  if (!fenced) {
    attempts.push({ strategy: "markdown_fence_unwrapped", outcome: "skipped_no_fence" });
  } else {
    const fenceParsed = tryJsonParse(fenced);
    if (fenceParsed.ok && fenceParsed.value !== null && typeof fenceParsed.value === "object") {
      attempts.push({ strategy: "markdown_fence_unwrapped", outcome: "success" });
      return {
        ok: true,
        value: fenceParsed.value,
        strategy: "markdown_fence_unwrapped",
        rawLength,
        attempts,
      };
    }
    attempts.push({
      strategy: "markdown_fence_unwrapped",
      outcome: fenceParsed.ok ? "not_object" : "syntax_error",
    });
  }

  const extracted = extractFirstBalancedJsonObject(trimmed);
  if (extracted.kind === "no_open_brace") {
    attempts.push({
      strategy: "first_json_object_extracted",
      outcome: "skipped_no_json_object",
      detail: "no_open_brace",
    });
  } else if (extracted.kind === "unbalanced") {
    attempts.push({
      strategy: "first_json_object_extracted",
      outcome: "unbalanced_json_object",
      detail: "unclosed_object",
    });
  } else {
    const extractParsed = tryJsonParse(extracted.json);
    if (extractParsed.ok && extractParsed.value !== null && typeof extractParsed.value === "object") {
      attempts.push({ strategy: "first_json_object_extracted", outcome: "success" });
      return {
        ok: true,
        value: extractParsed.value,
        strategy: "first_json_object_extracted",
        rawLength,
        attempts,
      };
    }
    attempts.push({
      strategy: "first_json_object_extracted",
      outcome: "extract_syntax_error",
      detail: extractParsed.ok ? "not_object" : "syntax_error",
    });
  }

  const extractFailureReason =
    extracted.kind === "no_open_brace"
      ? "no_json_object_in_response"
      : extracted.kind === "unbalanced"
        ? "unbalanced_json_object"
        : "extracted_object_syntax_error";

  return {
    ok: false,
    errorCode: extracted.kind === "no_open_brace" ? "no_json_object_found" : "json_parse_failed",
    rawLength,
    previewHash,
    previewStart: previewStart || undefined,
    attempts,
    extractFailureReason,
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
