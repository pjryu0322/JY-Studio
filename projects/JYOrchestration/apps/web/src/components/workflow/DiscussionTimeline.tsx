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
    <section aria-label="토론 타임라인" style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 800 }}>토론</div>
      {sorted.length === 0 ? (
        <div style={{ fontSize: 13, color: "#6b7280" }}>(아직 토론이 없습니다)</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {sorted.map((x) => (
            <div key={x.id} style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>
                  {x.author}{" "}
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280" }}>
                    · {x.mode === "online" ? "온라인" : "오프라인 메모"}
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

