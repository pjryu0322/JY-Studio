"use client";

import { useState } from "react";
import { useChunkStore } from "@/store/chunkStore";
import FileUpload from "@/components/upload/FileUpload";

export default function Sidebar() {
  const maxTokens = useChunkStore((s) => s.maxTokens);
  const setMaxTokens = useChunkStore((s) => s.setMaxTokens);
  const [inputVal, setInputVal] = useState(String(maxTokens));

  const handleApply = () => {
    const n = parseInt(inputVal, 10);
    if (!Number.isNaN(n)) setMaxTokens(n);
    setInputVal(String(useChunkStore.getState().maxTokens));
  };

  return (
    <aside className="sidebar" style={{ padding: 12 }}>
      <section style={{ marginBottom: 16 }}>
        <span className="sidebar__label" style={{ fontSize: 11, fontWeight: 600, color: "#666", display: "block", marginBottom: 8 }}>
          Import
        </span>
        <FileUpload />
      </section>
      <section>
        <span className="sidebar__label" style={{ fontSize: 11, fontWeight: 600, color: "#666", display: "block", marginBottom: 8 }}>
          Settings
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <label style={{ fontSize: 12 }} htmlFor="max-tokens">
            maxTokens
          </label>
          <input
            id="max-tokens"
            type="number"
            min={50}
            max={2000}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onBlur={handleApply}
            onKeyDown={(e) => e.key === "Enter" && handleApply()}
            style={{ width: 72, padding: 4, fontSize: 12 }}
          />
        </div>
        <button
          type="button"
          onClick={handleApply}
          style={{ padding: "4px 10px", fontSize: 12, cursor: "pointer" }}
        >
          Apply
        </button>
      </section>
    </aside>
  );
}
