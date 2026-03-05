import type { LayoutProfile } from "@/lib/template/templateDetector";
import type { TemplateSchema } from "@/lib/template/schema";
import type { DriftResult } from "./driftTypes";
import { driftConfig } from "./driftConfig";

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
  const summary = {
    added: 0,
    removed: 0,
    modified: 0,
    anchorsMissing: 0,
    layoutShifts: 0,
  };
  const weighted =
    summary.modified * driftConfig.weights.sections +
    summary.added * driftConfig.weights.fields +
    summary.removed * driftConfig.weights.tables +
    summary.layoutShifts * driftConfig.weights.repeats +
    summary.anchorsMissing;
  const normalizationBase = Math.max(1, 10 * driftConfig.titleSimilarityThreshold);
  const score = Number(Math.max(0, Math.min(1, weighted / normalizationBase)).toFixed(2));
  const severity =
    score >= driftConfig.scoreThresholdHigh
      ? "high"
      : score >= driftConfig.scoreThresholdMedium
        ? "medium"
        : "low";

  return {
    templateId: input.templateSchema.templateId,
    version: input.templateSchema.version,
    docId: input.docId ?? "unknown",
    docType: input.docType ?? input.layoutProfile.docType,
    severity,
    score,
    items: [],
    summary,
  };
}
