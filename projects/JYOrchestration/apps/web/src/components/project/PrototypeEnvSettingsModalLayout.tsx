"use client";

import type { ReactNode } from "react";
import {
  prototypeEnvReadinessToneColors,
  type PrototypeEnvModalRowKey,
  type PrototypeEnvModalTableRow,
} from "@/lib/project/prototypeEnvSettingsModalRows";

export function PrototypeEnvSettingsModalLayout(input: {
  readonly rows: readonly PrototypeEnvModalTableRow[];
  readonly selectedRow: PrototypeEnvModalRowKey | null;
  readonly onSelectRow: (key: PrototypeEnvModalRowKey) => void;
  readonly detail: ReactNode;
  readonly footer: ReactNode;
}) {
  return (
    <div
      data-testid="prototype-env-settings-modal-layout"
      style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}
    >
      <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", paddingBottom: 12 }}>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                {["항목", "상태", "현재 값", "작업"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "8px 10px",
                      fontSize: 11,
                      fontWeight: 800,
                      color: "#64748b",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {input.rows.map((row) => {
                const colors = prototypeEnvReadinessToneColors(row.statusTone);
                const selected = input.selectedRow === row.key;
                return (
                  <tr
                    key={row.key}
                    data-testid={`prototype-env-modal-row-${row.key}`}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      background: selected ? "#f8fafc" : undefined,
                    }}
                  >
                    <td style={{ padding: "10px", fontWeight: 700, color: "#334155" }}>{row.label}</td>
                    <td style={{ padding: "10px" }}>
                      <span style={{ fontWeight: 800, color: colors.color }}>{row.status}</span>
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        color: "#475569",
                        maxWidth: 220,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={row.currentValue}
                    >
                      {row.currentValue}
                    </td>
                    <td style={{ padding: "10px" }}>
                      <button
                        type="button"
                        onClick={() => input.onSelectRow(row.key)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          background: "#fff",
                          fontWeight: 800,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        {row.actionLabel}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {input.detail ? (
          <div
            data-testid="prototype-env-modal-detail"
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              background: "#fafafa",
            }}
          >
            {input.detail}
          </div>
        ) : null}
      </div>
      <div
        data-testid="prototype-env-modal-footer"
        style={{
          flexShrink: 0,
          borderTop: "1px solid #e2e8f0",
          paddingTop: 12,
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          justifyContent: "flex-end",
          alignItems: "center",
        }}
      >
        {input.footer}
      </div>
    </div>
  );
}
