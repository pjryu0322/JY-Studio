import type { TemplateSchema } from "@/lib/template/schema";
import { diffFields, type FieldDiffItem } from "./fieldDiff";
import { diffSections, type SectionDiffItem } from "./sectionDiff";
import { diffTables, type TableDiffItem } from "./tableDiff";

export interface RepeatDiffItem {
  pattern: string;
  added: string[];
  removed: string[];
}

function collectRepeatItems(text: string, pattern: string): string[] {
  try {
    const rx = new RegExp(pattern, "gm");
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && rx.test(line));
  } catch {
    return [];
  }
}

function diffRepeats(
  docA: string,
  docB: string,
  template: TemplateSchema
): RepeatDiffItem[] {
  return template.repeatBlocks.map((block) => {
    const oldItems = collectRepeatItems(docA, block.pattern);
    const newItems = collectRepeatItems(docB, block.pattern);
    const oldSet = new Set(oldItems);
    const newSet = new Set(newItems);
    return {
      pattern: block.pattern,
      added: newItems.filter((item) => !oldSet.has(item)),
      removed: oldItems.filter((item) => !newSet.has(item)),
    };
  });
}

export interface TemplateDiffResult {
  fieldsChanged: FieldDiffItem[];
  sectionsChanged: SectionDiffItem[];
  tablesChanged: TableDiffItem[];
  repeatChanged: RepeatDiffItem[];
}

export function runTemplateDiff(input: {
  docA: string;
  docB: string;
  template: TemplateSchema;
}): TemplateDiffResult {
  return {
    fieldsChanged: diffFields(input.docA, input.docB, input.template).filter(
      (item) => item.changeType !== "unchanged"
    ),
    sectionsChanged: diffSections(input.docA, input.docB, input.template),
    tablesChanged: diffTables(input.docA, input.docB, input.template).filter(
      (item) =>
        item.addedRows.length > 0 ||
        item.removedRows.length > 0 ||
        item.modifiedRows.length > 0
    ),
    repeatChanged: diffRepeats(input.docA, input.docB, input.template).filter(
      (item) => item.added.length > 0 || item.removed.length > 0
    ),
  };
}
