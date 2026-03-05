import type { LayoutProfile } from "@/lib/template/templateDetector";
import type { TemplateSchema } from "@/lib/template/schema";
import type { DriftResult } from "./driftTypes";

interface DetectTemplateDriftInput {
  templateSchema: TemplateSchema;
  layoutProfile: LayoutProfile;
  docId?: string;
  docType?: TemplateSchema["docType"];
  extractedTemplateDraft?: unknown;
}

/**
 * Placeholder drift detector.
 * The scoring/rules engine will be implemented in follow-up tasks.
 */
export function detectTemplateDrift(
  input: DetectTemplateDriftInput
): DriftResult {
  return {
    templateId: input.templateSchema.templateId,
    version: input.templateSchema.version,
    docId: input.docId ?? "unknown",
    docType: input.docType ?? input.layoutProfile.docType,
    severity: "low",
    score: 0,
    items: [],
    summary: {
      added: 0,
      removed: 0,
      modified: 0,
      anchorsMissing: 0,
      layoutShifts: 0,
    },
  };
}
