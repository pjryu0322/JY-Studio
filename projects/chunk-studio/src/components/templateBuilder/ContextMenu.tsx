"use client";

import { useMemo, useState } from "react";

const MENU_ITEMS: Array<{
  id: "section" | "field" | "table" | "repeat" | "signature" | "date";
  label: string;
}> = [
  { id: "section", label: "Section" },
  { id: "field", label: "Field" },
  { id: "table", label: "Table" },
  { id: "repeat", label: "Repeat Block" },
  { id: "signature", label: "Signature" },
  { id: "date", label: "Date" },
];

interface ContextMenuProps {
  x: number;
  y: number;
  suggestedFieldLabels?: string[];
  disabledIds?: Array<(typeof MENU_ITEMS)[number]["id"]>;
  onSelect: (type: (typeof MENU_ITEMS)[number]["id"], name?: string) => void;
  onClose: () => void;
}

export default function ContextMenu({
  x,
  y,
  suggestedFieldLabels = [],
  disabledIds = [],
  onSelect,
  onClose,
}: ContextMenuProps) {
  const [fieldOpen, setFieldOpen] = useState(false);
  const [fieldName, setFieldName] = useState("");
  const fieldOptions = useMemo(
    () => (suggestedFieldLabels.length > 0 ? suggestedFieldLabels : ["필드"]),
    [suggestedFieldLabels]
  );

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 30 }}
      />
      <div
        style={{
          position: "fixed",
          left: x,
          top: y,
          zIndex: 31,
          background: "#fff",
          border: "1px solid #ddd",
          borderRadius: 8,
          boxShadow: "0 10px 20px rgba(0,0,0,0.08)",
          minWidth: 180,
          overflow: "hidden",
        }}
      >
        {MENU_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (item.id === "field") {
                const initial = fieldOptions[0] ?? "필드";
                setFieldName(initial);
                setFieldOpen(true);
                return;
              }
              const defaultName =
                item.id === "section"
                  ? "섹션"
                  : item.id === "table"
                    ? "표"
                    : item.id === "repeat"
                      ? "반복 블록"
                      : item.id === "signature"
                        ? "서명"
                        : item.id === "date"
                          ? "작성일자"
                          : "필드";
              onSelect(item.id, defaultName);
            }}
            disabled={disabledIds.includes(item.id)}
            style={{
              width: "100%",
              textAlign: "left",
              border: 0,
              background: disabledIds.includes(item.id) ? "#f7f7f7" : "transparent",
              padding: "8px 10px",
              fontSize: 12,
              cursor: disabledIds.includes(item.id) ? "not-allowed" : "pointer",
              color: disabledIds.includes(item.id) ? "#999" : "#222",
            }}
          >
            {item.label}
          </button>
        ))}
        {fieldOpen && (
          <div style={{ borderTop: "1px solid #eee", padding: 8, display: "grid", gap: 6 }}>
            <div style={{ fontSize: 11, color: "#666" }}>필드 라벨 추천</div>
            <select
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              style={{ fontSize: 12, padding: 6 }}
            >
              {fieldOptions.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
            <input
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              placeholder="필드 라벨"
              style={{ fontSize: 12, padding: 6 }}
            />
            <button
              type="button"
              disabled={!fieldName.trim()}
              onClick={() => onSelect("field", fieldName.trim())}
              style={{ fontSize: 12, padding: "6px 8px", cursor: "pointer" }}
            >
              필드 추가
            </button>
          </div>
        )}
      </div>
    </>
  );
}

