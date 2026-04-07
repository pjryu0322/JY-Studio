"use client";

import { useMemo } from "react";

export type DiscussionItem = {
  id: string;
  at: string;
  author: string;
  content: string;
  mode: "online" | "offline";
};

export function DiscussionTimeline({ items }: { items: DiscussionItem[] }) {
  const sorted = useMemo(() => [...items].sort((a, b) => (a.at < b.at ? 1 : -1)), [items]);

  return (
    <section aria-label="Discussion timeline" style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 800 }}>Discussion</div>
      {sorted.length === 0 ? (
        <div style={{ fontSize: 13, color: "#6b7280" }}>(no discussion yet)</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {sorted.map((x) => (
            <div key={x.id} style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>
                  {x.author}{" "}
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280" }}>
                    · {x.mode === "online" ? "online" : "offline note"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{x.at}</div>
              </div>
              <div style={{ fontSize: 13, color: "#111827", marginTop: 8, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {x.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

