import { validateDoclingMarkdown } from "./docling-markdown-validator";
import { normalizeDoclingDocument } from "./docling-normalizer";
import {
  DOCLING_ADAPTER_TYPE,
  DOCLING_ADAPTER_VERSION,
  type AdapterInput,
  type AdapterValidationResult,
  type DocumentAdapter,
  type NormalizedDocumentDraft,
} from "./docling-types";
import { validateDoclingJson } from "./docling-validator";

export class DoclingAdapter implements DocumentAdapter {
  readonly type = DOCLING_ADAPTER_TYPE;
  readonly version = DOCLING_ADAPTER_VERSION;

  async validate(input: AdapterInput): Promise<AdapterValidationResult> {
    const jsonResult = validateDoclingJson(input);
    const mdResult = validateDoclingMarkdown({
      markdown: input.markdown,
      document: jsonResult.document,
    });

    const issues = [...jsonResult.issues, ...mdResult.issues];
    const ok = !issues.some((i) => i.severity === "ERROR");

    return {
      ok,
      issues,
      document: jsonResult.document,
      markdownText: mdResult.text,
      originMatch: jsonResult.originMatch,
    };
  }

  async normalize(input: AdapterInput): Promise<NormalizedDocumentDraft> {
    const validation = await this.validate(input);
    if (!validation.document) {
      throw new Error(
        validation.issues.find((i) => i.severity === "ERROR")?.message ??
          "Docling document validation failed.",
      );
    }
    if (!validation.ok) {
      const hard = validation.issues.filter((i) => i.severity === "ERROR");
      throw new Error(
        hard.map((i) => `${i.code}: ${i.message}`).join("; ") ||
          "Docling document validation failed.",
      );
    }

    return normalizeDoclingDocument(validation.document, {
      files: input.files,
      warnings: validation.issues.filter((i) => i.severity === "WARNING"),
    });
  }
}

export const doclingAdapter = new DoclingAdapter();
