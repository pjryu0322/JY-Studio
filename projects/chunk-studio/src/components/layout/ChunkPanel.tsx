"use client";

import { useChunkStore } from "@/store/chunkStore";
import ChunkList from "@/components/chunk/ChunkList";
import ChunkEditor from "@/components/chunk/ChunkEditor";

export default function ChunkPanel() {
  const inputText = useChunkStore((s) => s.inputText);
  const setInputText = useChunkStore((s) => s.setInputText);

  return (
    <section className="chunk-panel" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ flexShrink: 0, padding: 16, borderBottom: "1px solid #ddd" }}>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste or load text, then click Generate..."
          rows={6}
          style={{
            width: "100%",
            padding: 8,
            fontSize: 14,
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <ChunkList />
        <ChunkEditor />
      </div>
    </section>
  );
}
