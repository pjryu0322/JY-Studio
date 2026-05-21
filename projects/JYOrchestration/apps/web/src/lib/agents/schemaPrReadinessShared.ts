/**
 * Shared helpers for read-only schema/migration PR readiness evaluators.
 */

export interface SchemaPrFieldProposal {
  readonly field: string;
  readonly type: string;
  readonly nullable: boolean;
  readonly indexed: boolean;
}

export interface SchemaPrChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export function modelDraftContainsForbiddenFields(
  modelDraft: string,
  forbiddenFields: readonly string[],
): boolean {
  return forbiddenFields.some((field) => new RegExp(`\\b${field}\\b`, "i").test(modelDraft));
}

export function buildSchemaPrModelDraft(
  modelName: string,
  fieldProposals: readonly SchemaPrFieldProposal[],
): string {
  const fieldLines = fieldProposals.map((f) => {
    const optional = f.nullable ? "?" : "";
    return `  ${f.field} ${f.type}${optional}`;
  });

  const indexFields = fieldProposals
    .filter((f) => f.indexed)
    .map((f) => f.field)
    .filter((field) => field !== "recordId");

  const indexLines =
    indexFields.length > 0
      ? indexFields.map((field) => `  @@index([${field}])`).join("\n")
      : "";

  const hasCreatedAt = fieldProposals.some((f) => f.field === "createdAt");

  return [
    `model ${modelName} {`,
    "  id String @id @default(cuid())",
    ...fieldLines,
    ...(hasCreatedAt ? [] : ["  createdAt DateTime @default(now())"]),
    indexLines,
    "}",
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

export function buildSchemaPrStaticChecklist(
  items: readonly string[],
  satisfied: boolean,
  reasonWhenTrue: string,
  reasonWhenFalse: string,
): SchemaPrChecklistItem[] {
  return items.map((item) => ({
    item,
    satisfied,
    reason: satisfied ? reasonWhenTrue : reasonWhenFalse,
  }));
}

export function buildSchemaPrForbiddenFieldChecklist(
  excludedFields: readonly { readonly field: string }[],
  requiredForbiddenFields: readonly string[],
): SchemaPrChecklistItem[] {
  const excluded = new Set(excludedFields.map((f) => f.field));

  return requiredForbiddenFields.map((field) => ({
    item: field,
    satisfied: excluded.has(field),
    reason: excluded.has(field)
      ? `${field} is excluded from schema proposal`
      : `${field} is missing from excluded fields policy`,
  }));
}
