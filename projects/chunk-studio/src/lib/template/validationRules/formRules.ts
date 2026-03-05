import { normalizeLabel } from "@/lib/templateAuto/normalize";
import type { TemplateDraftIssue } from "@/lib/template/validateTemplateDraft";

interface FormDraft {
  sections: Array<{ title: string }>;
  fields: Array<{ label: string }>;
}

export function validateFormTemplate(
  draft: FormDraft
): { errors: TemplateDraftIssue[]; warnings: TemplateDraftIssue[] } {
  const errors: TemplateDraftIssue[] = [];
  const warnings: TemplateDraftIssue[] = [];

  if (draft.sections.length < 2) {
    errors.push({
      code: "FORM_MIN_SECTIONS",
      message: "FORM 템플릿은 최소 2개 이상의 섹션이 필요합니다.",
    });
  }

  const normalizedFields = new Set(draft.fields.map((field) => normalizeLabel(field.label)));
  for (const requiredLabel of ["성명", "연락처"]) {
    if (!normalizedFields.has(normalizeLabel(requiredLabel))) {
      warnings.push({
        code: "FORM_MISSING_FIELD",
        message: `FORM 권장 필드 누락: ${requiredLabel}`,
      });
    }
  }

  return { errors, warnings };
}
