import {
  DOCLING_ERROR_CODES,
  issue,
  type DoclingIssue,
} from "./docling-errors";
import { matchOriginToSource } from "./docling-origin-matcher";
import { resolveDoclingReferences } from "./docling-reference-resolver";
import {
  DOCLING_SCHEMA_NAME,
  type AdapterInput,
  type AdapterValidationResult,
  type DoclingDocument,
} from "./docling-types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function decodeUtf8(
  input: string | Uint8Array,
): { ok: true; text: string } | { ok: false; message: string } {
  if (typeof input === "string") return { ok: true, text: input };
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(input);
    return { ok: true, text };
  } catch {
    return { ok: false, message: "Payload is not valid UTF-8." };
  }
}

function validateEntityArrays(
  doc: DoclingDocument,
  issues: DoclingIssue[],
): void {
  for (const key of ["texts", "tables", "pictures", "groups"] as const) {
    if (doc[key] === undefined) continue;
    if (!Array.isArray(doc[key])) {
      issues.push(
        issue(
          DOCLING_ERROR_CODES.DOCLING_SCHEMA_INVALID,
          "ERROR",
          `"${key}" must be an array when present.`,
          { field: key },
        ),
      );
    }
  }
}

/**
 * Schema / origin / reference checks for an already-parsed DoclingDocument
 * (e.g. from the streaming JSON projector).
 */
export function validateDoclingParsedDocument(
  doc: DoclingDocument,
  input?: Pick<AdapterInput, "source">,
  extraIssues?: DoclingIssue[],
): AdapterValidationResult {
  const issues: DoclingIssue[] = [...(extraIssues ?? [])];

  if (doc.schema_name !== DOCLING_SCHEMA_NAME) {
    issues.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_SCHEMA_INVALID,
        "ERROR",
        "DoclingDocument 형식이 아닙니다.",
        {
          field: "schema_name",
          hint: "Docling JSON Export 결과를 등록하세요.",
        },
      ),
    );
  }

  if (typeof doc.version !== "string" || doc.version.trim().length === 0) {
    issues.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_VERSION_REQUIRED,
        "ERROR",
        "Docling document version is required.",
        { field: "version" },
      ),
    );
  }

  if (typeof doc.name !== "string" || doc.name.trim().length === 0) {
    // Soft requirement: warn rather than hard-fail across Docling versions.
    issues.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_SCHEMA_INVALID,
        "WARNING",
        "Document name is missing; title may be inferred later.",
        { field: "name" },
      ),
    );
  }

  if (!isPlainObject(doc.origin)) {
    issues.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_ORIGIN_REQUIRED,
        "ERROR",
        "origin object is required.",
        { field: "origin" },
      ),
    );
  } else {
    if (
      typeof doc.origin.filename !== "string" ||
      doc.origin.filename.trim().length === 0
    ) {
      issues.push(
        issue(
          DOCLING_ERROR_CODES.DOCLING_ORIGIN_FILENAME_REQUIRED,
          "ERROR",
          "origin.filename is required.",
          { field: "origin.filename" },
        ),
      );
    }
    if (
      typeof doc.origin.mimetype !== "string" ||
      doc.origin.mimetype.trim().length === 0
    ) {
      issues.push(
        issue(
          DOCLING_ERROR_CODES.DOCLING_ORIGIN_MIMETYPE_REQUIRED,
          "ERROR",
          "origin.mimetype is required.",
          { field: "origin.mimetype" },
        ),
      );
    }
  }

  if (!isPlainObject(doc.body)) {
    issues.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_BODY_REQUIRED,
        "ERROR",
        "body object is required.",
        { field: "body" },
      ),
    );
  }

  validateEntityArrays(doc, issues);

  let originMatch: AdapterValidationResult["originMatch"];
  if (isPlainObject(doc.origin) && input?.source) {
    originMatch = matchOriginToSource({
      originFilename:
        typeof doc.origin.filename === "string"
          ? doc.origin.filename
          : undefined,
      originMimetype:
        typeof doc.origin.mimetype === "string"
          ? doc.origin.mimetype
          : undefined,
      sourceFilename: input.source.filename,
      sourceMimetype: input.source.mimetype,
    });
    issues.push(...originMatch.issues);
  }

  const hasHardSchemaFailure = issues.some(
    (i) =>
      i.severity === "ERROR" &&
      (i.code === DOCLING_ERROR_CODES.DOCLING_JSON_PARSE_FAILED ||
        i.code === DOCLING_ERROR_CODES.DOCLING_SCHEMA_INVALID),
  );

  if (!hasHardSchemaFailure && isPlainObject(doc.body)) {
    const refs = resolveDoclingReferences(doc);
    issues.push(...refs.issues);
  }

  const ok = !issues.some((i) => i.severity === "ERROR");
  return {
    ok,
    issues,
    document:
      hasHardSchemaFailure && doc.schema_name !== DOCLING_SCHEMA_NAME
        ? undefined
        : doc,
    originMatch,
  };
}

export function validateDoclingJson(
  input: AdapterInput,
): AdapterValidationResult {
  const issues: DoclingIssue[] = [];

  if (input.json === undefined || input.json === null) {
    issues.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_JSON_REQUIRED,
        "ERROR",
        "Docling JSON is required.",
        { field: "json", hint: "Docling JSON Export 결과를 등록하세요." },
      ),
    );
    return { ok: false, issues };
  }

  const decoded = decodeUtf8(input.json);
  if (!decoded.ok) {
    issues.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_JSON_PARSE_FAILED,
        "ERROR",
        decoded.message,
        { field: "json" },
      ),
    );
    return { ok: false, issues };
  }

  const raw = decoded.text;
  if (raw.trim().length === 0) {
    issues.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_JSON_EMPTY,
        "ERROR",
        "Docling JSON is empty.",
        { field: "json" },
      ),
    );
    return { ok: false, issues };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    issues.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_JSON_PARSE_FAILED,
        "ERROR",
        "Docling JSON could not be parsed.",
        { field: "json", hint: "유효한 JSON 파일인지 확인하세요." },
      ),
    );
    return { ok: false, issues };
  }

  if (!isPlainObject(parsed)) {
    issues.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_SCHEMA_INVALID,
        "ERROR",
        "Docling JSON root must be an object.",
        { field: "json" },
      ),
    );
    return { ok: false, issues };
  }

  return validateDoclingParsedDocument(parsed as DoclingDocument, input);
}
