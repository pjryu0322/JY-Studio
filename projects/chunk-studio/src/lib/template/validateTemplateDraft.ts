import { normalizeLabel } from "@/lib/templateAuto/normalize";
import { validateFormTemplate } from "./validationRules/formRules";
import { validateMeetingTemplate } from "./validationRules/meetingRules";
import { validateWeeklyReportTemplate } from "./validationRules/weeklyReportRules";

interface DraftBBox {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DraftShape {
  docType?: "form" | "meeting_minutes" | "weekly_report" | "monthly_report" | "unknown";
  sections: Array<{ id: string; title: string; bboxHint?: DraftBBox }>;
  fields: Array<{ key: string; label: string; sectionId?: string; bboxHint?: DraftBBox }>;
  tables: Array<{ id: string; name: string; sectionId?: string; bboxHint?: DraftBBox }>;
  repeatBlocks: Array<{
    id: string;
    name: string;
    pattern?: string;
    sectionId?: string;
    bboxHint?: DraftBBox;
  }>;
}

export interface TemplateDraftIssue {
  code: string;
  message: string;
  ref?: string;
}

export interface TemplateDraftValidation {
  errors: TemplateDraftIssue[];
  warnings: TemplateDraftIssue[];
}

function overlapRatio(a: DraftBBox, b: DraftBBox): number {
  if (a.page !== b.page) return 0;
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const iw = Math.max(0, x2 - x1);
  const ih = Math.max(0, y2 - y1);
  const inter = iw * ih;
  if (inter <= 0) return 0;
  const minArea = Math.min(a.w * a.h, b.w * b.h) || 1;
  return inter / minArea;
}

export function validateTemplateDraft(draft: DraftShape): TemplateDraftValidation {
  const errors: TemplateDraftIssue[] = [];
  const warnings: TemplateDraftIssue[] = [];

  if (draft.sections.length === 0) {
    errors.push({
      code: "NO_SECTIONS",
      message: "섹션이 없습니다. 최소 1개 이상의 Section이 필요합니다.",
    });
  }

  const seen = new Map<string, string>();
  for (const field of draft.fields) {
    const key = normalizeLabel(field.label);
    if (!key) continue;
    const prev = seen.get(key);
    if (prev) {
      warnings.push({
        code: "DUPLICATE_FIELD_LABEL",
        message: `중복 필드 라벨: ${field.label}`,
        ref: `${prev},${field.key}`,
      });
    } else {
      seen.set(key, field.key);
    }
  }

  for (const field of draft.fields) {
    if (!field.sectionId) {
      errors.push({
        code: "FIELD_WITHOUT_SECTION",
        message: `Section 미연결 필드: ${field.label}`,
        ref: field.key,
      });
    }
  }

  for (const repeat of draft.repeatBlocks) {
    if (!repeat.pattern?.trim()) {
      warnings.push({
        code: "REPEAT_WITHOUT_PATTERN",
        message: `반복 블록 패턴이 비어 있습니다: ${repeat.name}`,
        ref: repeat.id,
      });
    }
  }

  const elements = [
    ...draft.sections
      .filter((item) => item.bboxHint)
      .map((item) => ({ id: item.id, type: "section", bbox: item.bboxHint! })),
    ...draft.fields
      .filter((item) => item.bboxHint)
      .map((item) => ({ id: item.key, type: "field", bbox: item.bboxHint! })),
    ...draft.tables
      .filter((item) => item.bboxHint)
      .map((item) => ({ id: item.id, type: "table", bbox: item.bboxHint! })),
    ...draft.repeatBlocks
      .filter((item) => item.bboxHint)
      .map((item) => ({ id: item.id, type: "repeat", bbox: item.bboxHint! })),
  ];

  for (let i = 0; i < elements.length; i += 1) {
    for (let j = i + 1; j < elements.length; j += 1) {
      const ratio = overlapRatio(elements[i].bbox, elements[j].bbox);
      if (ratio > 0.5) {
        warnings.push({
          code: "OVERLAPPING_BBOX",
          message: `영역 겹침 높음 (${elements[i].type}:${elements[i].id} ↔ ${elements[j].type}:${elements[j].id})`,
          ref: `${elements[i].id},${elements[j].id}`,
        });
      }
    }
  }

  if (draft.docType === "form") {
    const result = validateFormTemplate(draft);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  } else if (draft.docType === "meeting_minutes") {
    const result = validateMeetingTemplate(draft);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  } else if (draft.docType === "weekly_report") {
    const result = validateWeeklyReportTemplate(draft);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  return { errors, warnings };
}
