import type { StructureTemplateKey } from "@/lib/structure-quality/structure-template-definitions";
import { STRUCTURE_TEMPLATE_KEYS } from "@/lib/structure-quality/structure-template-definitions";

const AUTH_CATEGORY_HINTS = ["auth", "easy-auth", "인증", "간편인증", "oauth", "login"];
const AUTH_SOURCE_SIGNAL_TYPES = new Set([
  "CALLBACK_GUIDE",
  "API_SPEC",
  "ERROR_CODE_TABLE",
  "SAMPLE_CODE",
]);

export type StructureTemplateSelectInput = {
  categoryId: string;
  tags: string[];
  sourceTypes: string[];
  explicitTemplateKey?: string | null;
};

export function selectStructureTemplateKey(input: StructureTemplateSelectInput): StructureTemplateKey {
  const explicit = input.explicitTemplateKey?.trim();
  if (explicit === STRUCTURE_TEMPLATE_KEYS.AUTH_INTEGRATION) {
    return STRUCTURE_TEMPLATE_KEYS.AUTH_INTEGRATION;
  }
  if (explicit === STRUCTURE_TEMPLATE_KEYS.GENERIC_PRODUCT) {
    return STRUCTURE_TEMPLATE_KEYS.GENERIC_PRODUCT;
  }

  const haystack = [
    input.categoryId,
    ...input.tags,
  ]
    .join(" ")
    .toLowerCase();

  if (AUTH_CATEGORY_HINTS.some((hint) => haystack.includes(hint.toLowerCase()))) {
    return STRUCTURE_TEMPLATE_KEYS.AUTH_INTEGRATION;
  }

  const authTypeHits = input.sourceTypes.filter((t) => AUTH_SOURCE_SIGNAL_TYPES.has(t)).length;
  if (authTypeHits >= 2) {
    return STRUCTURE_TEMPLATE_KEYS.AUTH_INTEGRATION;
  }

  return STRUCTURE_TEMPLATE_KEYS.GENERIC_PRODUCT;
}
