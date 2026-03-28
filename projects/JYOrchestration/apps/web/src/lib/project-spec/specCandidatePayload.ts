import { parseMarkdownToSections } from "@/lib/project-spec/parseMarkdownSections";
import { scoreSpecMarkdown } from "@/lib/project-spec/scoreSpecMarkdown";

export type SpecCandidateScoreDto = {
  completeness: number;
  structure: number;
  executionReadiness: number;
  total: number;
};

export type SpecCandidateMetaDto = {
  sections: string[];
  requirementCount: number;
  hasArchitecture: boolean;
};

export function getSpecCandidateDisplayScore(r: {
  responseMarkdown: string;
  specCandidateScore?: unknown;
}): SpecCandidateScoreDto {
  const sc = r.specCandidateScore;
  if (
    sc &&
    typeof sc === "object" &&
    "total" in sc &&
    "completeness" in sc &&
    "structure" in sc &&
    "executionReadiness" in sc
  ) {
    return sc as SpecCandidateScoreDto;
  }
  const s = scoreSpecMarkdown(r.responseMarkdown);
  return {
    completeness: s.completeness,
    structure: s.structureQuality,
    executionReadiness: s.executionReadiness,
    total: s.overall,
  };
}

export function computeSpecCandidatePayload(md: string): {
  score: SpecCandidateScoreDto;
  meta: SpecCandidateMetaDto;
} {
  const s = scoreSpecMarkdown(md);
  const parsed = parseMarkdownToSections(md);
  const frMatches = md.match(/\bFR-\d+/gi);
  return {
    score: {
      completeness: s.completeness,
      structure: s.structureQuality,
      executionReadiness: s.executionReadiness,
      total: s.overall,
    },
    meta: {
      sections: parsed.sections.map((x) => x.title).filter(Boolean),
      requirementCount: frMatches ? frMatches.length : 0,
      hasArchitecture: /\b(architecture|아키텍처)\b/i.test(md) && /##\s*6\./.test(md),
    },
  };
}
