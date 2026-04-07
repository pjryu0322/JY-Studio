"use client";

import { useMemo, useState } from "react";

type TabId = "overview" | "sessions" | "minutes" | "features" | "tasks";

export default function RequirementDetailPage() {
  const tabs = useMemo(
    () =>
      [
        { id: "overview" as const, label: "Overview" },
        { id: "sessions" as const, label: "Sessions" },
        { id: "minutes" as const, label: "Minutes" },
        { id: "features" as const, label: "Features" },
        { id: "tasks" as const, label: "Tasks" },
      ] satisfies { id: TabId; label: string }[],
    []
  );

  const [tab, setTab] = useState<TabId>("overview");

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Requirement Detail</div>
      <nav aria-label="Requirement tabs" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: tab === t.id ? "1px solid #2563eb" : "1px solid #d1d5db",
              background: tab === t.id ? "#eff6ff" : "#fafafa",
              color: tab === t.id ? "#1e40af" : "#111827",
              fontWeight: tab === t.id ? 700 : 600,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{tabs.find((t) => t.id === tab)?.label}</div>
        <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
          (placeholder) UI only — data binding will be added later.
        </div>
      </div>
    </div>
  );
}

