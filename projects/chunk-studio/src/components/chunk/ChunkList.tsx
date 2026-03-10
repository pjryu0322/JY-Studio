"use client";

import { useChunkStore } from "@/store/chunkStore";

const PREVIEW_LEN = 140;

export default function ChunkList() {
  const {
    chunks,
    selectedChunkId,
    selectChunk,
    mergeWithNext,
    splitChunk,
    deleteChunk,
  } = useChunkStore();

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "#666" }}>
        Chunks
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {chunks.map((chunk, index) => {
          const isSelected = selectedChunkId === chunk.id;
          const preview =
            chunk.content.length <= PREVIEW_LEN
              ? chunk.content
              : chunk.content.slice(0, PREVIEW_LEN) + "...";
          const showFull = isSelected;

          return (
            <div
              key={chunk.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 4,
                padding: 12,
                background: isSelected ? "#e3f2fd" : "#fff",
                cursor: "pointer",
              }}
              onClick={() => selectChunk(chunk.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectChunk(chunk.id);
                }
              }}
            >
              <div style={{ fontSize: 13, lineHeight: 1.4, marginBottom: 4 }}>
                {showFull ? chunk.content : preview}
              </div>
              <div style={{ fontSize: 11, color: "#666", marginBottom: 8 }}>
                Tokens: {chunk.tokenCount}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  disabled={index >= chunks.length - 1}
                  onClick={() => mergeWithNext(chunk.id)}
                  style={{ padding: "4px 8px", fontSize: 11, cursor: "pointer" }}
                >
                  Merge Next
                </button>
                <button
                  type="button"
                  onClick={() => splitChunk(chunk.id)}
                  style={{ padding: "4px 8px", fontSize: 11, cursor: "pointer" }}
                >
                  Split
                </button>
                <button
                  type="button"
                  onClick={() => deleteChunk(chunk.id)}
                  style={{ padding: "4px 8px", fontSize: 11, cursor: "pointer" }}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {chunks.length === 0 && (
        <div style={{ color: "#666", fontSize: 13 }}>No chunks. Add text and click Generate.</div>
      )}
    </div>
  );
}
