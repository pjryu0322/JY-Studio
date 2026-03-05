"use client";

import { useChunkStore } from "@/store/chunkStore";

export default function ChunkEditor() {
  const { chunks, selectedChunkId } = useChunkStore();
  const chunk = chunks.find((c) => c.id === selectedChunkId);

  if (!chunk) {
    return (
      <div style={{ padding: 16, color: "#666", fontSize: 14 }}>
        Select a chunk to view details.
      </div>
    );
  }

  return (
    <div style={{ padding: 16, borderTop: "1px solid #ddd" }}>
      <div style={{ marginBottom: 8, fontSize: 12, color: "#666" }}>
        Tokens: {chunk.tokenCount}
      </div>
      <div
        style={{
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontSize: 14,
          lineHeight: 1.5,
          maxHeight: 300,
          overflow: "auto",
        }}
      >
        {chunk.content}
      </div>
    </div>
  );
}
