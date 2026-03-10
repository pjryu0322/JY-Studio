"use client";

import { useMemo, useState } from "react";
import type { TemplateDiffResponse } from "@/types/template";

interface TemplateDiffViewerProps {
  diff: TemplateDiffResponse | null;
  onFocusSection?: (title: string) => void;
}

type DiffFilter = "all" | "fields" | "sections" | "tables" | "repeat";

function sortSections(items: TemplateDiffResponse["sectionsChanged"]) {
  const priority: Record<(typeof items)[number]["changeType"], number> = {
    "major change": 0,
    "minor change": 1,
    unchanged: 2,
  };
  return [...items].sort((a, b) => {
    const byType = priority[a.changeType] - priority[b.changeType];
    if (byType !== 0) return byType;
    return a.similarity - b.similarity;
  });
}

function sortGeneric<T>(items: T[], getPriority: (item: T) => number): T[] {
  return [...items].sort((a, b) => getPriority(a) - getPriority(b));
}

export default function TemplateDiffViewer({
  diff,
  onFocusSection,
}: TemplateDiffViewerProps) {
  const [activeFilter, setActiveFilter] = useState<DiffFilter>("all");

  const sorted = useMemo(() => {
    const current: TemplateDiffResponse = diff ?? {
      fieldsChanged: [],
      sectionsChanged: [],
      tablesChanged: [],
      repeatChanged: [],
    };
    const fields = sortGeneric(current.fieldsChanged, (item) =>
      item.changeType === "modified"
        ? 0
        : item.changeType === "added" || item.changeType === "removed"
          ? 1
          : 2
    );
    const sections = sortSections(current.sectionsChanged);
    const tables = sortGeneric(current.tablesChanged, (item) =>
      item.modifiedRows.length > 0
        ? 0
        : item.addedRows.length + item.removedRows.length > 0
          ? 1
          : 2
    );
    const repeat = sortGeneric(current.repeatChanged ?? [], (item) =>
      item.added.length > 0 || item.removed.length > 0 ? 1 : 2
    );
    return { fields, sections, tables, repeat };
  }, [diff]);

  if (!diff) return null;

  const tabs: Array<{ id: DiffFilter; label: string; count: number }> = [
    {
      id: "all",
      label: "All",
      count:
        sorted.fields.length +
        sorted.sections.length +
        sorted.tables.length +
        sorted.repeat.length,
    },
    { id: "fields", label: "Fields", count: sorted.fields.length },
    { id: "sections", label: "Sections", count: sorted.sections.length },
    { id: "tables", label: "Tables", count: sorted.tables.length },
    { id: "repeat", label: "Repeat", count: sorted.repeat.length },
  ];

  const showFields = activeFilter === "all" || activeFilter === "fields";
  const showSections = activeFilter === "all" || activeFilter === "sections";
  const showTables = activeFilter === "all" || activeFilter === "tables";
  const showRepeat = activeFilter === "all" || activeFilter === "repeat";

  return (
    <div style={{ marginTop: 12, border: "1px solid #ddd", borderRadius: 8, padding: 10 }}>
      <h4 style={{ margin: "0 0 8px", fontSize: 13 }}>Template Diff Viewer</h4>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveFilter(tab.id)}
            style={{
              fontSize: 12,
              padding: "4px 8px",
              border: "1px solid #ddd",
              borderRadius: 999,
              cursor: "pointer",
              background: activeFilter === tab.id ? "#eef5ff" : "#fff",
            }}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {showFields && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Field Changes</div>
          {sorted.fields.length === 0 ? (
            <div style={{ fontSize: 12, color: "#666" }}>변경 없음</div>
          ) : (
            sorted.fields.map((item) => (
              <div key={item.key} style={{ fontSize: 12, padding: "4px 0" }}>
                {item.label}: <span style={{ color: "#b71c1c" }}>{item.oldValue || "-"}</span> →{" "}
                <span style={{ color: "#1b5e20" }}>{item.newValue || "-"}</span>
              </div>
            ))
          )}
        </div>
      )}

      {showSections && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Section Changes</div>
          {sorted.sections.length === 0 ? (
            <div style={{ fontSize: 12, color: "#666" }}>변경 없음</div>
          ) : (
            sorted.sections.map((item) => (
              <button
                key={item.sectionId}
                type="button"
                onClick={() => onFocusSection?.(item.title)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  border: "1px solid #eee",
                  borderRadius: 6,
                  marginTop: 6,
                  padding: 8,
                  background:
                    item.changeType === "unchanged"
                      ? "#f7f7f7"
                      : item.changeType === "minor change"
                        ? "#fff8e1"
                        : "#ffebee",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                {item.title} ({item.changeType}, sim={item.similarity})
              </button>
            ))
          )}
        </div>
      )}

      {showTables && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Table Changes</div>
          {sorted.tables.length === 0 ? (
            <div style={{ fontSize: 12, color: "#666" }}>변경 없음</div>
          ) : (
            sorted.tables.map((table) => (
              <div key={table.tableId} style={{ marginTop: 6, fontSize: 12 }}>
                <div>{table.headerLabels.join(" | ")}</div>
                <div style={{ color: "#1b5e20" }}>+ {table.addedRows.length}</div>
                <div style={{ color: "#b71c1c" }}>- {table.removedRows.length}</div>
              </div>
            ))
          )}
        </div>
      )}

      {showRepeat && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Repeat Changes</div>
          {sorted.repeat.length === 0 ? (
            <div style={{ fontSize: 12, color: "#666" }}>변경 없음</div>
          ) : (
            sorted.repeat.map((item) => (
              <div key={item.pattern} style={{ marginTop: 6, fontSize: 12 }}>
                <div>pattern: {item.pattern}</div>
                <div style={{ color: "#1b5e20" }}>+ {item.added.length}</div>
                <div style={{ color: "#b71c1c" }}>- {item.removed.length}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
