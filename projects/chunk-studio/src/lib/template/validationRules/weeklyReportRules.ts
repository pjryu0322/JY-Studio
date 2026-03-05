import { normalizeLabel } from "@/lib/templateAuto/normalize";
import type { TemplateDraftIssue } from "@/lib/template/validateTemplateDraft";

interface WeeklyDraft {
  sections: Array<{ title: string }>;
  fields: Array<{ label: string }>;
}

export function validateWeeklyReportTemplate(
  draft: WeeklyDraft
): { errors: TemplateDraftIssue[]; warnings: TemplateDraftIssue[] } {
  const errors: TemplateDraftIssue[] = [];
  const warnings: TemplateDraftIssue[] = [];

  const normalizedSections = new Set(
    draft.sections.map((section) => normalizeLabel(section.title))
  );
  const normalizedFields = new Set(draft.fields.map((field) => normalizeLabel(field.label)));

  if (!normalizedSections.has(normalizeLabel("금주 진행"))) {
    errors.push({
      code: "WEEKLY_REQUIRED_SECTION",
      message: "주간 리포트 필수 섹션 누락: 금주 진행",
    });
  }

  for (const recommended of ["이슈", "차주 계획", "작성자"]) {
    const key = normalizeLabel(recommended);
    if (!normalizedSections.has(key) && !normalizedFields.has(key)) {
      warnings.push({
        code: "WEEKLY_RECOMMENDED_MISSING",
        message: `주간 리포트 권장 항목 누락: ${recommended}`,
      });
    }
  }

  return { errors, warnings };
}
