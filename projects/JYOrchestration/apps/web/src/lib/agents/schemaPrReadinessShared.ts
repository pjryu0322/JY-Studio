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

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export type SchemaPrApprovalDecision =
  | "ready_for_explicit_schema_pr_approval"
  | "defer"
  | "blocked";

export function modelDraftContainsForbiddenFields(
  modelDraft: string,
  forbiddenFields: readonly string[],
): boolean {
  return forbiddenFields.some((field) => new RegExp(`\\b${field}\\b`, "i").test(modelDraft));
}

export function detectForbiddenModelDraftInCandidates(input: {
  readonly modelCandidates: readonly { readonly modelDraft: string }[];
  readonly forbiddenFieldNames: readonly string[];
}): boolean {
  return input.modelCandidates.some((candidate) =>
    modelDraftContainsForbiddenFields(candidate.modelDraft, input.forbiddenFieldNames),
  );
}

export function resolveSchemaPrApprovalDecision(input: {
  readonly readinessDecision: string;
  readonly explicitUserApproval: boolean;
  readonly forbiddenDraftDetected: boolean;
}): SchemaPrApprovalDecision {
  if (input.forbiddenDraftDetected) {
    return "blocked";
  }

  switch (input.readinessDecision) {
    case "ready_for_schema_pr_plan":
      return input.explicitUserApproval ? "ready_for_explicit_schema_pr_approval" : "defer";
    case "defer":
      return "defer";
    case "blocked":
    default:
      return "blocked";
  }
}

export function modelDraftContainsRequiredFields(
  modelDraft: string,
  requiredFields: readonly string[],
): boolean {
  return requiredFields.every((field) => new RegExp(`\\b${field}\\b`, "i").test(modelDraft));
}

export function buildSchemaPrModelDraft(
  modelName: string,
  fieldProposals: readonly SchemaPrFieldProposal[],
): string {
  if (!modelName.trim()) {
    return "";
  }

  const fieldLines = fieldProposals
    .filter((f) => f.field.trim().length > 0)
    .map((f) => {
      const optional = f.nullable ? "?" : "";
      return `  ${f.field} ${f.type}${optional}`;
    });

  const indexFields = uniqueStrings(
    fieldProposals
      .filter((f) => f.indexed)
      .map((f) => f.field)
      .filter((field) => field.trim().length > 0 && field !== "recordId"),
  );

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
