import type { LayoutProfile } from "@/lib/template/templateDetector";
import type { TemplateSchema } from "@/lib/template/schema";
import { normalizeLabel } from "@/lib/templateAuto/normalize";
import type { DriftItem, DriftResult } from "./driftTypes";
import { driftConfig } from "./driftConfig";
import { matchSections, type SectionLike } from "./sectionMatcher";

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
  const items: DriftItem[] = [];
  const templateSections: SectionLike[] = input.templateSchema.sections.map((section, idx) => ({
    id: section.id,
    title: section.title,
    orderHint: section.orderHint ?? idx + 1,
  }));
  const draftFromTemplate = (() => {
    if (
      !input.extractedTemplateDraft ||
      typeof input.extractedTemplateDraft !== "object"
    ) {
      return null;
    }
    const raw = input.extractedTemplateDraft as {
      sections?: Array<{ id?: string; title?: string; orderHint?: number }>;
    };
    if (!Array.isArray(raw.sections)) return null;
    return raw.sections
      .filter((section) => typeof section?.title === "string" && section.title.trim().length > 0)
      .map((section, idx) => ({
        id: section.id || `draft_sec_${idx + 1}`,
        title: section.title!.trim(),
        orderHint: section.orderHint ?? idx + 1,
      }));
  })();
  const draftSections: SectionLike[] =
    draftFromTemplate && draftFromTemplate.length > 0
      ? draftFromTemplate
      : input.layoutProfile.sectionCandidates.map((section, idx) => ({
          id: `layout_sec_${idx + 1}`,
          title: section.title,
          orderHint: section.order + 1,
        }));

  const matchResult = matchSections(templateSections, draftSections);
  const lowMatches = matchResult.matched.filter((item) => item.score < 0.65);
  const goodMatches = matchResult.matched.filter((item) => item.score >= 0.65);

  for (const match of goodMatches) {
    const tNorm = normalizeLabel(match.templateSection.title);
    const dNorm = normalizeLabel(match.draftSection.title);
    if (tNorm !== dNorm) {
      items.push({
        kind: "SECTION_RENAMED",
        severity: match.score >= driftConfig.titleSimilarityThreshold ? "low" : "medium",
        message: `섹션 제목 변경 감지: "${match.templateSection.title}" → "${match.draftSection.title}"`,
        ref: {
          sectionId: match.templateSection.id,
        },
        metrics: {
          matchScore: match.score,
          reason: match.reason,
        },
      });
    }
  }

  const removedSections = [
    ...matchResult.unmatchedTemplate,
    ...lowMatches.map((item) => item.templateSection),
  ];
  const addedSections = [
    ...matchResult.unmatchedDraft,
    ...lowMatches.map((item) => item.draftSection),
  ];

  for (const section of removedSections) {
    items.push({
      kind: "SECTION_REMOVED",
      severity: "medium",
      message: `템플릿 섹션 누락: "${section.title}"`,
      ref: { sectionId: section.id },
    });
  }
  for (const section of addedSections) {
    items.push({
      kind: "SECTION_ADDED",
      severity: "medium",
      message: `새 섹션 감지: "${section.title}"`,
      ref: { sectionId: section.id },
    });
  }

  const summary = {
    added: items.filter((item) => item.kind === "SECTION_ADDED").length,
    removed: items.filter((item) => item.kind === "SECTION_REMOVED").length,
    modified: items.filter((item) => item.kind === "SECTION_RENAMED").length,
    anchorsMissing: 0,
    layoutShifts: 0,
  };
  const weighted =
    (summary.modified + summary.added + summary.removed) * driftConfig.weights.sections +
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
    items,
    summary,
  };
}
