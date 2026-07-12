import { validateZipAndReadSelectedEntries } from "@/lib/distribution/payload-zip-reader";
import type {
  PayloadProfileValidateInput,
  PayloadProfileValidationResult,
  PayloadProfileValidator,
  PayloadZipEntry,
} from "@/lib/distribution/payload-types";

export const DOCLING_ENTRYPOINTS = [
  "payload/chunks.jsonl",
  "payload/document.json",
  "payload/document.md",
] as const;

const TEXT_FIELD_CANDIDATES = [
  "text",
  "content",
  "markdown",
  "page_content",
  "body",
  "raw_text",
] as const;

function normalizeEntryPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function entryPathSet(entries: PayloadZipEntry[]): Set<string> {
  return new Set(entries.map((e) => normalizeEntryPath(e.path)));
}

function hasPayloadDirectory(paths: Set<string>): boolean {
  for (const p of paths) {
    if (p === "payload" || p === "payload/" || p.startsWith("payload/")) {
      return true;
    }
  }
  return false;
}

function pickEntrypoint(paths: Set<string>): string | undefined {
  for (const candidate of DOCLING_ENTRYPOINTS) {
    if (paths.has(candidate)) return candidate;
  }
  return undefined;
}

async function loadTextEntry(
  zipBytes: Uint8Array | undefined,
  entryPath: string,
): Promise<string | null> {
  if (!zipBytes) return null;
  const read = await validateZipAndReadSelectedEntries(zipBytes, [entryPath]);
  const bytes = read.selectedContents[entryPath];
  if (!bytes) return null;
  return new TextDecoder().decode(bytes);
}

function extractTextField(record: Record<string, unknown>): string | null {
  for (const key of TEXT_FIELD_CANDIDATES) {
    const value = record[key];
    if (typeof value === "string") return value;
  }
  return null;
}

function validateJsonl(content: string): {
  ok: boolean;
  recordCount: number;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { ok: false, recordCount: 0, errors: ["chunks.jsonl is empty"], warnings };
  }

  let withText = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      errors.push(`Invalid JSON on line ${i + 1}`);
      continue;
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      errors.push(`Line ${i + 1} is not a JSON object`);
      continue;
    }
    const text = extractTextField(parsed as Record<string, unknown>);
    if (text != null && text.trim().length > 0) {
      withText += 1;
    }
  }

  if (errors.length === 0 && withText === 0) {
    errors.push("No extractable text fields found in JSONL records");
  } else if (withText < lines.length) {
    warnings.push(
      `${lines.length - withText} of ${lines.length} records lack a non-empty text field`,
    );
  }

  return {
    ok: errors.length === 0,
    recordCount: lines.length,
    errors,
    warnings,
  };
}

function validateDocumentJson(content: string): {
  ok: boolean;
  recordCount: number;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return {
      ok: false,
      recordCount: 0,
      errors: ["document.json is not valid JSON"],
      warnings,
    };
  }

  if (parsed === null || typeof parsed !== "object") {
    return {
      ok: false,
      recordCount: 0,
      errors: ["document.json must be a JSON object or array"],
      warnings,
    };
  }

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return {
        ok: false,
        recordCount: 0,
        errors: ["document.json array is empty"],
        warnings,
      };
    }
    let withText = 0;
    for (const item of parsed) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const text = extractTextField(item as Record<string, unknown>);
        if (text != null && text.trim().length > 0) withText += 1;
      }
    }
    if (withText === 0) {
      errors.push("No extractable text fields found in document.json array");
    }
    return {
      ok: errors.length === 0,
      recordCount: parsed.length,
      errors,
      warnings,
    };
  }

  const obj = parsed as Record<string, unknown>;
  const text = extractTextField(obj);
  if (text == null || text.trim().length === 0) {
    // Docling document.json often nests content; accept non-empty object as a record.
    if (Object.keys(obj).length === 0) {
      errors.push("document.json is an empty object");
    } else {
      warnings.push("document.json has no top-level text field; treating as opaque document");
    }
  }

  return {
    ok: errors.length === 0,
    recordCount: 1,
    errors,
    warnings,
  };
}

export class DoclingPayloadValidator implements PayloadProfileValidator {
  readonly profile = "docling-chunks-v1" as const;

  async validate(
    input: PayloadProfileValidateInput,
  ): Promise<PayloadProfileValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const paths = entryPathSet(input.zipEntries);

    if (!hasPayloadDirectory(paths)) {
      errors.push("Missing payload/ directory");
    }

    const entrypoint = pickEntrypoint(paths);
    if (!entrypoint) {
      errors.push(
        `Missing Docling entrypoint (expected one of: ${DOCLING_ENTRYPOINTS.join(", ")})`,
      );
      return { ok: false, warnings, errors };
    }

    if (!input.zipBytes) {
      warnings.push("ZIP bytes not provided; skipped entrypoint content validation");
      return { ok: errors.length === 0, entrypoint, warnings, errors };
    }

    const content = await loadTextEntry(input.zipBytes, entrypoint);
    if (content == null) {
      errors.push(`Unable to read entrypoint: ${entrypoint}`);
      return { ok: false, entrypoint, warnings, errors };
    }
    if (content.trim().length === 0) {
      errors.push(`Entrypoint is empty: ${entrypoint}`);
      return { ok: false, entrypoint, warnings, errors };
    }

    if (entrypoint.endsWith(".jsonl")) {
      const result = validateJsonl(content);
      return {
        ok: errors.length === 0 && result.ok,
        entrypoint,
        recordCount: result.recordCount,
        warnings: [...warnings, ...result.warnings],
        errors: [...errors, ...result.errors],
      };
    }

    if (entrypoint.endsWith(".json")) {
      const result = validateDocumentJson(content);
      return {
        ok: errors.length === 0 && result.ok,
        entrypoint,
        recordCount: result.recordCount,
        warnings: [...warnings, ...result.warnings],
        errors: [...errors, ...result.errors],
      };
    }

    // document.md — non-empty markdown is enough
    return {
      ok: errors.length === 0,
      entrypoint,
      recordCount: 1,
      warnings,
      errors,
    };
  }
}

export const doclingPayloadValidator = new DoclingPayloadValidator();
