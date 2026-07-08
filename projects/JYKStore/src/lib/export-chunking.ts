export type Utf8ByteSlice = {
  content: string;
  byteLength: number;
  nextOffset: number;
  hasMore: boolean;
  totalBytes: number;
};

export class ExportChunkRangeError extends Error {
  readonly code = "INVALID_EXPORT_CHUNK_RANGE" as const;

  constructor(message: string, readonly hint?: string) {
    super(message);
    this.name = "ExportChunkRangeError";
  }
}

function isUtf8Continuation(byte: number): boolean {
  return (byte & 0xc0) === 0x80;
}

function utf8CharByteLength(lead: number): number {
  if (lead < 0x80) return 1;
  if ((lead & 0xe0) === 0xc0) return 2;
  if ((lead & 0xf0) === 0xe0) return 3;
  if ((lead & 0xf8) === 0xf0) return 4;
  return 1;
}

function assertValidByteOffset(buffer: Buffer, offset: number): void {
  if (offset < 0 || !Number.isInteger(offset)) {
    throw new ExportChunkRangeError("offset must be a non-negative integer byte offset.");
  }
  if (offset === 0 || offset >= buffer.length) return;
  if (isUtf8Continuation(buffer[offset]!)) {
    throw new ExportChunkRangeError(
      `offset ${offset} falls in the middle of a UTF-8 multi-byte character.`,
      "Use a nextOffset returned by a previous chunk read.",
    );
  }
}

function snapEndToUtf8Boundary(buffer: Buffer, start: number, tentativeEnd: number): number {
  if (tentativeEnd >= buffer.length) return buffer.length;
  if (tentativeEnd <= start) return start;

  let cursor = start;
  let lastGood = start;
  while (cursor < tentativeEnd) {
    const charLen = utf8CharByteLength(buffer[cursor]!);
    if (cursor + charLen > tentativeEnd) break;
    if (cursor + charLen > buffer.length) break;
    cursor += charLen;
    lastGood = cursor;
  }
  return lastGood;
}

/**
 * Slice UTF-8 text by byte offset/limit without splitting multi-byte characters.
 */
export function sliceUtf8TextByBytes(
  input: string,
  offset: number,
  limitBytes: number,
): Utf8ByteSlice {
  if (!Number.isInteger(limitBytes) || limitBytes < 1) {
    throw new ExportChunkRangeError("limitBytes must be a positive integer.");
  }

  const buffer = Buffer.from(input, "utf8");
  const totalBytes = buffer.length;
  assertValidByteOffset(buffer, offset);

  if (offset >= totalBytes) {
    return {
      content: "",
      byteLength: 0,
      nextOffset: totalBytes,
      hasMore: false,
      totalBytes,
    };
  }

  const tentativeEnd = Math.min(offset + limitBytes, totalBytes);
  const safeEnd = snapEndToUtf8Boundary(buffer, offset, tentativeEnd);
  const slice = buffer.subarray(offset, safeEnd);
  const content = slice.toString("utf8");
  const byteLength = slice.length;
  const nextOffset = offset + byteLength;

  return {
    content,
    byteLength,
    nextOffset,
    hasMore: nextOffset < totalBytes,
    totalBytes,
  };
}
