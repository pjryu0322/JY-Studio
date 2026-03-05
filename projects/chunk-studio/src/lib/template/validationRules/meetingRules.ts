import { normalizeLabel } from "@/lib/templateAuto/normalize";
import type { TemplateDraftIssue } from "@/lib/template/validateTemplateDraft";

interface MeetingDraft {
  sections: Array<{ title: string }>;
  fields: Array<{ label: string }>;
}

export function validateMeetingTemplate(
  draft: MeetingDraft
): { errors: TemplateDraftIssue[]; warnings: TemplateDraftIssue[] } {
  const errors: TemplateDraftIssue[] = [];
  const warnings: TemplateDraftIssue[] = [];

  const normalizedFields = new Set(draft.fields.map((field) => normalizeLabel(field.label)));
  const normalizedSections = new Set(
    draft.sections.map((section) => normalizeLabel(section.title))
  );

  for (const requiredField of ["회의일시", "참석자"]) {
    if (!normalizedFields.has(normalizeLabel(requiredField))) {
      errors.push({
        code: "MEETING_REQUIRED_FIELD",
        message: `회의 템플릿 필수 필드 누락: ${requiredField}`,
      });
    }
  }

  for (const requiredSection of ["안건", "결정사항"]) {
    if (!normalizedSections.has(normalizeLabel(requiredSection))) {
      warnings.push({
        code: "MEETING_SECTION_WARNING",
        message: `회의 템플릿 권장 섹션 누락: ${requiredSection}`,
      });
    }
  }

  return { errors, warnings };
}
