import { nanoid } from "nanoid";
import type { TemplateSchema } from "./schema";
import type { LayoutProfile } from "./templateDetector";

export interface BuilderSelections {
  sections: Array<{
    id?: string;
    title: string;
    level: number;
    required: boolean;
    parentId?: string;
    orderHint?: number;
    bboxHint?: { page: number; x: number; y: number; w: number; h: number };
  }>;
  fields: Array<{
    key: string;
    label: string;
    required: boolean;
    sectionId?: string;
    bboxHint?: { page: number; x: number; y: number; w: number; h: number };
  }>;
  tables: Array<{
    id?: string;
    name?: string;
    headerLabels: string[];
    required: boolean;
    sectionId?: string;
    bboxHint?: { page: number; x: number; y: number; w: number; h: number };
  }>;
  anchors: Array<{ type: "text" | "regex"; value: string; weight: number }>;
  repeatBlocks: Array<{
    id?: string;
    name?: string;
    pattern: string;
    sectionId?: string;
    min?: number;
    max?: number;
    bboxHint?: { page: number; x: number; y: number; w: number; h: number };
  }>;
}

export function buildTemplateFromSelections(input: {
  family: string;
  name: string;
  docType: TemplateSchema["docType"];
  templateId?: string;
  selections: BuilderSelections;
  profile: LayoutProfile;
}): TemplateSchema {
  const now = new Date().toISOString();
  const templateId = input.templateId || nanoid(10);
  const anchors =
    input.selections.anchors.length > 0
      ? input.selections.anchors
      : input.profile.anchorCandidates.slice(0, 5).map((a) => ({
          type: a.type,
          value: a.text,
          weight: Number(a.confidence.toFixed(2)),
        }));

  const sectionIdMap = new Map<string, string>();
  input.selections.sections.forEach((section, idx) => {
    const nextId = `sec_${idx + 1}`;
    if (section.id) sectionIdMap.set(section.id, nextId);
  });
  const sections = input.selections.sections.map((section, idx) => {
    const nextId = `sec_${idx + 1}`;
    return {
      id: nextId,
      title: section.title,
      level: section.level,
      required: section.required,
      parentId: section.parentId
        ? sectionIdMap.get(section.parentId) ?? undefined
        : undefined,
      orderHint: section.orderHint ?? idx + 1,
      bboxHint: section.bboxHint,
    };
  });

  const fields = input.selections.fields.map((field, idx) => ({
    key: field.key || `field_${idx + 1}`,
    label: field.label || `Field ${idx + 1}`,
    required: field.required,
    sectionId: field.sectionId ? sectionIdMap.get(field.sectionId) ?? undefined : undefined,
    bboxHint: field.bboxHint,
  }));

  const tables = input.selections.tables.map((table, idx) => ({
    id: `tbl_${idx + 1}`,
    sectionId: table.sectionId ? sectionIdMap.get(table.sectionId) ?? undefined : undefined,
    headerLabels: table.headerLabels,
    required: table.required,
    bboxHint: table.bboxHint,
  }));

  const repeatBlocks = input.selections.repeatBlocks.map((block, idx) => ({
    id: `rep_${idx + 1}`,
    sectionId: block.sectionId ? sectionIdMap.get(block.sectionId) ?? undefined : undefined,
    pattern: block.pattern,
    min: block.min,
    max: block.max,
    bboxHint: block.bboxHint,
  }));

  return {
    templateId,
    name: input.name,
    family: input.family,
    docType: input.docType,
    version: "v0.1",
    anchors,
    sections,
    fields,
    tables,
    repeatBlocks,
    createdAt: now,
    updatedAt: now,
  };
}

