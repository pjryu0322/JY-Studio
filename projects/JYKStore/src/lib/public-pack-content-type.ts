export type PublicPackContentType =
  | "DOCUMENT"
  | "PRODUCT"
  | "API"
  | "FRAMEWORK"
  | "DATA"
  | "MIXED";

export type PublicPackContentTypeInput = {
  /** Explicit metadata when available. */
  explicitContentType?: PublicPackContentType | null;
  categoryName?: string | null;
  categoryId?: string | null;
  tags?: string[];
  features?: string[];
  supportedEnvironments?: string[];
  useCases?: string[];
  downloadReady?: boolean;
  apiReady?: boolean;
  hasDocumentSource?: boolean;
};

function mentionsDocument(text: string): boolean {
  return /문서|가이드|매뉴얼|규정|고시|지침|handbook|guide|manual|document|pdf|docx/i.test(
    text,
  );
}

function mentionsProduct(text: string): boolean {
  return /제품|솔루션|프레임워크|sdk|library|component|ui\b/i.test(text);
}

function mentionsApi(text: string): boolean {
  return /\bapi\b|openapi|endpoint|oauth/i.test(text);
}

/**
 * Infer public content type without generator-tool branching.
 * Returns null when the type is not clear enough to show a badge.
 */
export function resolvePublicPackContentType(
  input: PublicPackContentTypeInput,
): PublicPackContentType | null {
  if (input.explicitContentType) return input.explicitContentType;

  const category = `${input.categoryName ?? ""} ${input.categoryId ?? ""}`.trim();
  const tags = (input.tags ?? []).join(" ");
  const corpus = `${category} ${tags}`.toLowerCase();

  const hasFeatures = (input.features?.length ?? 0) > 0;
  const hasEnvironments = (input.supportedEnvironments?.length ?? 0) > 0;
  const hasUseCases = (input.useCases?.length ?? 0) > 0;
  const productSignalCount = [hasFeatures, hasEnvironments, hasUseCases].filter(Boolean).length;
  const productTagged = mentionsProduct(corpus);

  const documentPriority =
    Boolean(input.hasDocumentSource) &&
    Boolean(input.downloadReady) &&
    !input.apiReady &&
    !hasEnvironments &&
    !hasUseCases;

  if (documentPriority) {
    return "DOCUMENT";
  }

  const documentLikely =
    input.hasDocumentSource ||
    mentionsDocument(corpus) ||
    (Boolean(input.downloadReady) && productSignalCount === 0 && !productTagged);

  const productLikely = productSignalCount >= 2 || productTagged || (hasEnvironments && hasUseCases);
  const apiLikely = Boolean(input.apiReady) && (mentionsApi(corpus) || productTagged);

  if (documentLikely && productLikely) return "MIXED";
  if (documentLikely && !productLikely) return "DOCUMENT";
  if (apiLikely) return "API";
  if (productLikely && /framework|프레임워크/i.test(corpus)) return "FRAMEWORK";
  if (productLikely) return "PRODUCT";
  if (input.downloadReady) return "DOCUMENT";
  return null;
}

export function publicPackContentTypeLabel(
  contentType: PublicPackContentType | null | undefined,
): string | null {
  switch (contentType) {
    case "DOCUMENT":
      return "문서형";
    case "PRODUCT":
      return "제품형";
    case "API":
      return "API형";
    case "FRAMEWORK":
      return "프레임워크형";
    case "DATA":
      return "데이터형";
    case "MIXED":
      return "혼합형";
    default:
      return null;
  }
}
