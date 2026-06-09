"use client";

import type { MutableRefObject } from "react";
import { prototypeEnvReadinessToneColors } from "@/lib/project/prototypeEnvSettingsReadiness";
import type { SplitPreflightTableRow } from "@/lib/prototype/autoGenerationSplitPreflightDisplay";

export function ConnectionCheckResultTable(input: {
  readonly title: string;
  readonly testId: string;
  readonly rows: readonly SplitPreflightTableRow[];
  readonly showPlaceholder: boolean;
  readonly openHelpKey: string | null;
  readonly onToggleHelp: (key: string) => void;
  readonly triggerRefs: MutableRefObject<Partial<Record<string, HTMLButtonElement | null>>>;
}) {
  return (
    <div data-testid={input.testId} style={{ marginTop: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>{input.title}</div>
      {input.showPlaceholder ? (
        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>연결 테스트를 실행하면 결과가 표시됩니다.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                {["항목", "상태", "현재 값/결과", "도움말"].map((h) => (
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
                return (
                  <tr
                    key={row.key}
                    data-testid={`${input.testId}-row-${row.key}`}
                    style={{ borderBottom: "1px solid #f1f5f9" }}
                  >
                    <td style={{ padding: "10px", fontWeight: 700, color: "#334155" }}>{row.label}</td>
                    <td style={{ padding: "10px" }}>
                      <span style={{ fontWeight: 800, color: colors.color }}>{row.status}</span>
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        color: "#475569",
                        maxWidth: 280,
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
                        ref={(el) => {
                          input.triggerRefs.current[`${input.testId}:${row.key}`] = el;
                        }}
                        aria-label={`${row.label} 도움말`}
                        data-split-preflight-help-trigger
                        onClick={() => input.onToggleHelp(`${input.testId}:${row.key}`)}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 999,
                          border: "1px solid #cbd5e1",
                          background: input.openHelpKey === `${input.testId}:${row.key}` ? "#f1f5f9" : "#fff",
                          color: "#475569",
                          fontWeight: 900,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        ?
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
