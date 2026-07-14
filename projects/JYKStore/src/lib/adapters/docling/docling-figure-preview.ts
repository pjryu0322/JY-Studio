import { createHash } from "node:crypto";

export type ParsedDataUriImage = {
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  bytes: Uint8Array;
  sha256: string;
  width: number | null;
  height: number | null;
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

function magicMime(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: dv.getUint32(16), height: dv.getUint32(20) };
}

export function parseDataUriImage(uri: string): ParsedDataUriImage | { error: string } {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(uri.trim());
  if (!m) return { error: "not_data_uri" };
  const declared = m[1]!.toLowerCase();
  if (!ALLOWED.has(declared)) return { error: "mime_not_allowed" };
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(Buffer.from(m[2]!.replace(/\s+/g, ""), "base64"));
  } catch {
    return { error: "base64_decode_failed" };
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
    return { error: "size_limit" };
  }
  const magic = magicMime(bytes);
  if (!magic) return { error: "magic_mismatch" };
  if (magic !== declared && !(declared === "image/jpg" && magic === "image/jpeg")) {
    // Strict: declared must match magic (jpeg alias tolerated above)
    if (!(declared === "image/jpeg" && magic === "image/jpeg")) {
      return { error: "mime_magic_mismatch" };
    }
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const size = magic === "image/png" ? pngSize(bytes) : null;
  return {
    mimeType: magic,
    bytes,
    sha256,
    width: size?.width ?? null,
    height: size?.height ?? null,
  };
}

export function extractImageUriFromPicture(picture: Record<string, unknown>): string | null {
  const image = picture.image;
  if (typeof image === "string" && image.startsWith("data:image/")) return image;
  if (image && typeof image === "object" && !Array.isArray(image)) {
    const obj = image as Record<string, unknown>;
    if (typeof obj.uri === "string" && obj.uri.startsWith("data:image/")) return obj.uri;
    if (typeof obj.data_uri === "string" && obj.data_uri.startsWith("data:image/")) {
      return obj.data_uri;
    }
  }
  if (typeof picture.uri === "string" && picture.uri.startsWith("data:image/")) return picture.uri;
  return null;
}

export type FigureClassification =
  | "CONTENT_FIGURE"
  | "COVER_IMAGE"
  | "LOGO"
  | "DECORATIVE"
  | "PAGE_RENDER"
  | "UNKNOWN";

export type FigureClassificationResult = {
  classification: FigureClassification;
  confidence: number;
  reasons: string[];
};

export function classifyFigure(input: {
  pageNumber: number | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  sha256: string | null;
  duplicateCount: number;
  pictureIndex: number;
}): FigureClassificationResult {
  const reasons: string[] = [];
  const caption = (input.caption ?? "").trim();
  const w = typeof input.width === "number" && Number.isFinite(input.width) ? input.width : 0;
  const h =
    typeof input.height === "number" && Number.isFinite(input.height) ? input.height : 0;
  const hasValidSize = w > 0 && h > 0;
  const area = hasValidSize ? w * h : 0;
  const ratio = hasValidSize ? w / h : null;

  // 1. Repeated SHA (logo watermark across pages)
  if (input.duplicateCount >= 2) {
    reasons.push("repeated_hash");
    return { classification: "LOGO", confidence: 0.7, reasons };
  }

  // 2. Explicit caption → content figure
  if (caption) {
    reasons.push("has_caption");
    return { classification: "CONTENT_FIGURE", confidence: 0.75, reasons };
  }

  // 3. Cover candidate (page 1, large, uncaptioned)
  if ((input.pageNumber ?? 99) <= 1 && !caption && hasValidSize && area > 400_000) {
    reasons.push("early_page_large_uncaptioned");
    return { classification: "COVER_IMAGE", confidence: 0.65, reasons };
  }

  // 4–5. Tiny / extreme aspect — only when dimensions are known
  if (hasValidSize && (w <= 96 || h <= 96 || area < 8_000)) {
    reasons.push("tiny_image");
    return { classification: "LOGO", confidence: 0.6, reasons };
  }
  if (hasValidSize && ratio != null && (ratio > 4 || ratio < 0.2)) {
    reasons.push("extreme_aspect");
    return { classification: "DECORATIVE", confidence: 0.55, reasons };
  }

  // 6. Mid-document medium/large diagram without caption
  if (
    input.pageNumber != null &&
    input.pageNumber >= 2 &&
    hasValidSize &&
    area >= 20_000
  ) {
    reasons.push("mid_doc_medium_size");
    return { classification: "CONTENT_FIGURE", confidence: 0.55, reasons };
  }

  // 7–8. Insufficient signals — never treat unknown size as DECORATIVE
  if (!hasValidSize) {
    return {
      classification: "UNKNOWN",
      confidence: 0.35,
      reasons: ["insufficient_metadata"],
    };
  }
  return { classification: "UNKNOWN", confidence: 0.35, reasons: ["low_signal"] };
}

/** Recompute duplicate SHA counts and classify every figure with final metadata. */
export function classifyFigures<
  T extends {
    caption?: string | null;
    page?: number | null;
    pageNumber?: number | null;
    width?: number | null;
    height?: number | null;
    _previewSha256?: string | null;
    classification?: string;
    classificationConfidence?: number;
    classificationReasons?: string[];
  },
>(figures: T[]): T[] {
  const hashCounts = new Map<string, number>();
  for (const fig of figures) {
    const sha = fig._previewSha256?.trim();
    if (!sha) continue;
    hashCounts.set(sha, (hashCounts.get(sha) ?? 0) + 1);
  }

  return figures.map((fig, pictureIndex) => {
    const sha = fig._previewSha256?.trim() || null;
    const dup = sha ? (hashCounts.get(sha) ?? 1) : 1;
    const classified = classifyFigure({
      pageNumber: fig.pageNumber ?? fig.page ?? null,
      caption: fig.caption ?? null,
      width: fig.width ?? null,
      height: fig.height ?? null,
      sha256: sha,
      duplicateCount: dup,
      pictureIndex,
    });
    return {
      ...fig,
      classification: classified.classification,
      classificationConfidence: classified.confidence,
      classificationReasons: classified.reasons,
    };
  });
}

export function buildFigurePreviewObjectKey(input: {
  prefix: string;
  packId: string;
  versionId: string;
  bundleId: string;
  sha256: string;
  extension: string;
}): string {
  const safe = /^[a-zA-Z0-9_-]+$/;
  if (!safe.test(input.packId) || !safe.test(input.versionId) || !safe.test(input.bundleId)) {
    throw new Error("Invalid id for figure preview object key");
  }
  if (!/^[a-f0-9]{64}$/i.test(input.sha256)) {
    throw new Error("Invalid sha256 for figure preview object key");
  }
  const prefix = (input.prefix || "payloads").replace(/^\/+|\/+$/g, "");
  const ext = input.extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  return `${prefix}/pack-files/${input.packId}/${input.versionId}/${input.bundleId}/FIGURE_PREVIEW/${input.sha256}.${ext}`;
}

export function collectFigurePreviewObjectKeys(
  figures: Array<{ previewObjectKey?: string | null }>,
): string[] {
  const keys = new Set<string>();
  for (const fig of figures) {
    if (fig.previewObjectKey?.trim()) keys.add(fig.previewObjectKey.trim());
  }
  return [...keys];
}

export {
  figureRefToRouteParam,
  routeParamToFigureRef,
} from "./docling-figure-ids";
