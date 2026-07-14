import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { detectFileSignature, type FileSignatureDetection } from "@/lib/docling-import/file-signature-detector";

/** Above this size, source signature uses head sample only (not full buffer). */
export const SOURCE_SIGNATURE_FULL_BUFFER_MAX_BYTES = 8 * 1024 * 1024;

const HEAD_SAMPLE_BYTES = 64 * 1024;
const TAIL_SAMPLE_BYTES = 64 * 1024;

export type StreamHashAndHeadResult = {
  checksumSha256: string;
  head: Uint8Array;
  bytesRead: number;
};

/**
 * Hash a readable stream while retaining only the first `headBytes` for signature checks.
 * Does not buffer the entire object.
 */
export async function sha256HexAndHeadFromStream(
  readable: Readable,
  headBytes: number = HEAD_SAMPLE_BYTES,
): Promise<StreamHashAndHeadResult> {
  const hash = createHash("sha256");
  const headChunks: Buffer[] = [];
  let headLen = 0;
  let bytesRead = 0;

  for await (const chunk of readable) {
    const buf = Buffer.isBuffer(chunk)
      ? chunk
      : typeof chunk === "string"
        ? Buffer.from(chunk)
        : Buffer.from(chunk as Uint8Array);
    hash.update(buf);
    bytesRead += buf.byteLength;
    if (headLen < headBytes) {
      const need = headBytes - headLen;
      if (buf.byteLength <= need) {
        headChunks.push(buf);
        headLen += buf.byteLength;
      } else {
        headChunks.push(buf.subarray(0, need));
        headLen = headBytes;
      }
    }
  }

  return {
    checksumSha256: hash.digest("hex"),
    head: Buffer.concat(headChunks, headLen),
    bytesRead,
  };
}

export type StreamHeadTailResult = {
  head: Uint8Array;
  tail: Uint8Array;
  bytesRead: number;
  checksumSha256: string;
};

/**
 * Stream over an object, computing SHA-256 and keeping head + rolling tail samples.
 * Suitable for light magic-byte checks without loading the full file.
 */
export async function sha256HexAndHeadTailFromStream(
  readable: Readable,
  options?: { headBytes?: number; tailBytes?: number },
): Promise<StreamHeadTailResult> {
  const headBytes = options?.headBytes ?? HEAD_SAMPLE_BYTES;
  const tailBytes = options?.tailBytes ?? TAIL_SAMPLE_BYTES;
  const hash = createHash("sha256");
  const headChunks: Buffer[] = [];
  let headLen = 0;
  const tailRing: Buffer[] = [];
  let tailLen = 0;
  let bytesRead = 0;

  for await (const chunk of readable) {
    const buf = Buffer.isBuffer(chunk)
      ? chunk
      : typeof chunk === "string"
        ? Buffer.from(chunk)
        : Buffer.from(chunk as Uint8Array);
    hash.update(buf);
    bytesRead += buf.byteLength;

    if (headLen < headBytes) {
      const need = headBytes - headLen;
      if (buf.byteLength <= need) {
        headChunks.push(buf);
        headLen += buf.byteLength;
      } else {
        headChunks.push(buf.subarray(0, need));
        headLen = headBytes;
      }
    }

    // Rolling tail window
    tailRing.push(buf);
    tailLen += buf.byteLength;
    while (tailRing.length > 1 && tailLen - (tailRing[0]?.byteLength ?? 0) >= tailBytes) {
      const dropped = tailRing.shift();
      if (dropped) tailLen -= dropped.byteLength;
    }
  }

  let tail = Buffer.concat(tailRing, tailLen);
  if (tail.byteLength > tailBytes) {
    tail = tail.subarray(tail.byteLength - tailBytes);
  }

  return {
    head: Buffer.concat(headChunks, headLen),
    tail,
    bytesRead,
    checksumSha256: hash.digest("hex"),
  };
}

export type StreamMarkdownPreviewResult = {
  checksumSha256: string;
  textPreview: string;
  bytesRead: number;
  empty: boolean;
  truncated: boolean;
  encodingOk: boolean;
};

/**
 * Stream-decode markdown with size limits: hash everything, keep only a UTF-8 preview.
 */
export async function streamMarkdownPreviewFromReadable(
  readable: Readable,
  options: {
    maxBytes: number;
    previewBytes: number;
  },
): Promise<StreamMarkdownPreviewResult> {
  const hash = createHash("sha256");
  const previewChunks: Buffer[] = [];
  let previewLen = 0;
  let bytesRead = 0;
  let sawNonWhitespace = false;

  for await (const chunk of readable) {
    const buf = Buffer.isBuffer(chunk)
      ? chunk
      : typeof chunk === "string"
        ? Buffer.from(chunk)
        : Buffer.from(chunk as Uint8Array);
    hash.update(buf);
    bytesRead += buf.byteLength;
    if (bytesRead > options.maxBytes) {
      // Drain remaining for accurate failure? Fail fast — caller treats as too large.
      try {
        readable.destroy();
      } catch {
        /* ignore */
      }
      break;
    }
    if (!sawNonWhitespace) {
      for (let i = 0; i < buf.byteLength; i++) {
        const b = buf[i]!;
        if (b !== 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d) {
          sawNonWhitespace = true;
          break;
        }
      }
    }
    if (previewLen < options.previewBytes) {
      const need = options.previewBytes - previewLen;
      if (buf.byteLength <= need) {
        previewChunks.push(buf);
        previewLen += buf.byteLength;
      } else {
        previewChunks.push(buf.subarray(0, need));
        previewLen = options.previewBytes;
      }
    }
  }

  const previewBuf = Buffer.concat(previewChunks, previewLen);
  let encodingOk = true;
  let textPreview = "";
  try {
    textPreview = new TextDecoder("utf-8", { fatal: true }).decode(previewBuf);
  } catch {
    encodingOk = false;
    textPreview = new TextDecoder("utf-8", { fatal: false }).decode(previewBuf);
  }

  return {
    checksumSha256: hash.digest("hex"),
    textPreview,
    bytesRead,
    empty: !sawNonWhitespace,
    truncated: bytesRead > previewLen,
    encodingOk,
  };
}

export type MarkdownTripleSamples = {
  start: string;
  middle: string;
  end: string;
};

export type StreamMarkdownTripleSamplesResult = {
  checksumSha256: string;
  encodingOk: boolean;
  samples: MarkdownTripleSamples;
  bytesRead: number;
  empty: boolean;
};

function decodeUtf8Sample(buf: Buffer): { text: string; ok: boolean } {
  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(buf),
      ok: true,
    };
  } catch {
    return {
      text: new TextDecoder("utf-8", { fatal: false }).decode(buf),
      ok: false,
    };
  }
}

/**
 * Single-pass markdown sample: start buffer + mid capture near halfway + tail ring.
 * Does not buffer the entire object.
 */
export async function streamMarkdownTripleSamples(
  readable: Readable,
  options: {
    contentLength?: number;
    sampleBytes: number;
    maxBytes: number;
  },
): Promise<StreamMarkdownTripleSamplesResult> {
  const sampleBytes = Math.max(1, options.sampleBytes);
  const hash = createHash("sha256");
  const startChunks: Buffer[] = [];
  let startLen = 0;
  const tailRing: Buffer[] = [];
  let tailLen = 0;
  const middleChunks: Buffer[] = [];
  let middleLen = 0;
  let middleCapturing = false;
  let bytesRead = 0;
  let sawNonWhitespace = false;
  let encodingOk = true;

  const knownLen =
    typeof options.contentLength === "number" &&
    Number.isFinite(options.contentLength) &&
    options.contentLength > 0
      ? options.contentLength
      : null;
  const midTarget = knownLen != null ? Math.floor(knownLen / 2) : null;

  for await (const chunk of readable) {
    const buf = Buffer.isBuffer(chunk)
      ? chunk
      : typeof chunk === "string"
        ? Buffer.from(chunk)
        : Buffer.from(chunk as Uint8Array);
    hash.update(buf);
    bytesRead += buf.byteLength;

    if (bytesRead > options.maxBytes) {
      try {
        readable.destroy();
      } catch {
        /* ignore */
      }
      break;
    }

    if (!sawNonWhitespace) {
      for (let i = 0; i < buf.byteLength; i++) {
        const b = buf[i]!;
        if (b !== 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d) {
          sawNonWhitespace = true;
          break;
        }
      }
    }

    if (startLen < sampleBytes) {
      const need = sampleBytes - startLen;
      if (buf.byteLength <= need) {
        startChunks.push(buf);
        startLen += buf.byteLength;
      } else {
        startChunks.push(buf.subarray(0, need));
        startLen = sampleBytes;
      }
    }

    // Begin middle capture when we cross approximately the midpoint
    if (midTarget != null && !middleCapturing && middleLen === 0) {
      const before = bytesRead - buf.byteLength;
      if (bytesRead >= midTarget) {
        middleCapturing = true;
        const offsetInBuf = Math.max(0, midTarget - before - Math.floor(sampleBytes / 2));
        const slice = buf.subarray(Math.min(offsetInBuf, buf.byteLength));
        const take = Math.min(sampleBytes, slice.byteLength);
        if (take > 0) {
          middleChunks.push(slice.subarray(0, take));
          middleLen = take;
        }
        if (middleLen >= sampleBytes) middleCapturing = false;
      }
    } else if (middleCapturing && middleLen < sampleBytes) {
      const need = sampleBytes - middleLen;
      if (buf.byteLength <= need) {
        middleChunks.push(buf);
        middleLen += buf.byteLength;
      } else {
        middleChunks.push(buf.subarray(0, need));
        middleLen = sampleBytes;
        middleCapturing = false;
      }
    }

    // Rolling tail
    tailRing.push(buf);
    tailLen += buf.byteLength;
    while (tailRing.length > 1 && tailLen - (tailRing[0]?.byteLength ?? 0) >= sampleBytes) {
      const dropped = tailRing.shift();
      if (dropped) tailLen -= dropped.byteLength;
    }
  }

  // If contentLength was unknown / too short for mid capture, approximate middle from start+tail overlap
  if (middleLen === 0 && bytesRead > 0) {
    const allHead = Buffer.concat(startChunks, startLen);
    if (bytesRead <= sampleBytes * 2) {
      middleChunks.push(allHead);
      middleLen = allHead.byteLength;
    } else {
      // Re-decode from head as fallback when stream was short of mid
      const half = Math.floor(allHead.byteLength / 2);
      const midFallback = allHead.subarray(half);
      middleChunks.push(midFallback);
      middleLen = midFallback.byteLength;
    }
  }

  let tail = Buffer.concat(tailRing, tailLen);
  if (tail.byteLength > sampleBytes) {
    tail = tail.subarray(tail.byteLength - sampleBytes);
  }

  const startDecoded = decodeUtf8Sample(Buffer.concat(startChunks, startLen));
  const middleDecoded = decodeUtf8Sample(Buffer.concat(middleChunks, middleLen));
  const endDecoded = decodeUtf8Sample(tail);
  encodingOk = startDecoded.ok && middleDecoded.ok && endDecoded.ok;

  return {
    checksumSha256: hash.digest("hex"),
    encodingOk,
    samples: {
      start: startDecoded.text,
      middle: middleDecoded.text,
      end: endDecoded.text,
    },
    bytesRead,
    empty: !sawNonWhitespace,
  };
}

/**
 * Detect file signature from a head sample (and optional full bytes for small files).
 * For large objects, only the head sample is used — OOXML deep validation is skipped
 * (already enforced at upload time).
 */
export function detectFileSignatureFromSamples(input: {
  head: Uint8Array;
  contentLength: number;
  fullBytes?: Uint8Array;
}): FileSignatureDetection {
  if (
    input.fullBytes &&
    input.contentLength <= SOURCE_SIGNATURE_FULL_BUFFER_MAX_BYTES
  ) {
    return detectFileSignature(input.fullBytes);
  }
  return detectFileSignature(input.head);
}

/**
 * Optional: spill a stream to a temp file for callers that need random access,
 * with guaranteed cleanup.
 */
export async function withTempFileFromStream<T>(
  readable: Readable,
  fn: (filePath: string) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "jykstore-docling-"));
  const filePath = join(dir, "object.bin");
  try {
    await pipeline(readable, createWriteStream(filePath));
    return await fn(filePath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Test helper — write bytes and return path (caller cleans up). */
export async function writeTempBytes(bytes: Uint8Array, suffix = ".bin"): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "jykstore-docling-"));
  const filePath = join(dir, `blob${suffix}`);
  await writeFile(filePath, bytes);
  return filePath;
}
