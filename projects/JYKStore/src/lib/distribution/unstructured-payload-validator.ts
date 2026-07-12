import { validateZipAndReadSelectedEntries } from "@/lib/distribution/payload-zip-reader";
import type {
  PayloadProfileValidateInput,
  PayloadProfileValidationResult,
  PayloadProfileValidator,
  PayloadZipEntry,
} from "@/lib/distribution/payload-types";

export const UNSTRUCTURED_ENTRYPOINTS = [
  "payload/elements.json",
  "payload/chunked-elements.json",
] as const;

const CONTENT_FIELD_CANDIDATES = ["text", "content", "text_as_html"] as const;

function normalizeEntryPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function entryPathSet(entries: PayloadZipEntry[]): Set<string> {
  return new Set(entries.map((e) => normalizeEntryPath(e.path)));
}

function pickEntrypoint(paths: Set<string>): string | undefined {
  for (const candidate of UNSTRUCTURED_ENTRYPOINTS) {
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

function elementHasContent(element: Record<string, unknown>): boolean {
  for (const key of CONTENT_FIELD_CANDIDATES) {
    const value = element[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return true;
    }
  }
  return false;
}

export class UnstructuredPayloadValidator implements PayloadProfileValidator {
  readonly profile = "unstructured-elements-v1" as const;

  async validate(
    input: PayloadProfileValidateInput,
  ): Promise<PayloadProfileValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const paths = entryPathSet(input.zipEntries);

    const entrypoint = pickEntrypoint(paths);
    if (!entrypoint) {
      errors.push(
        `Missing Unstructured entrypoint (expected one of: ${UNSTRUCTURED_ENTRYPOINTS.join(", ")})`,
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

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      errors.push(`${entrypoint} is not valid JSON`);
      return { ok: false, entrypoint, warnings, errors };
    }

    if (!Array.isArray(parsed)) {
      errors.push(`${entrypoint} must be a JSON array`);
      return { ok: false, entrypoint, warnings, errors };
    }

    if (parsed.length === 0) {
      errors.push(`${entrypoint} array is empty`);
      return { ok: false, entrypoint, recordCount: 0, warnings, errors };
    }

    let withContent = 0;
    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i];
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        errors.push(`Element at index ${i} is not an object`);
        continue;
      }
      const record = item as Record<string, unknown>;
      if (typeof record.type !== "string" || record.type.trim().length === 0) {
        errors.push(`Element at index ${i} is missing a non-empty type field`);
      }
      if (elementHasContent(record)) {
        withContent += 1;
      }
    }

    if (withContent === 0) {
      errors.push("All elements lack extractable text/content fields");
    }

    return {
      ok: errors.length === 0,
      entrypoint,
      recordCount: parsed.length,
      warnings,
      errors,
    };
  }
}

export const unstructuredPayloadValidator = new UnstructuredPayloadValidator();
