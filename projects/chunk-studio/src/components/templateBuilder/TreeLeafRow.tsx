"use client";

import type { CSSProperties } from "react";

interface TreeLeafRowProps {
  label: string;
  focused?: boolean;
  onFocus: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const leafButtonStyle: CSSProperties = {
  flex: 1,
  display: "block",
  width: "100%",
  textAlign: "left",
  border: 0,
  fontSize: 12,
  color: "#444",
  marginBottom: 4,
  cursor: "pointer",
};

const smallActionStyle: CSSProperties = {
  fontSize: 11,
};

export default function TreeLeafRow({
  label,
  focused,
  onFocus,
  onEdit,
  onDelete,
}: TreeLeafRowProps) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <button
        type="button"
        onClick={onFocus}
        style={{
          ...leafButtonStyle,
          background: focused ? "#eef5ff" : "transparent",
        }}
      >
        {label}
      </button>
      <button type="button" onClick={onEdit} style={smallActionStyle}>
        수정
      </button>
      <button type="button" onClick={onDelete} style={smallActionStyle}>
        삭제
      </button>
    </div>
  );
}
