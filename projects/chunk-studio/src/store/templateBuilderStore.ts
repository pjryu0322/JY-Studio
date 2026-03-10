"use client";

import { create } from "zustand";
import { nanoid } from "nanoid";

export interface BBoxSelection {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface BuilderState {
  pendingSelection: BBoxSelection | null;
  selections: BBoxSelection[];
  sections: Array<{
    id: string;
    title: string;
    level: number;
    required: boolean;
    parentId?: string;
    orderHint?: number;
    bboxHint?: BBoxSelection;
  }>;
  fields: Array<{
    key: string;
    label: string;
    required: boolean;
    sectionId?: string;
    bboxHint?: BBoxSelection;
  }>;
  tables: Array<{
    id: string;
    name: string;
    headerLabels: string[];
    required: boolean;
    sectionId?: string;
    bboxHint?: BBoxSelection;
  }>;
  anchors: Array<{ type: "text" | "regex"; value: string; weight: number }>;
  repeatBlocks: Array<{
    id: string;
    name: string;
    pattern: string;
    sectionId?: string;
    min?: number;
    max?: number;
    bboxHint?: BBoxSelection;
  }>;
  addSelection: (bbox: BBoxSelection) => void;
  setPendingSelection: (bbox: BBoxSelection | null) => void;
  clearPendingSelection: () => void;
  clearSelections: () => void;
  addSection: (section: BuilderState["sections"][number]) => void;
  moveSection: (from: number, to: number) => void;
  addField: (field: BuilderState["fields"][number]) => void;
  addTable: (table: BuilderState["tables"][number]) => void;
  updateSection: (id: string, patch: Partial<BuilderState["sections"][number]>) => void;
  deleteSection: (id: string) => void;
  updateField: (key: string, patch: Partial<BuilderState["fields"][number]>) => void;
  deleteField: (key: string) => void;
  updateTable: (id: string, patch: Partial<BuilderState["tables"][number]>) => void;
  deleteTable: (id: string) => void;
  updateRepeatBlock: (
    id: string,
    patch: Partial<BuilderState["repeatBlocks"][number]>
  ) => void;
  deleteRepeatBlock: (id: string) => void;
  addByType: (input: {
    type: "section" | "field" | "table" | "repeat" | "signature" | "date";
    name: string;
    bbox: BBoxSelection;
    sectionId?: string;
  }) => void;
  addChildByType: (input: {
    sectionId: string;
    type: "field" | "table" | "repeat" | "signature" | "date";
    name: string;
  }) => void;
  addAnchor: (anchor: BuilderState["anchors"][number]) => void;
  addRepeatBlock: (block: BuilderState["repeatBlocks"][number]) => void;
  applyDraftTemplate: (draft: {
    sections: Array<{
      title: string;
      level: number;
      required?: boolean;
      parentId?: string;
      orderHint?: number;
      bboxHint?: BBoxSelection;
    }>;
    fields: Array<{
      label: string;
      key?: string;
      required?: boolean;
      sectionId?: string;
      bboxHint?: BBoxSelection;
    }>;
    tables: Array<{
      name?: string;
      headerLabels?: string[];
      required?: boolean;
      sectionId?: string;
      bboxHint?: BBoxSelection;
    }>;
  }) => void;
  applyTemplateSchema: (schema: {
    sections: Array<{
      id: string;
      title: string;
      level: number;
      required: boolean;
      parentId?: string;
      orderHint?: number;
      bboxHint?: BBoxSelection;
    }>;
    fields: Array<{
      key: string;
      label: string;
      required: boolean;
      sectionId?: string;
      bboxHint?: BBoxSelection;
    }>;
    tables: Array<{
      id: string;
      headerLabels: string[];
      required: boolean;
      sectionId?: string;
      bboxHint?: BBoxSelection;
    }>;
    anchors: Array<{ type: "text" | "regex"; value: string; weight: number }>;
    repeatBlocks: Array<{
      id: string;
      pattern: string;
      sectionId?: string;
      min?: number;
      max?: number;
      bboxHint?: BBoxSelection;
    }>;
  }) => void;
  resetAll: () => void;
}

export const useTemplateBuilderStore = create<BuilderState>((set) => ({
  pendingSelection: null,
  selections: [],
  sections: [],
  fields: [],
  tables: [],
  anchors: [],
  repeatBlocks: [],
  addSelection: (bbox) => set((s) => ({ selections: [...s.selections, bbox] })),
  setPendingSelection: (bbox) => set({ pendingSelection: bbox }),
  clearPendingSelection: () => set({ pendingSelection: null }),
  clearSelections: () => set({ selections: [] }),
  addSection: (section) =>
    set((s) => ({
      sections: [...s.sections, { ...section, orderHint: s.sections.length + 1 }],
    })),
  moveSection: (from, to) =>
    set((s) => {
      const next = [...s.sections];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return {
        sections: next.map((section, idx) => ({ ...section, orderHint: idx + 1 })),
      };
    }),
  addField: (field) => set((s) => ({ fields: [...s.fields, field] })),
  addTable: (table) => set((s) => ({ tables: [...s.tables, table] })),
  updateSection: (id, patch) =>
    set((s) => {
      let nextParentId = patch.parentId;
      if (nextParentId === id) {
        nextParentId = undefined;
      }
      if (nextParentId) {
        const sectionMap = new Map(s.sections.map((section) => [section.id, section]));
        let cursor = sectionMap.get(nextParentId);
        const guard = new Set<string>();
        while (cursor && cursor.parentId && !guard.has(cursor.parentId)) {
          if (cursor.parentId === id) {
            nextParentId = undefined;
            break;
          }
          guard.add(cursor.parentId);
          cursor = sectionMap.get(cursor.parentId);
        }
      }
      return {
        sections: s.sections.map((section) =>
          section.id === id
            ? {
                ...section,
                ...patch,
                parentId: nextParentId,
              }
            : section
        ),
      };
    }),
  deleteSection: (id) =>
    set((s) => {
      const idSet = new Set<string>([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const section of s.sections) {
          if (section.parentId && idSet.has(section.parentId) && !idSet.has(section.id)) {
            idSet.add(section.id);
            changed = true;
          }
        }
      }
      const sections = s.sections
        .filter((section) => !idSet.has(section.id))
        .map((section, idx) => ({ ...section, orderHint: idx + 1 }));
      return {
        sections,
        fields: s.fields.filter((field) => !field.sectionId || !idSet.has(field.sectionId)),
        tables: s.tables.filter((table) => !table.sectionId || !idSet.has(table.sectionId)),
        repeatBlocks: s.repeatBlocks.filter(
          (block) => !block.sectionId || !idSet.has(block.sectionId)
        ),
      };
    }),
  updateField: (key, patch) =>
    set((s) => ({
      fields: s.fields.map((field) => (field.key === key ? { ...field, ...patch } : field)),
    })),
  deleteField: (key) => set((s) => ({ fields: s.fields.filter((field) => field.key !== key) })),
  updateTable: (id, patch) =>
    set((s) => ({
      tables: s.tables.map((table) => (table.id === id ? { ...table, ...patch } : table)),
    })),
  deleteTable: (id) => set((s) => ({ tables: s.tables.filter((table) => table.id !== id) })),
  updateRepeatBlock: (id, patch) =>
    set((s) => ({
      repeatBlocks: s.repeatBlocks.map((block) =>
        block.id === id ? { ...block, ...patch } : block
      ),
    })),
  deleteRepeatBlock: (id) =>
    set((s) => ({ repeatBlocks: s.repeatBlocks.filter((block) => block.id !== id) })),
  addByType: ({ type, name, bbox, sectionId }) =>
    set((s) => {
      const selections = [...s.selections, bbox];
      const activeSectionId = sectionId;
      if (type === "section") {
        return {
          selections,
          sections: [
            ...s.sections,
            {
              id: `section_${nanoid(6)}`,
              title: name,
              level: activeSectionId
                ? Math.min(
                    6,
                    Math.max(1, (s.sections.find((section) => section.id === activeSectionId)?.level ?? 1) + 1)
                  )
                : 1,
              required: true,
              parentId: activeSectionId,
              orderHint: s.sections.length + 1,
              bboxHint: bbox,
            },
          ],
        };
      }
      if (type === "table") {
        return {
          selections,
          tables: [
            ...s.tables,
            {
              id: `tbl_${nanoid(6)}`,
              name,
              headerLabels: ["항목", "값"],
              required: false,
              sectionId: activeSectionId,
              bboxHint: bbox,
            },
          ],
        };
      }
      if (type === "repeat") {
        return {
          selections,
          repeatBlocks: [
            ...s.repeatBlocks,
            {
              id: `rep_${nanoid(6)}`,
              name,
              pattern: "^\\d\\)\\s",
              sectionId: activeSectionId,
              min: 0,
              max: 100,
              bboxHint: bbox,
            },
          ],
        };
      }
      const keyBase =
        type === "signature" ? "signature" : type === "date" ? "date" : "field";
      return {
        selections,
        fields: [
          ...s.fields,
          {
            key: `${keyBase}_${s.fields.length + 1}`,
            label: name,
            required: false,
            sectionId: activeSectionId,
            bboxHint: bbox,
          },
        ],
      };
    }),
  addChildByType: ({ sectionId, type, name }) =>
    set((s) => {
      const section = s.sections.find((item) => item.id === sectionId);
      if (!section) return s;
      if (type === "table") {
        return {
          tables: [
            ...s.tables,
            {
              id: `tbl_${nanoid(6)}`,
              name,
              headerLabels: ["항목", "값"],
              required: false,
              sectionId,
            },
          ],
        };
      }
      if (type === "repeat") {
        return {
          repeatBlocks: [
            ...s.repeatBlocks,
            {
              id: `rep_${nanoid(6)}`,
              name,
              pattern: "^\\d\\)\\s",
              sectionId,
              min: 0,
              max: 100,
            },
          ],
        };
      }
      const keyBase =
        type === "signature" ? "signature" : type === "date" ? "date" : "field";
      return {
        fields: [
          ...s.fields,
          {
            key: `${keyBase}_${s.fields.length + 1}`,
            label: name,
            required: false,
            sectionId,
          },
        ],
      };
    }),
  addAnchor: (anchor) => set((s) => ({ anchors: [...s.anchors, anchor] })),
  addRepeatBlock: (block) => set((s) => ({ repeatBlocks: [...s.repeatBlocks, block] })),
  applyDraftTemplate: (draft) =>
    set(() => {
      const sectionIdMap = new Map<string, string>();
      const sections = draft.sections.map((section, idx) => {
        const id = `section_${nanoid(6)}`;
        const sourceKey = section.orderHint ? `order-${section.orderHint}` : `idx-${idx}`;
        sectionIdMap.set(sourceKey, id);
        return {
          id,
          title: section.title,
          level: Math.max(1, Math.min(6, section.level || 1)),
          required: section.required ?? true,
          parentId: undefined as string | undefined,
          orderHint: idx + 1,
          bboxHint: section.bboxHint,
        };
      });

      const resolveSectionId = (value?: string): string | undefined => {
        if (!value) return undefined;
        const byIndex = Number(value.replace(/^sec_/, ""));
        if (Number.isFinite(byIndex) && byIndex > 0) {
          return sections[byIndex - 1]?.id;
        }
        return sections.find((s) => s.id === value)?.id;
      };

      const fields = draft.fields.map((field, idx) => ({
        key: field.key || `field_${idx + 1}`,
        label: field.label,
        required: field.required ?? false,
        sectionId: resolveSectionId(field.sectionId),
        bboxHint: field.bboxHint,
      }));

      const tables = draft.tables.map((table, idx) => ({
        id: `tbl_${nanoid(6)}`,
        name: table.name || `표 ${idx + 1}`,
        headerLabels: table.headerLabels ?? ["항목", "값"],
        required: table.required ?? false,
        sectionId: resolveSectionId(table.sectionId),
        bboxHint: table.bboxHint,
      }));

      return {
        sections,
        fields,
        tables,
      };
    }),
  applyTemplateSchema: (schema) =>
    set(() => {
      const sectionIdMap = new Map<string, string>();
      const sortedSections = [...schema.sections].sort(
        (a, b) => (a.orderHint ?? 9999) - (b.orderHint ?? 9999)
      );
      const sections = sortedSections.map((section, idx) => {
        const nextId = `section_${nanoid(6)}`;
        sectionIdMap.set(section.id, nextId);
        return {
          id: nextId,
          title: section.title,
          level: Math.max(1, Math.min(6, section.level || 1)),
          required: section.required ?? true,
          parentId: undefined as string | undefined,
          orderHint: idx + 1,
          bboxHint: section.bboxHint,
        };
      });
      sections.forEach((section, idx) => {
        const sourceParentId = sortedSections[idx]?.parentId;
        section.parentId = sourceParentId ? sectionIdMap.get(sourceParentId) : undefined;
      });

      const fields = schema.fields.map((field, idx) => ({
        key: field.key || `field_${idx + 1}`,
        label: field.label,
        required: field.required ?? false,
        sectionId: field.sectionId ? sectionIdMap.get(field.sectionId) : undefined,
        bboxHint: field.bboxHint,
      }));

      const tables = schema.tables.map((table, idx) => ({
        id: `tbl_${nanoid(6)}`,
        name: `표 ${idx + 1}`,
        headerLabels: table.headerLabels ?? ["항목", "값"],
        required: table.required ?? false,
        sectionId: table.sectionId ? sectionIdMap.get(table.sectionId) : undefined,
        bboxHint: table.bboxHint,
      }));

      const repeatBlocks = schema.repeatBlocks.map((repeat, idx) => ({
        id: `rep_${nanoid(6)}`,
        name: `반복 ${idx + 1}`,
        pattern: repeat.pattern,
        sectionId: repeat.sectionId ? sectionIdMap.get(repeat.sectionId) : undefined,
        min: repeat.min,
        max: repeat.max,
        bboxHint: repeat.bboxHint,
      }));

      return {
        sections,
        fields,
        tables,
        anchors: schema.anchors,
        repeatBlocks,
      };
    }),
  resetAll: () =>
    set({
      pendingSelection: null,
      selections: [],
      sections: [],
      fields: [],
      tables: [],
      anchors: [],
      repeatBlocks: [],
    }),
}));

