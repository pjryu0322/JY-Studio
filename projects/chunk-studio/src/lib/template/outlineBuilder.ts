export interface OutlineDraftInput {
  templateName: string;
  docType?: string;
  sections: Array<{ id: string; title: string; required: boolean; orderHint?: number }>;
  fields: Array<{ key: string; label: string; sectionId?: string }>;
  tables: Array<{ id: string; name: string; sectionId?: string }>;
  repeatBlocks: Array<{
    id: string;
    name: string;
    sectionId?: string;
    pattern?: string;
    min?: number;
    max?: number;
  }>;
}

export interface OutlineSection {
  id: string;
  title: string;
  required: boolean;
  fields: Array<{ key: string; label: string }>;
  tables: Array<{ id: string; name: string }>;
  repeatBlocks: Array<{
    id: string;
    name: string;
    pattern?: string;
    min?: number;
    max?: number;
  }>;
}

export interface OutlineModel {
  title: string;
  docType?: string;
  sections: OutlineSection[];
  unassigned: {
    fields: Array<{ key: string; label: string }>;
    tables: Array<{ id: string; name: string }>;
    repeatBlocks: Array<{
      id: string;
      name: string;
      pattern?: string;
      min?: number;
      max?: number;
    }>;
  };
}

export function buildOutline(input: OutlineDraftInput): OutlineModel {
  const sections = [...input.sections]
    .sort((a, b) => (a.orderHint ?? 9999) - (b.orderHint ?? 9999))
    .map((section) => ({
      id: section.id,
      title: section.title,
      required: section.required,
      fields: input.fields
        .filter((field) => field.sectionId === section.id)
        .map((field) => ({ key: field.key, label: field.label })),
      tables: input.tables
        .filter((table) => table.sectionId === section.id)
        .map((table) => ({ id: table.id, name: table.name })),
      repeatBlocks: input.repeatBlocks
        .filter((block) => block.sectionId === section.id)
        .map((block) => ({
          id: block.id,
          name: block.name,
          pattern: block.pattern,
          min: block.min,
          max: block.max,
        })),
    }));

  return {
    title: input.templateName || "새 템플릿",
    docType: input.docType,
    sections,
    unassigned: {
      fields: input.fields
        .filter((field) => !field.sectionId)
        .map((field) => ({ key: field.key, label: field.label })),
      tables: input.tables
        .filter((table) => !table.sectionId)
        .map((table) => ({ id: table.id, name: table.name })),
      repeatBlocks: input.repeatBlocks
        .filter((block) => !block.sectionId)
        .map((block) => ({
          id: block.id,
          name: block.name,
          pattern: block.pattern,
          min: block.min,
          max: block.max,
        })),
    },
  };
}

// Backward-compatible alias for readability-focused consumers.
export function buildTemplateOutline(input: OutlineDraftInput): OutlineModel {
  return buildOutline(input);
}
