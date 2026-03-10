import type { TemplateSchema } from "@/lib/template/schema";

export interface FieldDiffItem {
  key: string;
  label: string;
  oldValue: string;
  newValue: string;
  changeType: "added" | "removed" | "modified" | "unchanged";
}

function normalizeValue(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function readValueByLabel(text: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`${escaped}\\s*[:：]\\s*([^\\n]+)`, "i"),
    new RegExp(`${escaped}\\s+([^\\n]{1,80})`, "i"),
  ];
  for (const pattern of patterns) {
    const matched = text.match(pattern);
    if (matched?.[1]) return normalizeValue(matched[1]);
  }
  return "";
}

export function diffFields(
  docA: string,
  docB: string,
  template: TemplateSchema
): FieldDiffItem[] {
  return template.fields.map((field) => {
    const oldValue = readValueByLabel(docA, field.label);
    const newValue = readValueByLabel(docB, field.label);
    const changeType =
      oldValue && !newValue
        ? "removed"
        : !oldValue && newValue
          ? "added"
          : oldValue !== newValue
            ? "modified"
            : "unchanged";
    return {
      key: field.key,
      label: field.label,
      oldValue,
      newValue,
      changeType,
    };
  });
}
