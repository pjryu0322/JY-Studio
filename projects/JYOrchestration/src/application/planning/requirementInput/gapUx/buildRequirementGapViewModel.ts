/**
 * Build a UX-ready gap view model: grouped sections, priority ordering, summary stats.
 */

import type { RequirementGapSection, RequirementGapViewModel, RequirementGapViewModelInput } from "./gapUxContracts";
import { groupRequirementGaps } from "./groupRequirementGaps";
import { prioritizeRequirementGaps } from "./prioritizeRequirementGaps";

const PRIORITY_RANK: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export function buildRequirementGapViewModel(input: RequirementGapViewModelInput): RequirementGapViewModel {
  const groups = groupRequirementGaps(input.gaps);
  const prioritized = prioritizeRequirementGaps(groups, input.drafts);
  const sorted = [...prioritized].sort((a, b) => {
    const pr = PRIORITY_RANK[a.priority]! - PRIORITY_RANK[b.priority]!;
    if (pr !== 0) return pr;
    return a.code.localeCompare(b.code);
  });

  const sections: RequirementGapSection[] = sorted.map((g) => ({
    sectionId: `section-${g.code}`,
    title: g.title,
    priority: g.priority,
    questions: [...g.items],
  }));

  const totalGapQuestions = input.gaps.length;
  const highPriorityCount = sections
    .filter((s) => s.priority === "HIGH")
    .reduce((n, s) => n + s.questions.length, 0);

  return {
    normalizedText: input.normalizedText,
    drafts: [...input.drafts],
    sections,
    summary: {
      totalDrafts: input.drafts.length,
      totalGapQuestions,
      highPriorityCount,
    },
  };
}
