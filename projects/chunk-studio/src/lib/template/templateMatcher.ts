import type { TemplateSchema } from "./schema";
import type { LayoutProfile } from "./templateDetector";

export interface TemplateMatchResult {
  templateId: string;
  version: string;
  confidence: number;
  reasons: string[];
}

function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a.map((v) => v.toLowerCase()));
  const sb = new Set(b.map((v) => v.toLowerCase()));
  const inter = [...sa].filter((v) => sb.has(v)).length;
  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 0 : inter / union;
}

export function matchTemplates(
  profile: LayoutProfile,
  templates: TemplateSchema[]
): TemplateMatchResult[] {
  return templates
    .map((template) => {
      const profileAnchors = profile.anchorCandidates.map((a) => a.text);
      const templateAnchors = template.anchors.map((a) => a.value);
      const layoutScore = jaccard(profileAnchors, templateAnchors);

      const profileSections = profile.sectionCandidates.map((s) => s.title);
      const templateSections = template.sections.map((s) => s.title);
      const structureScore = jaccard(profileSections, templateSections);

      const profileHeaders = profile.tableCandidates.flatMap((t) => t.headerLabels);
      const templateHeaders = template.tables.flatMap((t) => t.headerLabels);
      const fieldScore = jaccard(profileHeaders, templateHeaders);

      const score = 0.35 * layoutScore + 0.45 * structureScore + 0.2 * fieldScore;
      const matchedAnchorCount = Math.round(
        Math.min(profileAnchors.length, templateAnchors.length) * layoutScore
      );
      const matchedSectionCount = Math.round(
        Math.min(profileSections.length, templateSections.length) * structureScore
      );
      const matchedHeaderCount = Math.round(
        Math.min(profileHeaders.length, templateHeaders.length) * fieldScore
      );
      const reasons = [
        `앵커 유사도 ${Math.round(layoutScore * 100)}% (일치 후보 ${matchedAnchorCount}개)`,
        `섹션 구조 유사도 ${Math.round(structureScore * 100)}% (일치 섹션 ${matchedSectionCount}개)`,
        `표/필드 유사도 ${Math.round(fieldScore * 100)}% (일치 헤더 ${matchedHeaderCount}개)`,
      ];
      return {
        templateId: template.templateId,
        version: template.version,
        confidence: Number(score.toFixed(3)),
        reasons,
      };
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

