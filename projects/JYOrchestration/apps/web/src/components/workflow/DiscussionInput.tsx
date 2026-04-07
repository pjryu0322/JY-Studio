"use client";

import { useMemo, useState } from "react";
import type { DiscussionItem } from "@/components/workflow/DiscussionTimeline";

export function DiscussionInput({
  onAdd,
}: {
  onAdd: (item: Omit<DiscussionItem, "id" | "at">) => void;
}) {
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<DiscussionItem["mode"]>("online");
  const canSubmit = useMemo(() => content.trim().length > 0, [content]);

  return (
    <section aria-label="Add discussion" style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Add discussion item</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <label style={{ fontSize: 13, color: "#374151", fontWeight: 700 }}>
          Mode{" "}
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as DiscussionItem["mode"])}
            style={{ marginLeft: 6, padding: "6px 8px", borderRadius: 8, border: "1px solid #d1d5db" }}
          >
            <option value="online">online</option>
            <option value="offline">offline meeting note</option>
          </select>
        </label>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write discussion or meeting notes…"
        rows={4}
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 10,
          border: "1px solid #d1d5db",
          fontSize: 13,
          lineHeight: 1.55,
          resize: "vertical",
        }}
      />

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => {
            const text = content.trim();
            if (!text) return;
            onAdd({ author: "You", content: text, mode });
            setContent("");
          }}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #2563eb",
            background: canSubmit ? "#2563eb" : "#93c5fd",
            color: "#fff",
            fontWeight: 800,
            cursor: canSubmit ? "pointer" : "not-allowed",
            fontSize: 13,
          }}
        >
          Add
        </button>
      </div>
    </section>
  );
}

