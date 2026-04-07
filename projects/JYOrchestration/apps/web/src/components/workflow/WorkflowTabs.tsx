"use client";

import { ReactNode } from "react";

export type WorkflowTabSpec<T extends string> = {
  id: T;
  label: string;
  right?: ReactNode;
};

export function WorkflowTabs<T extends string>({
  tabs,
  activeId,
  onChange,
  ariaLabel,
}: {
  tabs: WorkflowTabSpec<T>[];
  activeId: T;
  onChange: (id: T) => void;
  ariaLabel: string;
}) {
  return (
    <nav aria-label={ariaLabel} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14, marginTop: 14 }}>
      {tabs.map((t) => {
        const active = t.id === activeId;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: active ? "1px solid #2563eb" : "1px solid #d1d5db",
              background: active ? "#eff6ff" : "#fafafa",
              color: active ? "#1e40af" : "#111827",
              fontWeight: active ? 800 : 700,
              cursor: "pointer",
              fontSize: 13,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>{t.label}</span>
            {t.right ? <span aria-hidden>{t.right}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}

