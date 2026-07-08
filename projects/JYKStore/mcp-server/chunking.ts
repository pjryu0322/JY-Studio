import { mcpError } from "./errors.js";
import {
  ExportChunkRangeError,
  sliceUtf8TextByBytes as sharedSliceUtf8TextByBytes,
  type Utf8ByteSlice,
} from "../src/lib/export-chunking";

export type { Utf8ByteSlice };
export { ExportChunkRangeError };

/**
 * MCP-facing UTF-8 slice wrapper (maps range errors to MCP codes).
 * Production chunk tools should call Public API export chunk endpoints instead.
 */
export function sliceUtf8TextByBytes(
  input: string,
  offset: number,
  limitBytes: number,
): Utf8ByteSlice {
  try {
    return sharedSliceUtf8TextByBytes(input, offset, limitBytes);
  } catch (error) {
    if (error instanceof ExportChunkRangeError) {
      throw mcpError("JYKSTORE_MCP_INVALID_CHUNK_RANGE", error.message, {
        hint: error.hint,
      });
    }
    throw error;
  }
}
